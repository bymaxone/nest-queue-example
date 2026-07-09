/**
 * @fileoverview Job lookup HTTP surface. Thin controller over
 * {@link AdminQueuesService}: fetch one job by id, surfacing the library's stable
 * `queue.job_not_found` envelope (404) when it does not exist.
 * @layer app/admin
 */
import { Controller, Get, Param } from '@nestjs/common'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { AdminQueuesService } from './queues.service.js'
import type { JobView } from './queues.service.js'

/** Upper bound on a job-id length; a demo guardrail against absurd input. */
const MAX_JOB_ID_LENGTH = 128

/** Bounds the job-id path param before lookup. */
const jobIdSchema = z.string().min(1).max(MAX_JOB_ID_LENGTH)

/** Job detail surface for the managed queues. */
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly adminQueues: AdminQueuesService) {}

  /**
   * Fetch a single job by id.
   *
   * @param queue - The queue name (validated against the managed set).
   * @param id - Unvalidated job id from the path; bounded before lookup.
   * @returns The job as a serializable view.
   * @throws {BadRequestException} When the id is malformed.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue,
   *   or `queue.job_not_found` (404) when the job does not exist.
   */
  @Get(':queue/:id')
  async find(@Param('queue') queue: string, @Param('id') id: unknown): Promise<JobView> {
    return this.adminQueues.findJob(queue, parseRequest(jobIdSchema, id))
  }
}
