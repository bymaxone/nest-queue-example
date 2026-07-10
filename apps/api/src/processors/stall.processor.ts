/**
 * @fileoverview Consumer for the `demos` queue: the stalled-recovery demo. The
 * handler sleeps far longer than its lock duration, but a healthy worker renews
 * the lock so the job completes normally. If the worker is killed mid-job, the
 * lock expires and, on restart, the stalled-job check re-runs it, demonstrating
 * at-least-once recovery.
 *
 * `lockDuration` and `stalledInterval` are deliberately short (5s) so a killed
 * worker's job is detected and recovered within seconds rather than the default
 * 30s. The worker-local event listeners bridge the recovery timeline (active,
 * stalled, completed) onto the event feed so the journey is observable.
 * @layer app/processors
 */
import { OnWorkerEvent, Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { DEMOS_QUEUE } from '../queues/queue-names.js'
import { STALL_JOB } from '../demos/demo-jobs.constants.js'
import type { StallJobData, StallJobResult } from '../demos/demo-jobs.types.js'
import { EventFeed } from '../events/event-feed.service.js'
import { redact } from '../events/redact.js'
import { sleep } from '../timing/sleep.js'

/** Concurrency for the demo worker: a single slow job at a time keeps the demo clear. */
const STALL_CONCURRENCY = 1

/** Lock duration in milliseconds, deliberately short so a killed worker recovers fast. */
const STALL_LOCK_DURATION_MS = 5000

/** Stalled-job check interval in milliseconds, matching the short lock duration. */
const STALL_INTERVAL_MS = 5000

/** How long the handler sleeps: far above the lock so a killed worker leaves it stalled. */
const STALL_SLEEP_MS = 20000

/**
 * Processes `demos` jobs. The handler sleeps well beyond the lock duration; a
 * live worker renews the lock and completes, while a killed one leaves the job to
 * be recovered on restart.
 */
@Processor(DEMOS_QUEUE, {
  concurrency: STALL_CONCURRENCY,
  lockDuration: STALL_LOCK_DURATION_MS,
  stalledInterval: STALL_INTERVAL_MS,
})
export class StallProcessor {
  constructor(private readonly feed: EventFeed) {}

  /**
   * Run the deliberately slow demo job, recording completion once it survives to
   * the end (either uninterrupted or on the recovering worker after a restart).
   *
   * @param job - The stall job carrying the demo id.
   * @returns The demo id and the completion timestamp.
   */
  @Process(STALL_JOB)
  async stall(job: Job<StallJobData, StallJobResult>): Promise<StallJobResult> {
    await sleep(STALL_SLEEP_MS)
    return { demoId: job.data.demoId, completedAt: new Date().toISOString() }
  }

  /**
   * Worker-local `active` listener recording when the job starts (or restarts).
   *
   * @param job - The job that became active.
   */
  @OnWorkerEvent('active')
  onActive(job: Job<StallJobData>): void {
    this.feed.push({
      source: 'worker',
      queue: DEMOS_QUEUE,
      event: 'active',
      jobId: job.id,
      at: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    })
  }

  /**
   * Worker-local `stalled` listener recording detection of a stalled job. This
   * event carries only the job id, not the full `Job`.
   *
   * @param jobId - The id of the job detected as stalled.
   */
  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.feed.push({
      source: 'worker',
      queue: DEMOS_QUEUE,
      event: 'stalled',
      jobId,
      at: new Date().toISOString(),
    })
  }

  /**
   * Worker-local `completed` listener recording the recovered completion.
   *
   * @param job - The completed job.
   * @param returnValue - The handler's return value.
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<StallJobData, StallJobResult>, returnValue: unknown): void {
    this.feed.push({
      source: 'worker',
      queue: DEMOS_QUEUE,
      event: 'completed',
      jobId: job.id,
      at: new Date().toISOString(),
      returnvalue: redact(returnValue),
      attemptsMade: job.attemptsMade,
    })
  }
}
