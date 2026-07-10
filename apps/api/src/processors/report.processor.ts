/**
 * @fileoverview Consumer for the `reports` queue: a long-running job that reports
 * progress. It emits both progress forms accepted by BullMQ (plain numbers and a
 * structured object) as it advances through staged work, and returns a summary.
 *
 * `lockDuration` is raised well above the handler's worst-case runtime so a
 * healthy long job is never mistaken for a stalled one and re-run. `concurrency`
 * stays low because these jobs are heavy; scale out with more worker instances
 * rather than piling them onto one event loop.
 * @layer app/processors
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { REPORTS_QUEUE } from '../queues/queue-names.js'
import { GENERATE_REPORT_JOB } from '../reports/report-jobs.constants.js'
import type { ReportJobData, ReportJobResult } from '../reports/report-jobs.types.js'
import { sleep } from '../timing/sleep.js'

/** Concurrency for the report worker: heavy jobs stay low and scale out horizontally. */
const REPORT_CONCURRENCY = 2

/** Lock duration in milliseconds, comfortably above the ~2s worst-case runtime. */
const REPORT_LOCK_DURATION_MS = 60_000

/** Simulated duration of each staged step, in milliseconds. */
const REPORT_STEP_DELAY_MS = 500

/**
 * Progress checkpoints reported after each staged step: three numeric percentages
 * then a structured object, demonstrating both `updateProgress` forms.
 */
const PROGRESS_CHECKPOINTS: readonly (number | { stage: string; pct: number })[] = [
  25,
  50,
  75,
  { stage: 'render', pct: 90 },
]

/**
 * Processes `reports` jobs. Emits progress after each staged step and returns the
 * report id with the measured duration.
 */
@Processor(REPORTS_QUEUE, {
  concurrency: REPORT_CONCURRENCY,
  lockDuration: REPORT_LOCK_DURATION_MS,
})
export class ReportProcessor {
  /**
   * Generate a report through staged steps, reporting progress after each one.
   *
   * @param job - The report job carrying the report id.
   * @returns The report id and the wall-clock duration of the generation.
   */
  @Process(GENERATE_REPORT_JOB)
  async generate(job: Job<ReportJobData, ReportJobResult>): Promise<ReportJobResult> {
    const startedAt = Date.now()
    for (const progress of PROGRESS_CHECKPOINTS) {
      await sleep(REPORT_STEP_DELAY_MS)
      await job.updateProgress(progress)
    }
    return { reportId: job.data.reportId, durationMs: Date.now() - startedAt }
  }
}
