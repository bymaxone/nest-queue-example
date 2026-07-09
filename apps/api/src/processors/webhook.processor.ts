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
 *
 * The global `@OnQueueEvent` listeners live on this class because the library's
 * processor discovery only binds queue-event listeners declared on a `@Processor`
 * class, using its queue. They receive serialized payloads (a `returnvalue`
 * string, not the full `Job`), demonstrating the contrast with the worker-local
 * listeners on the email processor.
 * @layer app/processors
 */
import { Inject } from '@nestjs/common'
import { OnQueueEvent, Process, Processor, QueueService } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
import { WEBHOOKS_QUEUE } from '../queues/queue-names.js'
import { ORDER_CREATED_JOB } from '../orders/order-jobs.constants.js'
import type {
  OrderCreatedWebhookJobData,
  OrderCreatedWebhookJobResult,
} from '../orders/order-jobs.types.js'
import { EventFeed } from '../events/event-feed.service.js'
import { redact } from '../events/redact.js'
import { WebhookLog } from './webhook-log.service.js'

/** Serialized payload delivered to a global `completed` queue-event listener. */
interface QueueCompletedEvent {
  /** Id of the completed job. */
  jobId: string
  /**
   * The job's return value. The library documents this as a serialized string;
   * the shipped BullMQ version delivers the deserialized value at runtime, so the
   * feed passes it through unchanged as `unknown`.
   */
  returnvalue: unknown
}

/** Serialized payload delivered to a global `failed` queue-event listener. */
interface QueueFailedEvent {
  /** Id of the failed job. */
  jobId: string
  /** Serialized failure reason. */
  failedReason: string
}

/** Serialized payload delivered to a global `active` queue-event listener. */
interface QueueActiveEvent {
  /** Id of the job that became active. */
  jobId: string
}

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
    private readonly feed: EventFeed,
    private readonly queueService: QueueService,
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

  /**
   * Global `completed` listener. Bridges the serialized return value onto the
   * feed and demonstrates the `getJob` fallback: when the job is still resolvable,
   * its redacted payload is attached; when already evicted, it is omitted.
   *
   * @param event - The serialized completed payload.
   */
  @OnQueueEvent('completed')
  async onGlobalCompleted(event: QueueCompletedEvent): Promise<void> {
    const base = {
      source: 'global' as const,
      queue: WEBHOOKS_QUEUE,
      event: 'completed',
      jobId: event.jobId,
      at: new Date().toISOString(),
      returnvalue: event.returnvalue,
    }
    const job = await this.queueService.getJob(WEBHOOKS_QUEUE, event.jobId)
    this.feed.push(job ? { ...base, resolvedData: redact(job.data) } : base)
  }

  /**
   * Global `failed` listener. Bridges the serialized failure reason onto the feed.
   *
   * @param event - The serialized failed payload.
   */
  @OnQueueEvent('failed')
  onGlobalFailed(event: QueueFailedEvent): void {
    this.feed.push({
      source: 'global',
      queue: WEBHOOKS_QUEUE,
      event: 'failed',
      jobId: event.jobId,
      at: new Date().toISOString(),
      failedReason: event.failedReason,
    })
  }

  /**
   * Global `active` listener. Bridges the id of a job that started processing on
   * any instance onto the feed.
   *
   * @param event - The serialized active payload.
   */
  @OnQueueEvent('active')
  onGlobalActive(event: QueueActiveEvent): void {
    this.feed.push({
      source: 'global',
      queue: WEBHOOKS_QUEUE,
      event: 'active',
      jobId: event.jobId,
      at: new Date().toISOString(),
    })
  }
}
