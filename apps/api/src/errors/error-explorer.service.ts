/**
 * @fileoverview Living error catalog: triggers every reproducible
 * `QUEUE_ERROR_CODES` member by invoking the real failing operation, never by
 * fabricating an envelope. Each trigger lets the resulting `QueueException`
 * propagate untouched so the client receives the library's stable
 * `{ error: { code, message, details } }` shape with the correct HTTP status.
 * Probes run against a managed queue and short-circuit before any Redis write, so
 * the explorer never creates an unmanaged queue or leaves a scheduler behind.
 * @layer app/errors
 */
import { Injectable } from '@nestjs/common'
import {
  BymaxQueueModule,
  QUEUE_ERROR_CODES,
  QueueException,
  QueueService,
  WorkerRegistry,
} from '@bymax-one/nest-queue'
import type { BulkJob, JobSchedulerRepeatOptions } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseJobData } from '../http/validation.js'
import { AUDIT_QUEUE } from '../queues/queue-names.js'
import { AdminQueuesService } from '../admin/queues.service.js'
import { buildCatalog, ERROR_HTTP_STATUS } from './error-catalog.js'
import type { CatalogEntry, ReproducibleErrorCode } from './error-catalog.js'

/** One minute in milliseconds; a base unit for the repeat-option probes. */
const MINUTE_MS = 60_000
/** Batch size that exceeds the library's `MAX_BULK_SIZE` (1000) by one. */
const OVERSIZED_BATCH_SIZE = 1001
/** A queue name guaranteed absent from the managed allow-list. */
const UNKNOWN_QUEUE = 'errors-explorer-unknown-queue'
/** A job id guaranteed absent so `getJob` returns null. */
const MISSING_JOB_ID = 'errors-explorer-missing-job'
/**
 * Managed queue the scheduler and bulk probes target. Using a known queue keeps
 * the probes inside the allow-list: the bulk cap rejects before any Redis write,
 * and an invalid cron throws in BullMQ's parser before a scheduler is persisted.
 */
const PROBE_QUEUE = AUDIT_QUEUE
/**
 * A Redis URL used only to compile invalid module options. It is never connected:
 * `forRoot` rejects the bad `drainTimeoutMs` synchronously before opening a socket.
 */
const INVALID_OPTIONS_URL = 'redis://errors-explorer-invalid-options:6379'

/** Schema whose validation fails for the invalid-job-data probe. */
const PROBE_JOB_SCHEMA = z.object({ to: z.email() })
/** A payload that fails {@link PROBE_JOB_SCHEMA} without echoing any real value. */
const INVALID_JOB_PAYLOAD = { to: 'not-an-email' }
/** No-op handler for the duplicate-processor collision; the guard fires first. */
const COLLISION_HANDLER = (): Promise<void> => Promise.resolve()

/**
 * Build a batch one job larger than the library's bulk cap. Every job is trivial
 * demo data with no secrets; the guard rejects the batch before Redis is touched.
 *
 * @returns 1001 minimal bulk-job descriptors.
 */
function buildOversizedBatch(): BulkJob<{ index: number }>[] {
  // Stryker disable all: only the batch length (1001) is observable; the bulk guard
  // rejects on size before any job name or data is read, so blanking the per-job
  // name or data yields the identical BULK_ENQUEUE_FAILED rejection.
  return Array.from({ length: OVERSIZED_BATCH_SIZE }, (_value, index) => ({
    name: 'probe',
    data: { index },
  }))
  // Stryker restore all
}

/**
 * The four invalid repeat-option shapes the library rejects: both keys, a
 * non-positive interval, an unparseable cron, and a past end date.
 *
 * @param variant - Selector 0 to 3; anything else maps to the both-keys shape.
 * @returns A structurally or semantically invalid repeat option.
 */
function invalidRepeatVariant(variant: number): JobSchedulerRepeatOptions {
  switch (variant) {
    case 1:
      return { every: 0 }
    case 2:
      return { pattern: 'not-a-valid-cron-expression' }
    case 3:
      return { pattern: '0 3 * * *', endDate: Date.now() - MINUTE_MS }
    default:
      return { pattern: '0 3 * * *', every: MINUTE_MS }
  }
}

/** Triggers the reproducible catalog codes by running the real failing operation. */
@Injectable()
export class ErrorExplorerService {
  /** Dispatch table from a reproducible code to its real failing operation. */
  private readonly triggers: Record<
    ReproducibleErrorCode,
    (variant: number) => void | Promise<void>
  >

