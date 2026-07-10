/**
 * Unit tests for EmailProcessor.
 *
 * Layer: unit.
 * Goal: named handlers dispatch correctly, the catch-all records unknown jobs,
 * and the receipt handler is idempotent by `job.id` (at-least-once contract).
 * Mocks: MailerStub.send and AuditTrail.append (spies); process-handler metadata
 * is read directly to assert dispatch registration precedence.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import type { AuditTrail } from './audit-trail.service.js'
import { EmailProcessor } from './email.processor.js'
import type { MailerStub, MailResult } from './mailer.stub.js'
import type { EventFeed } from '../events/event-feed.service.js'
import type { FeedEntry } from '../events/event-feed.types.js'
import type {
  ReceiptEmailJobData,
  ReceiptEmailJobResult,
  WelcomeEmailJobData,
} from '../orders/order-jobs.types.js'

/** A discovered process-handler metadata entry. */
interface ProcessHandlerEntry {
  jobName?: string
  methodKey: string
}

/**
 * Read the `@Process` handler metadata attached to a processor class. Process
 * entries carry a `methodKey` and no `eventName`, which distinguishes them from
 * event-listener metadata attached to the same class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered process-handler entries.
 */
function readProcessHandlers(ctor: object): ProcessHandlerEntry[] {
  for (const key of Reflect.getOwnMetadataKeys(ctor)) {
    const value: unknown = Reflect.getOwnMetadata(key, ctor)
    if (
      Array.isArray(value) &&
      value.every((entry) => isRecord(entry) && 'methodKey' in entry && !('eventName' in entry))
    ) {
      return value as ProcessHandlerEntry[]
    }
  }
  return []
}

/** Narrow an unknown value to a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Narrow an unknown value to a worker-event-listener metadata entry. */
function isWorkerEventEntry(entry: unknown): entry is { eventName: string; methodKey: string } {
  return isRecord(entry) && typeof entry.eventName === 'string' && typeof entry.methodKey === 'string'
}

/**
 * Read the worker-event-listener metadata (`eventName` + `methodKey`) attached by
 * the library's `@OnWorkerEvent` decorators. This surfaces each decorator's event
 * name, which a direct method call cannot observe.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered `{ eventName, methodKey }` entries.
 */
function readWorkerEventListeners(ctor: object): { eventName: string; methodKey: string }[] {
  for (const key of Reflect.getOwnMetadataKeys(ctor)) {
    const value: unknown = Reflect.getOwnMetadata(key, ctor)
    if (Array.isArray(value) && value.every(isWorkerEventEntry)) {
      return value
    }
  }
  return []
}

/**
 * Build the processor with spyable collaborators.
 *
 * @returns The processor plus the mailer, trail, and feed spies.
 */
function setup() {
  const send = jest.fn<MailerStub['send']>()
  const append = jest.fn<AuditTrail['append']>()
  const push = jest.fn<EventFeed['push']>()
  const mailer: Pick<MailerStub, 'send'> = { send }
  const trail: Pick<AuditTrail, 'append'> = { append }
  const feed: Pick<EventFeed, 'push'> = { push }
  const processor = new EmailProcessor(mailer as MailerStub, trail as AuditTrail, feed as EventFeed)
  return { processor, send, append, push }
}

/**
 * Extract the single feed entry pushed by a listener.
 *
 * @param push - The push spy.
 * @returns The pushed entry.
 */
function pushedEntry(push: jest.Mock<EventFeed['push']>): FeedEntry {
  expect(push).toHaveBeenCalledTimes(1)
  const call = push.mock.calls[0]
  if (call === undefined) {
    throw new Error('expected a pushed entry')
  }
  return call[0]
}

