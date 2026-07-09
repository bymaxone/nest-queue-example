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
import type { Job, WorkerOptions } from '@bymax-one/nest-queue'
import type { AppEnv } from '../config/env.js'
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
 * Build the processor with a spyable log and a fixed failure budget.
 *
 * @param failures - The configured number of injected failures.
 * @returns The processor and the record spy.
 */
function setup(failures: number) {
  const record = jest.fn<WebhookLog['record']>()
  const log: Pick<WebhookLog, 'record'> = { record }
  const env = { WEBHOOK_FAILURES: failures } as unknown as AppEnv
  const processor = new WebhookProcessor(log as WebhookLog, env)
  return { processor, record }
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
})