  constructor(
    private readonly adminQueues: AdminQueuesService,
    private readonly queueService: QueueService,
    private readonly workers: WorkerRegistry,
  ) {
    this.triggers = {
      [QUEUE_ERROR_CODES.QUEUE_NOT_FOUND]: () => {
        this.triggerQueueNotFound()
      },
      [QUEUE_ERROR_CODES.JOB_NOT_FOUND]: () => this.triggerJobNotFound(),
      [QUEUE_ERROR_CODES.INVALID_JOB_DATA]: () => {
        this.triggerInvalidJobData()
      },
      [QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS]: (variant) =>
        this.triggerInvalidRepeatOptions(variant),
      [QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED]: () => this.triggerBulkEnqueueFailed(),
      [QUEUE_ERROR_CODES.INVALID_OPTIONS]: () => {
        this.triggerInvalidOptions()
      },
      [QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR]: () => {
        this.triggerDuplicateProcessor()
      },
    }
  }

  /**
   * The full error-code catalog with statuses and reproducibility flags.
   *
   * @returns One entry per `QUEUE_ERROR_CODES` member.
   */
  catalog(): CatalogEntry[] {
    return buildCatalog()
  }

  /**
   * Trigger a reproducible code by running its real failing operation. The
   * resulting `QueueException` propagates untouched.
   *
   * @param code - The reproducible code to provoke.
   * @param variant - Sub-variant selector (only `invalid_repeat_options` uses it).
   * @returns Never resolves; the underlying operation always throws.
   * @throws {QueueException} The library's stable envelope for the code.
   */
  async trigger(code: ReproducibleErrorCode, variant = 0): Promise<never> {
    await this.triggers[code](variant)
    // A reproducible operation must raise; if it resolved the catalog contract is
    // broken, so surface the code rather than return a misleading success.
    throw new QueueException(code, ERROR_HTTP_STATUS[code], { reason: 'operation did not raise' })
  }

  /** Ask the admin plane for an unregistered queue, hitting the allow-list guard. */
  private triggerQueueNotFound(): void {
    this.adminQueues.getManagedQueue(UNKNOWN_QUEUE)
  }

  /** Look up a job that does not exist, so the consumer raises the not-found code. */
  private async triggerJobNotFound(): Promise<void> {
    await this.adminQueues.findJob(AUDIT_QUEUE, MISSING_JOB_ID)
  }

  /** Validate a bad payload through the enqueue schema guard. */
  private triggerInvalidJobData(): void {
    parseJobData(PROBE_JOB_SCHEMA, INVALID_JOB_PAYLOAD)
  }

  /** Upsert a scheduler with an invalid repeat option so the library rejects it. */
  private async triggerInvalidRepeatOptions(variant: number): Promise<void> {
    await this.queueService.upsertJobScheduler(
      PROBE_QUEUE,
      'errors-explorer-scheduler',
      invalidRepeatVariant(variant),
    )
  }

  /** Enqueue a batch over the bulk cap so the guard rejects it before Redis. */
  private async triggerBulkEnqueueFailed(): Promise<void> {
    await this.queueService.enqueueBulk(PROBE_QUEUE, buildOversizedBatch())
  }

  /** Compile module options the library rejects, throwing synchronously. */
  private triggerInvalidOptions(): void {
    // Stryker disable next-line ObjectLiteral: the invalid drainTimeoutMs below is the
    // sole rejection trigger; forRoot raises INVALID_OPTIONS whether or not the outer
    // wrapper is present, and the spec asserts that real, non-fallback rejection.
    BymaxQueueModule.forRoot({
      // Stryker disable next-line ObjectLiteral: the connection is never reached; the
      // drainTimeoutMs validation rejects first, so blanking the URL is equivalent.
      connection: { url: INVALID_OPTIONS_URL },
      shutdown: { drainTimeoutMs: 0 },
    })
  }

  /**
   * Register a second worker for an already-registered queue, hitting the library's
   * duplicate guard. `guardDuplicate` throws before any worker is constructed or
   * connection opened, so the running app's registry is never mutated.
   */
  private triggerDuplicateProcessor(): void {
    const [registeredQueue] = this.workers.list()
    if (registeredQueue === undefined) {
      // Unreachable while any @Processor is registered; a defensive fail-safe so an
      // impossible empty registry still returns the code rather than a false success.
      throw new QueueException(
        QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR,
        ERROR_HTTP_STATUS[QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR],
        { reason: 'no registered worker to collide with' },
      )
    }
    this.workers.register({ queueName: registeredQueue, handler: COLLISION_HANDLER })
  }
}
