/**
 * @fileoverview Deduplication laboratory. Maps a requested mode to the exact
 * BullMQ-native `deduplication` option shape and enqueues a `reindex` job under a
 * per-term dedup key. The library writes no deduplication code; BullMQ owns the
 * behavior, so this service only selects options and reports whether the enqueue
 * was collapsed into an existing job.
 * @layer app/search
 */
import { Injectable } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import type { JobsOptions } from '@bymax-one/nest-queue'
import { SEARCH_QUEUE } from '../queues/queue-names.js'
import { REINDEX_JOB } from './search.constants.js'
import type { DedupMode } from './search.constants.js'
import type { ReindexJobData, ReindexJobResult } from './search-jobs.types.js'

/** Deduplication window (ms) for the throttle and debounce modes. */
const DEDUP_TTL_MS = 5000

/** Delay (ms) applied to a debounced reindex so bursts collapse to the latest. */
const DEBOUNCE_DELAY_MS = 2000

/** Validated input accepted by {@link ReindexService.reindex}. */
export interface ReindexInput {
  /** The search term to reindex. */
  term: string
  /** The deduplication strategy to apply. */
  mode: DedupMode
}

/** Outcome of a reindex enqueue: the job id and whether it was deduplicated. */
export interface ReindexResult {
  /** The enqueued (or existing) job id. */
  jobId: string | undefined
  /** `true` when the enqueue collapsed into an already-registered dedup job. */
  deduplicated: boolean
}

/**
 * Build the per-term deduplication key. Deduplication keys are independent of
 * `jobId` and may contain colons.
 *
 * @param term - The search term.
 * @returns The dedup key for the term.
 */
export function dedupId(term: string): string {
  return `reindex:${term}`
}

/**
 * Map a deduplication mode to its exact BullMQ option shape.
 *
 * @param mode - The requested deduplication strategy.
 * @param id - The deduplication key.
 * @returns The per-job options carrying the deduplication (and debounce delay).
 */
function reindexOptions(mode: DedupMode, id: string): JobsOptions {
  switch (mode) {
    case 'simple':
      return { deduplication: { id } }
    case 'throttle':
      return { deduplication: { id, ttl: DEDUP_TTL_MS } }
    case 'debounce':
      return {
        deduplication: { id, ttl: DEDUP_TTL_MS, extend: true, replace: true },
        delay: DEBOUNCE_DELAY_MS,
      }
    case 'keepLast':
      return { deduplication: { id, keepLastIfActive: true } }
  }
}

/** Enqueues reindex jobs under each deduplication strategy. */
@Injectable()
export class ReindexService {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Enqueue a reindex job under the requested deduplication mode.
   *
   * @param input - The validated term and mode.
   * @returns The job id and whether the enqueue was deduplicated.
   */
  async reindex(input: ReindexInput): Promise<ReindexResult> {
    const id = dedupId(input.term)
    const queue = this.queueService.getOrCreateQueue(SEARCH_QUEUE)
    const existing = await queue.getDeduplicationJobId(id)
    const job = await this.queueService.enqueue<ReindexJobData, ReindexJobResult>(
      SEARCH_QUEUE,
      REINDEX_JOB,
      { term: input.term },
      reindexOptions(input.mode, id),
    )
    return { jobId: job.id, deduplicated: existing !== null && job.id === existing }
  }
}
