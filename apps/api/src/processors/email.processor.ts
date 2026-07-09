/**
 * @fileoverview Consumer for the `email` queue. Demonstrates named dispatch
 * (`send-welcome`, `send-receipt`) plus an unnamed catch-all, and the canonical
 * at-least-once idempotency pattern on the receipt handler.
 *
 * Delivery is at-least-once: a worker crash, lock expiry, or shutdown force-close
 * can redeliver the same job, so the receipt handler keeps an already-processed
 * marker keyed by `job.id`. A redelivered job returns the memoized result and
 * sends nothing twice. A production system persists this marker (a unique key on
 * the write, or a processed-ids table); the in-memory map here keeps the example
 * dependency-free while making the pattern visible.
 * @layer app/processors
 */
import { OnWorkerEvent, Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB, WELCOME_JOB } from '../orders/order-jobs.constants.js'
import type {
  ReceiptEmailJobData,
  ReceiptEmailJobResult,
  WelcomeEmailJobData,
  WelcomeEmailJobResult,
} from '../orders/order-jobs.types.js'
import { EventFeed } from '../events/event-feed.service.js'
import { redact } from '../events/redact.js'
import { AuditTrail } from './audit-trail.service.js'
import { MailerStub } from './mailer.stub.js'

/** Concurrency for the email worker: a few I/O-bound sends overlap safely. */
const EMAIL_CONCURRENCY = 3

/** Upper bound on retained idempotency markers; oldest entries are evicted first. */
const IDEMPOTENCY_MARKER_CAPACITY = 1000

/**
 * Processes `email` jobs. Named handlers take precedence over the catch-all;
 * the library dispatches the most specific `@Process('name')` first and falls
 * back to the unnamed `@Process()` for every other job name.
 */
@Processor(EMAIL_QUEUE, { concurrency: EMAIL_CONCURRENCY })
export class EmailProcessor {
  /** Already-processed receipts keyed by `job.id`, memoizing the original result. */
  private readonly processedReceipts = new Map<string, ReceiptEmailJobResult>()

  constructor(
    private readonly mailer: MailerStub,
    private readonly trail: AuditTrail,
    private readonly feed: EventFeed,
  ) {}

  /**
   * Handle a `send-welcome` job by dispatching the welcome email.
   *
   * @param job - The welcome job carrying the user id.
   * @returns The provider message id of the sent welcome email.
   */
  @Process(WELCOME_JOB)
  sendWelcome(job: Job<WelcomeEmailJobData, WelcomeEmailJobResult>): WelcomeEmailJobResult {
    return this.mailer.send(job.data.userId, WELCOME_JOB)
  }

  /**
   * Handle a `send-receipt` job idempotently. A redelivery of the same `job.id`
   * returns the memoized result and never sends a second receipt.
   *
   * @param job - The receipt job carrying the order details.
   * @returns The provider message id of the sent (or previously sent) receipt.
   */
  @Process(RECEIPT_JOB)
  sendReceipt(job: Job<ReceiptEmailJobData, ReceiptEmailJobResult>): ReceiptEmailJobResult {
    const marker = job.id === undefined ? undefined : this.processedReceipts.get(job.id)
    if (marker !== undefined) {
      return marker
    }
    const result = this.mailer.send(job.data.to, RECEIPT_JOB)
    this.rememberReceipt(job.id, result)
    return result
  }

  /**
   * Catch-all for any email job whose name has no specific handler. Records the
   * unexpected job name into the audit trail rather than failing silently.
   *
   * @param job - The unhandled email job.
   */
  @Process()
  handleUnknown(job: Job<unknown>): void {
    this.trail.append({ at: new Date().toISOString(), payload: `unhandled email job: ${job.name}` })
  }

  /**
   * Worker-local `completed` listener. Receives the full `Job`, so it bridges the
   * redacted payload, attempts, and the actual return value onto the feed.
   *
   * @param job - The completed job.
   * @param returnValue - The handler's return value.
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<unknown, unknown>, returnValue: unknown): void {
    this.feed.push({
      source: 'worker',
      queue: EMAIL_QUEUE,
      event: 'completed',
      jobId: job.id,
      at: new Date().toISOString(),
      data: redact(job.data),
      returnvalue: returnValue,
      attemptsMade: job.attemptsMade,
    })
  }

  /**
   * Worker-local `failed` listener. The job may be undefined if it failed before
   * the worker fetched it, so payload and attempts are bridged only when present.
   *
   * @param job - The failed job, or undefined when unavailable.
   * @param error - The error that failed the job.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<unknown> | undefined, error: Error): void {
    const base = {
      source: 'worker' as const,
      queue: EMAIL_QUEUE,
      event: 'failed',
      jobId: job?.id,
      at: new Date().toISOString(),
      failedReason: error.message,
    }
    this.feed.push(job ? { ...base, data: redact(job.data), attemptsMade: job.attemptsMade } : base)
  }

  /**
   * Worker-local `progress` listener. Bridges the reported progress (a number or
   * a structured object) onto the feed.
   *
   * @param job - The job reporting progress.
   * @param progress - The reported progress value.
   */
  @OnWorkerEvent('progress')
  onProgress(job: Job<unknown>, progress: number | object): void {
    this.feed.push({
      source: 'worker',
      queue: EMAIL_QUEUE,
      event: 'progress',
      jobId: job.id,
      at: new Date().toISOString(),
      progress,
      attemptsMade: job.attemptsMade,
    })
  }

  /**
   * Worker-local `active` listener. Bridges the redacted payload of a job that has
   * just started processing.
   *
   * @param job - The job that became active.
   */
  @OnWorkerEvent('active')
  onActive(job: Job<unknown>): void {
    this.feed.push({
      source: 'worker',
      queue: EMAIL_QUEUE,
      event: 'active',
      jobId: job.id,
      at: new Date().toISOString(),
      data: redact(job.data),
      attemptsMade: job.attemptsMade,
    })
  }

  /**
   * Record a receipt as processed so a redelivery of the same id is a no-op.
   *
   * @param jobId - The receipt job id; skipped when BullMQ omitted an id.
   * @param result - The result to memoize for a redelivery of the same id.
   */
  private rememberReceipt(jobId: string | undefined, result: ReceiptEmailJobResult): void {
    if (jobId === undefined) {
      return
    }
    this.processedReceipts.set(jobId, result)
    this.evictOldestMarkerWhenFull()
  }

  /**
   * Evict the oldest marker once the map exceeds its capacity, keeping memory
   * bounded. Insertion order is preserved by `Map`, so the first key is oldest.
   */
  private evictOldestMarkerWhenFull(): void {
    if (this.processedReceipts.size <= IDEMPOTENCY_MARKER_CAPACITY) {
      return
    }
    // The size guard above guarantees at least one key, so this deletes the
    // single oldest entry and returns on the first iteration.
    for (const oldest of this.processedReceipts.keys()) {
      this.processedReceipts.delete(oldest)
      return
    }
  }
}
