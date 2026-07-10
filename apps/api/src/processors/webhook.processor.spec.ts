/**
 * Unit tests for WebhookProcessor.
 *
 * Layer: unit.
 * Goal: the handler injects exactly N deterministic failures (driven by
 * `job.attemptsMade`) then succeeds recording N+1 attempts, and the worker is
 * registered with the intended concurrency and rate limiter.
 * Mocks: WebhookLog.record (spy); AppEnv (WEBHOOK_FAILURES); Date#toISOString
 * pinned; processor metadata is read directly to assert worker options.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job, QueueService, WorkerOptions } from '@bymax-one/nest-queue'
import type { AppEnv } from '../config/env.js'
import type { EventFeed } from '../events/event-feed.service.js'
import type { FeedEntry } from '../events/event-feed.types.js'
import type {
  OrderCreatedWebhookJobData,
  OrderCreatedWebhookJobResult,
} from '../orders/order-jobs.types.js'
import { WebhookProcessor } from './webhook.processor.js'
import type { WebhookLog } from './webhook-log.service.js'

/** Narrow reflection metadata to the processor metadata carrying worker options. */
function isProcessorMetadata(
  value: unknown,
): value is { queueName: string; workerOptions: WorkerOptions } {
  return (
    typeof value === 'object' && value !== null && 'queueName' in value && 'workerOptions' in value
  )
}

/**
 * Read the worker options recorded by `@Processor` on a processor class. The
 * processor metadata object is the one carrying a `queueName`.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered worker options.
 */
function readWorkerOptions(ctor: object): WorkerOptions {
  for (const key of Reflect.getOwnMetadataKeys(ctor)) {
    const value: unknown = Reflect.getOwnMetadata(key, ctor)
    if (isProcessorMetadata(value)) {
      return value.workerOptions
    }
  }
  throw new Error('processor metadata not found')
}

/**
 * Build the processor with spyable collaborators and a fixed failure budget.
 *
 * @param failures - The configured number of injected failures.
 * @returns The processor and the record, push, and getJob spies.
 */
function setup(failures: number) {
  const record = jest.fn<WebhookLog['record']>()
  const push = jest.fn<EventFeed['push']>()
  const getJob = jest.fn<(queueName: string, jobId: string) => Promise<Job | null>>()
  const log: Pick<WebhookLog, 'record'> = { record }
  const feed: Pick<EventFeed, 'push'> = { push }
  const queueService = { getJob } as unknown as QueueService
  const env = { WEBHOOK_FAILURES: failures } as unknown as AppEnv
  const processor = new WebhookProcessor(log as WebhookLog, feed as EventFeed, queueService, env)
  return { processor, record, push, getJob }
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

/**
 * Build an order-created job fixture at a given attempt count.
 *
 * @param attemptsMade - Prior attempts BullMQ has already made.
 * @returns The job fixture.
 */
function jobAt(
  attemptsMade: number,
): Job<OrderCreatedWebhookJobData, OrderCreatedWebhookJobResult> {
  return { attemptsMade, data: { orderId: 'o1' } } as Job<
    OrderCreatedWebhookJobData,
    OrderCreatedWebhookJobResult
  >
}

describe('WebhookProcessor (unit)', () => {
  it('registers concurrency 5 and a 2-per-second limiter', () => {
    /*
     * Scenario: worker registration.
     * Rule it protects: the decorator carries the intended concurrency and rate
     * limiter so several deliveries overlap while the start rate stays capped.
     */
    const options = readWorkerOptions(WebhookProcessor)

    expect(options.concurrency).toBe(5)
    expect(options.limiter).toEqual({ max: 2, duration: 1000 })
  })

  it('fails while under the threshold then succeeds recording N+1 attempts', () => {
    /*
     * Scenario: WEBHOOK_FAILURES=2 across three deliveries of the same job.
     * Rule it protects: the first two attempts throw a deterministic injected
     * failure (so exponential backoff is observable) and the third succeeds,
     * recording total attempts of N+1.
     */
    const { processor, record } = setup(2)
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')

    expect(() => processor.deliver(jobAt(0))).toThrow('injected failure 0')
    expect(() => processor.deliver(jobAt(1))).toThrow('injected failure 1')
    const result = processor.deliver(jobAt(2))

    expect(result).toEqual({ orderId: 'o1', attempts: 3 })
    expect(record).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith({
      orderId: 'o1',
      attempts: 3,
      at: '2026-07-09T00:00:00.000Z',
    })
  })

  it('succeeds on the first attempt when no failures are configured', () => {
    /*
     * Boundary: WEBHOOK_FAILURES=0.
     * Rule it protects: with the injection disabled the first delivery succeeds and
     * records a single attempt.
     */
    const { processor, record } = setup(0)

    const result = processor.deliver(jobAt(0))

    expect(result).toEqual({ orderId: 'o1', attempts: 1 })
    expect(record).toHaveBeenCalledTimes(1)
  })

  it('bridges a global completed event with the serialized value and resolved data', async () => {
    /*
     * Scenario: a global completed event whose job is still resolvable.
     * Rule it protects: the listener records the serialized returnvalue string and,
     * via the getJob fallback, attaches the redacted resolved payload.
     */
    const { processor, push, getJob } = setup(0)
    getJob.mockResolvedValue({ data: { orderId: 'o1', to: 'x@example.com' } } as Job)

    await processor.onGlobalCompleted({ jobId: 'j1', returnvalue: { orderId: 'o1', attempts: 1 } })

    const entry = pushedEntry(push)
    expect(entry.source).toBe('global')
    expect(entry.event).toBe('completed')
    expect(entry.jobId).toBe('j1')
    expect(entry.returnvalue).toEqual({ orderId: 'o1', attempts: 1 })
    expect(entry.resolvedData).toEqual({ orderId: 'o1', to: '[redacted]' })
  })

  it('bridges a global completed event without resolved data when the job was evicted', async () => {
    /*
     * Boundary: the job was already evicted by removeOnComplete (getJob returns null).
     * Rule it protects: the entry still carries the serialized value but omits the
     * resolved payload.
     */
    const { processor, push, getJob } = setup(0)
    getJob.mockResolvedValue(null)

    await processor.onGlobalCompleted({ jobId: 'j1', returnvalue: { attempts: 1 } })

    const entry = pushedEntry(push)
    expect(entry.returnvalue).toEqual({ attempts: 1 })
    expect(entry.resolvedData).toBeUndefined()
  })

  it('bridges a global failed event with the serialized reason', () => {
    /*
     * Scenario: a global failed event.
     * Rule it protects: the listener records the serialized failure reason.
     */
    const { processor, push } = setup(0)

    processor.onGlobalFailed({ jobId: 'j2', failedReason: 'boom' })

    const entry = pushedEntry(push)
    expect(entry.event).toBe('failed')
    expect(entry.jobId).toBe('j2')
    expect(entry.failedReason).toBe('boom')
  })

  it('bridges a global active event with the job id', () => {
    /*
     * Scenario: a global active event from any instance.
     * Rule it protects: the listener records the job id as it starts processing.
     */
    const { processor, push } = setup(0)

    processor.onGlobalActive({ jobId: 'j3' })

    const entry = pushedEntry(push)
    expect(entry.event).toBe('active')
    expect(entry.jobId).toBe('j3')
  })
})
