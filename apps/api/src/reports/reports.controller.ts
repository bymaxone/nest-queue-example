/**
 * @fileoverview Reports HTTP surface. Enqueues a long-running report-generation
 * job onto the `reports` queue and returns the generated report id and job id so
 * the caller can poll the admin job endpoint to watch progress advance.
 * @layer app/reports
 */
import { randomUUID } from 'node:crypto'
import { Controller, Post } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { REPORTS_QUEUE } from '../queues/queue-names.js'
import { GENERATE_REPORT_JOB } from './report-jobs.constants.js'
import type { ReportJobData, ReportJobResult } from './report-jobs.types.js'

/** Outcome of a report request: the generated report id and the enqueued job id. */
export interface ReportRequested {
  /** The server-generated report id. */
  reportId: string
  /** The enqueued generation job id. */
  jobId: string | undefined
}

/** Enqueues report-generation jobs. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Enqueue a report-generation job with a fresh report id.
   *
   * @returns The generated report id and the enqueued job id.
   */
  @Post()
  async generate(): Promise<ReportRequested> {
    const reportId = randomUUID()
    const job = await this.queueService.enqueue<ReportJobData, ReportJobResult>(
      REPORTS_QUEUE,
      GENERATE_REPORT_JOB,
      { reportId },
    )
    return { reportId, jobId: job.id }
  }
}
