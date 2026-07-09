/**
 * @fileoverview Deduplication inspector. Wraps BullMQ's native
 * `getDeduplicationJobId` / `removeDeduplicationKey` so a dedup key can be viewed
 * and cleared without the dashboard. The queue name is validated against the
 * managed allow-list; the key is bounded at the trust boundary.
 * @layer app/admin
 */
import { Controller, Delete, Get, Param } from '@nestjs/common'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { AdminQueuesService } from './queues.service.js'

/** Bounds the dedup key path param; keys may legitimately contain colons. */
const dedupKeySchema = z.string().min(1).max(256)

/** View and clear deduplication keys on a managed queue. */
@Controller('admin/dedup')
export class DedupController {
  constructor(private readonly adminQueues: AdminQueuesService) {}

  /**
   * Return the job id currently registered for a deduplication key, or null.
   *
   * @param queue - Target queue name (validated against the managed set).
   * @param id - The deduplication key.
   * @returns The registered job id, or null when the key is not set.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   * @throws {BadRequestException} When the key is malformed.
   */
  @Get(':queue/:id')
  async view(
    @Param('queue') queue: string,
    @Param('id') id: unknown,
  ): Promise<{ jobId: string | null }> {
    const key = parseRequest(dedupKeySchema, id)
    const jobId = await this.adminQueues.getManagedQueue(queue).getDeduplicationJobId(key)
    return { jobId }
  }

  /**
   * Clear a deduplication key so the next enqueue creates a fresh job.
   *
   * @param queue - Target queue name (validated against the managed set).
   * @param id - The deduplication key to remove.
   * @returns Whether a key was removed.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   * @throws {BadRequestException} When the key is malformed.
   */
  @Delete(':queue/:id')
  async clear(
    @Param('queue') queue: string,
    @Param('id') id: unknown,
  ): Promise<{ removed: boolean }> {
    const key = parseRequest(dedupKeySchema, id)
    const removed = await this.adminQueues.getManagedQueue(queue).removeDeduplicationKey(key)
    return { removed: removed > 0 }
  }
}
