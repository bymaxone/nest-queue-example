/**
 * @fileoverview Living error catalog: triggers every reproducible
 * `QUEUE_ERROR_CODES` member by invoking the real failing operation, never by
 * fabricating an envelope. Each trigger lets the resulting `QueueException`
 * propagate untouched so the client receives the library's stable
 * `{ error: { code, message, details } }` shape with the correct HTTP status.
 * @layer app/errors
 */
import { Inject, Injectable } from '@nestjs/common'
import {
  BymaxQueueModule,
  QUEUE_ERROR_CODES,
  QueueException,
  QueueService,
} from '@bymax-one/nest-queue'
import type { BulkJob, JobSchedulerRepeatOptions } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
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
/** Throwaway queue for the scheduler and bulk probes (never actually reached). */
const PROBE_QUEUE = 'errors-explorer-probe'

/** Schema whose validation fails for the invalid-job-data probe. */
const PROBE_JOB_SCHEMA = z.object({ to: z.email() })
/** A payload that fails {@link PROBE_JOB_SCHEMA} without echoing any real value. */
const INVALID_JOB_PAYLOAD = { to: 'not-an-email' }

/** Injection token for the isolated duplicate-processor probe seam. */
export const DUPLICATE_PROBE: unique symbol = Symbol('DUPLICATE_PROBE')

/** The seam that provokes `duplicate_processor` in a throwaway context. */
export type DuplicateProbe = () => Promise<never>

/**
 * Build a batch one job larger than the library's bulk cap. Every job is trivial
 * demo data with no secrets; the guard rejects the batch before Redis is touched.
 *
 * @returns 1001 minimal bulk-job descriptors.
 */
function buildOversizedBatch(): BulkJob<{ index: number }>[] {
  return Array.from({ length: OVERSIZED_BATCH_SIZE }, (_value, index) => ({
    name: 'probe',
    data: { index },
  }))
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
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(DUPLICATE_PROBE) private readonly provokeDuplicate: DuplicateProbe,
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
      [QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR]: () => this.provokeDuplicate(),
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
    BymaxQueueModule.forRoot({
      connection: { url: this.env.REDIS_URL },
      shutdown: { drainTimeoutMs: 0 },
    })
  }
}
