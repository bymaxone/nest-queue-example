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

/**
 * Build the processor with spyable collaborators.
 *
 * @returns The processor plus the mailer and trail spies.
 */
function setup() {
  const send = jest.fn<MailerStub['send']>()
  const append = jest.fn<AuditTrail['append']>()
  const mailer: Pick<MailerStub, 'send'> = { send }
  const trail: Pick<AuditTrail, 'append'> = { append }
  const processor = new EmailProcessor(mailer as MailerStub, trail as AuditTrail)
  return { processor, send, append }
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
})