describe('EmailProcessor (unit)', () => {
  it('registers named handlers ahead of the catch-all', () => {
    /*
     * Scenario: dispatch registration.
     * Rule it protects: `send-welcome` and `send-receipt` map to their specific
     * handlers while the unnamed catch-all carries no job name, so the library's
     * most-specific-first dispatch routes named jobs away from the fallback.
     */
    const handlers = readProcessHandlers(EmailProcessor)

    expect(handlers).toContainEqual({ jobName: 'send-welcome', methodKey: 'sendWelcome' })
    expect(handlers).toContainEqual({ jobName: 'send-receipt', methodKey: 'sendReceipt' })
    expect(handlers).toContainEqual({ methodKey: 'handleUnknown' })
  })

  it('wires each worker-event listener to its BullMQ event name', () => {
    /*
     * Scenario: the @OnWorkerEvent decorator arguments.
     * Rule it protects: each listener subscribes to the exact event name (completed,
     * failed, progress, active); a wrong or blank name would silently detach the
     * listener so its bridged entry never reaches the SSE feed.
     */
    expect(readWorkerEventListeners(EmailProcessor)).toEqual([
      { eventName: 'completed', methodKey: 'onCompleted' },
      { eventName: 'failed', methodKey: 'onFailed' },
      { eventName: 'progress', methodKey: 'onProgress' },
      { eventName: 'active', methodKey: 'onActive' },
    ])
  })

  it('sends the welcome email for a send-welcome job', () => {
    /*
     * Scenario: a welcome job.
     * Rule it protects: the handler dispatches to the mailer keyed by the user id
     * and returns the provider result.
     */
    const { processor, send } = setup()
    send.mockReturnValue({ messageId: 'welcome-1' })
    const job = { id: 'w1', data: { userId: 'u1' } } as Job<WelcomeEmailJobData>

    const result = processor.sendWelcome(job)

    expect(send).toHaveBeenCalledWith('u1', 'send-welcome')
    expect(result).toEqual({ messageId: 'welcome-1' })
  })

  it('sends the receipt once and memoizes the result for a redelivery', () => {
    /*
     * Scenario: the same receipt job is delivered twice (at-least-once).
     * Rule it protects: the idempotency marker keyed by `job.id` skips the second
     * send and returns the original result, so a redelivery has no duplicate effect.
     */
    const { processor, send } = setup()
    send.mockReturnValueOnce({ messageId: 'first' }).mockReturnValueOnce({ messageId: 'second' })
    const job = { id: 'r1', data: { orderId: 'o1', to: 'x@example.com', total: 10 } } as Job<
      ReceiptEmailJobData,
      ReceiptEmailJobResult
    >

    const first = processor.sendReceipt(job)
    const second = processor.sendReceipt(job)

    expect(send).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ messageId: 'first' })
    expect(second).toEqual({ messageId: 'first' })
  })

  it('does not memoize a receipt without a job id', () => {
    /*
     * Boundary: BullMQ omitted the job id.
     * Rule it protects: without an id there is no marker key, so each delivery
     * sends rather than silently collapsing unrelated jobs.
     */
    const { processor, send } = setup()
    send.mockReturnValue({ messageId: 'noid' } satisfies MailResult)
    const job = { data: { orderId: 'o1', to: 'x@example.com', total: 10 } } as Job<
      ReceiptEmailJobData,
      ReceiptEmailJobResult
    >

    processor.sendReceipt(job)
    processor.sendReceipt(job)

    expect(send).toHaveBeenCalledTimes(2)
  })

  it('evicts the oldest marker once capacity is exceeded', () => {
    /*
     * Scenario: more than the marker capacity (1000) of distinct receipts.
     * Rule it protects: the marker map stays bounded; the earliest job id is
     * evicted, so its redelivery sends again rather than growing memory forever.
     */
    const { processor, send } = setup()
    send.mockReturnValue({ messageId: 'm' })
    for (let index = 0; index <= 1000; index += 1) {
      processor.sendReceipt({
        id: `receipt-${String(index)}`,
        data: { orderId: 'o', to: 'x@example.com', total: 1 },
      } as Job<ReceiptEmailJobData, ReceiptEmailJobResult>)
    }
    const sendsAfterFill = send.mock.calls.length

    processor.sendReceipt({
      id: 'receipt-0',
      data: { orderId: 'o', to: 'x@example.com', total: 1 },
    } as Job<ReceiptEmailJobData, ReceiptEmailJobResult>)

    expect(sendsAfterFill).toBe(1001)
    expect(send).toHaveBeenCalledTimes(1002)
  })

  it('retains the oldest marker at exactly the capacity boundary', () => {
    /*
     * Boundary: filling the map to exactly the capacity (1000), not one past it.
     * Rule it protects: eviction triggers only once the map EXCEEDS capacity (`<=`),
     * so at exactly 1000 markers the oldest is still cached; a strict `<` would evict
     * one entry early and re-send a receipt that should have been memoized.
     */
    const { processor, send } = setup()
    send.mockReturnValue({ messageId: 'm' })
    for (let index = 0; index < 1000; index += 1) {
      processor.sendReceipt({
        id: `receipt-${String(index)}`,
        data: { orderId: 'o', to: 'x@example.com', total: 1 },
      } as Job<ReceiptEmailJobData, ReceiptEmailJobResult>)
    }

    processor.sendReceipt({
      id: 'receipt-0',
      data: { orderId: 'o', to: 'x@example.com', total: 1 },
    } as Job<ReceiptEmailJobData, ReceiptEmailJobResult>)

    // receipt-0 was memoized and never evicted, so its redelivery sends nothing new.
    expect(send).toHaveBeenCalledTimes(1000)
  })

  it('records an unknown email job into the audit trail', () => {
    /*
     * Scenario: an email job with no specific handler.
     * Rule it protects: the catch-all logs the unexpected job name instead of
     * failing silently.
     */
    const { processor, append } = setup()
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')
    const job = { id: 'x1', name: 'send-digest', data: {} } as Job<unknown>

    processor.handleUnknown(job)

    expect(append).toHaveBeenCalledWith({
      at: '2026-07-09T00:00:00.000Z',
      payload: 'unhandled email job: send-digest',
    })
  })

  it('bridges a worker completed event with redacted data and the return value', () => {
    /*
     * Scenario: the worker completes a job.
     * Rule it protects: the listener pushes a worker-sourced entry with the full
     * Job fields, but the sensitive `to` address is redacted before it reaches the
     * feed.
     */
    const { processor, push } = setup()
    const job = {
      id: 'j1',
      data: { orderId: 'o1', to: 'x@example.com', total: 5 },
      attemptsMade: 1,
    } as Job<unknown, unknown>

    processor.onCompleted(job, { messageId: 'm1' })

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.event).toBe('completed')
    expect(entry.jobId).toBe('j1')
    expect(entry.returnvalue).toEqual({ messageId: 'm1' })
    expect(entry.attemptsMade).toBe(1)
    expect(entry.data).toEqual({ orderId: 'o1', to: '[redacted]', total: 5 })
  })

  it('bridges a worker failed event with the redacted job and reason', () => {
    /*
     * Scenario: the worker fails a job it had fetched.
     * Rule it protects: the failed listener records the redacted payload, attempts,
     * and the error message.
     */
    const { processor, push } = setup()
    const job = { id: 'j2', data: { to: 'y@example.com' }, attemptsMade: 3 } as Job<unknown>

    processor.onFailed(job, new Error('smtp down'))

    const entry = pushedEntry(push)
    expect(entry.event).toBe('failed')
    expect(entry.jobId).toBe('j2')
    expect(entry.failedReason).toBe('smtp down')
    expect(entry.attemptsMade).toBe(3)
    expect(entry.data).toEqual({ to: '[redacted]' })
  })

  it('bridges a worker failed event without a job', () => {
    /*
     * Boundary: the job failed before the worker fetched it (undefined job).
     * Rule it protects: the listener still records the reason without a job id,
     * payload, or attempts.
     */
    const { processor, push } = setup()

    processor.onFailed(undefined, new Error('fetch failed'))

    const entry = pushedEntry(push)
    expect(entry.event).toBe('failed')
    expect(entry.jobId).toBeUndefined()
    expect(entry.failedReason).toBe('fetch failed')
    expect(entry.data).toBeUndefined()
    expect(entry.attemptsMade).toBeUndefined()
  })

  it('bridges a worker progress event with the reported value', () => {
    /*
     * Scenario: a job reports progress.
     * Rule it protects: the progress listener records the reported value on the feed.
     */
    const { processor, push } = setup()
    const job = { id: 'j3', attemptsMade: 0 } as Job<unknown>

    processor.onProgress(job, 42)

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.event).toBe('progress')
    expect(entry.progress).toBe(42)
  })

  it('bridges a worker active event with redacted data', () => {
    /*
     * Scenario: a job becomes active.
     * Rule it protects: the active listener records the redacted payload as the job
     * starts processing.
     */
    const { processor, push } = setup()
    const job = { id: 'j4', data: { email: 'z@example.com' }, attemptsMade: 0 } as Job<unknown>

    processor.onActive(job)

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.event).toBe('active')
    expect(entry.data).toEqual({ email: '[redacted]' })
  })
})
