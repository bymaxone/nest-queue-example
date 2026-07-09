/**
 * @fileoverview Consumer for the `webhooks` queue: the retry theater. The handler
 * fails deterministically a configured number of times before succeeding, making
 * the module's exponential backoff and BullMQ's rate limiter observable.
 *
 * Failure injection is in-process only (a thrown `Error`), never a real outbound
 * request, so demos and tests are deterministic and there is no server-side
 * request-forgery surface. `job.attemptsMade` counts prior attempts, so failing
 * while it is below the configured threshold yields exactly that many failures
 * followed by one success.
 * @layer app/processors
 */
import { Inject } from '@nestjs/common'
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
import { WEBHOOKS_QUEUE } from '../queues/queue-names.js'
import { ORDER_CREATED_JOB } from '../orders/order-jobs.constants.js'
import type {
  OrderCreatedWebhookJobData,
  OrderCreatedWebhookJobResult,
} from '../orders/order-jobs.types.js'
import { WebhookLog } from './webhook-log.service.js'

/**
 * Concurrency for the webhook worker: up to five deliveries run at once so a slow
 * downstream cannot serialize the whole queue.
 */
const WEBHOOK_CONCURRENCY = 5

/** Rate limiter ceiling: at most two jobs may start per {@link WEBHOOK_LIMITER_DURATION_MS}. */
const WEBHOOK_LIMITER_MAX = 2

/** Rate limiter window in milliseconds, pairing with {@link WEBHOOK_LIMITER_MAX} for 2 jobs/second. */
const WEBHOOK_LIMITER_DURATION_MS = 1000

/**
 * Processes `webhooks` jobs. `concurrency` lets several deliveries overlap while
 * the `limiter` caps the start rate at two per second, protecting a rate-limited
 * downstream even when many jobs are waiting.
 */
@Processor(WEBHOOKS_QUEUE, {
  concurrency: WEBHOOK_CONCURRENCY,
  limiter: { max: WEBHOOK_LIMITER_MAX, duration: WEBHOOK_LIMITER_DURATION_MS },
})
export class WebhookProcessor {
  constructor(
    private readonly log: WebhookLog,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /**
   * Deliver an `order-created` webhook. Throws while fewer than the configured
   * number of failures have occurred, then records the successful delivery. The
   * throw is in-process; no network request is ever made.
   *
   * @param job - The order-created job; `attemptsMade` drives the injection.
   * @returns The delivered order id and the total attempts it took.
   * @throws {Error} A deterministic injected failure while under the threshold.
   */
  @Process(ORDER_CREATED_JOB)
  deliver(
    job: Job<OrderCreatedWebhookJobData, OrderCreatedWebhookJobResult>,
  ): OrderCreatedWebhookJobResult {
    if (job.attemptsMade < this.env.WEBHOOK_FAILURES) {
      throw new Error(`injected failure ${String(job.attemptsMade)}`)
    }
    const attempts = job.attemptsMade + 1
    this.log.record({ orderId: job.data.orderId, attempts, at: new Date().toISOString() })
    return { orderId: job.data.orderId, attempts }
  }
}
