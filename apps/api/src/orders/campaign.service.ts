/**
 * @fileoverview Campaign service exercising bulk enqueue and its guardrail. It
 * fans out N receipt emails in a single Redis roundtrip via `enqueueBulk`. The
 * library bounds the batch and throws `queue.bulk_enqueue_failed` before anything
 * is enqueued when the batch is too large; this service lets that typed exception
 * propagate untouched rather than catching and rewrapping it.
 * @layer app/orders
 */
import { Injectable } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import type { BulkJob } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB } from './order-jobs.constants.js'
import type { ReceiptEmailJobData, ReceiptEmailJobResult } from './order-jobs.types.js'

/** Outcome of a bulk campaign: how many jobs landed and their ids, in order. */
export interface CampaignResult {
  /** Number of jobs enqueued. */
  enqueued: number
  /** The created job ids, preserving input order. */
  jobIds: (string | undefined)[]
}

/** Fans out receipt-email campaigns via a single bulk enqueue. */
@Injectable()
export class CampaignService {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Bulk-enqueue `count` synthetic receipt emails in one roundtrip. An oversized
   * batch throws the library's `queue.bulk_enqueue_failed` before anything is
   * enqueued; that exception is allowed to propagate.
   *
   * @param count - Number of receipt jobs to enqueue.
   * @returns The number enqueued and the created job ids in input order.
   */
  async sendReceipts(count: number): Promise<CampaignResult> {
    const created = await this.queueService.enqueueBulk<ReceiptEmailJobData, ReceiptEmailJobResult>(
      EMAIL_QUEUE,
      this.buildJobs(count),
    )
    return { enqueued: created.length, jobIds: created.map((job) => job.id) }
  }

  /**
   * Build `count` synthetic receipt jobs, preserving order by index.
   *
   * @param count - Number of jobs to build.
   * @returns The bulk job descriptors.
   */
  private buildJobs(count: number): BulkJob<ReceiptEmailJobData>[] {
    const jobs: BulkJob<ReceiptEmailJobData>[] = []
    for (let index = 0; index < count; index += 1) {
      jobs.push({
        name: RECEIPT_JOB,
        data: {
          orderId: `campaign-${String(index)}`,
          to: `user-${String(index)}@example.com`,
          total: 0,
        },
      })
    }
    return jobs
  }
}
