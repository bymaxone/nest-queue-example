/**
 * @fileoverview Queue admin/control HTTP surface. Thin controller over
 * {@link AdminQueuesService}: lists queues with direct metrics, pages jobs by
 * status, and pauses, resumes, or cleans a queue. Query and body params are
 * validated at the trust boundary; the queue name is checked against the managed
 * allow-list in the service.
 * @layer app/admin
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { JOB_STATUS } from '@bymax-one/nest-queue'
import type { QueueMetrics } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { AdminQueuesService } from './queues.service.js'
import type { JobView } from './queues.service.js'

/** Query accepted by the jobs listing: status filter plus pagination window. */
const jobsQuerySchema = z.object({
  status: z.enum(JOB_STATUS),
  start: z.coerce.number().int().nonnegative().default(0),
  end: z.coerce.number().int().nonnegative().default(50),
})

/** Body accepted by the clean action; mirrors BullMQ's grace/limit/status. */
const cleanSchema = z.object({
  gracePeriodMs: z.number().int().nonnegative().default(0),
  limit: z.number().int().nonnegative().default(0),
  status: z
    .enum(['completed', 'failed', 'delayed', 'wait', 'active', 'paused'])
    .default('completed'),
})

/** Inspection and control surface for the managed queues. */
@Controller('admin/queues')
export class QueuesController {
  constructor(private readonly adminQueues: AdminQueuesService) {}

  /**
   * List the managed queues with a direct metrics snapshot each.
   *
   * @returns One metrics snapshot per managed queue.
   */
  @Get()
  list(): Promise<QueueMetrics[]> {
    return this.adminQueues.collectMetrics()
  }

  /**
   * Page jobs in a status for a queue.
   *
   * @param name - The queue name (validated against the managed set).
   * @param query - Unvalidated query; parsed against the jobs query schema.
   * @returns The matching jobs as serializable views.
   * @throws {BadRequestException} When the status or pagination is malformed.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Get(':name/jobs')
  async jobs(@Param('name') name: string, @Query() query: unknown): Promise<JobView[]> {
    const { status, start, end } = parseRequest(jobsQuerySchema, query)
    return this.adminQueues.listJobs(name, status, start, end)
  }

  /**
   * Pause a queue.
   *
   * @param name - The queue name (validated against the managed set).
   * @returns A confirmation flag.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Post(':name/pause')
  @HttpCode(HttpStatus.OK)
  async pause(@Param('name') name: string): Promise<{ paused: true }> {
    await this.adminQueues.pause(name)
    return { paused: true }
  }

  /**
   * Resume a queue.
   *
   * @param name - The queue name (validated against the managed set).
   * @returns A confirmation flag.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Post(':name/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@Param('name') name: string): Promise<{ resumed: true }> {
    await this.adminQueues.resume(name)
    return { resumed: true }
  }

  /**
   * Clean a queue, returning the removed job ids.
   *
   * @param name - The queue name (validated against the managed set).
   * @param body - Unvalidated body; parsed against the clean schema.
   * @returns The removed job ids.
   * @throws {BadRequestException} When the clean options are malformed.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Post(':name/clean')
  @HttpCode(HttpStatus.OK)
  async clean(@Param('name') name: string, @Body() body: unknown): Promise<{ removed: string[] }> {
    const { gracePeriodMs, limit, status } = parseRequest(cleanSchema, body)
    const removed = await this.adminQueues.clean(name, gracePeriodMs, limit, status)
    return { removed }
  }
}
