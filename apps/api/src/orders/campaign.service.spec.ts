/**
 * Unit tests for CampaignService.
 *
 * Layer: unit.
 * Goal: a campaign builds one ordered send-receipt job per requested item and
 * bulk-enqueues them, preserving id order; an oversized batch lets the library's
 * bulk_enqueue_failed exception propagate with a single bulk call.
 * Mocks: QueueService.enqueueBulk.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { HttpStatus } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import type { BulkJob, Job } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB } from './order-jobs.constants.js'
import { CampaignService } from './campaign.service.js'

/**
 * Build the service with a mocked enqueueBulk.
 *
 * @returns The service plus the enqueueBulk spy.
 */
function setup() {
  const enqueueBulk = jest.fn<(queueName: string, jobs: readonly BulkJob[]) => Promise<Job[]>>()
  const queueService = { enqueueBulk } as unknown as import('@bymax-one/nest-queue').QueueService
  const service = new CampaignService(queueService)
  return { service, enqueueBulk }
}

describe('CampaignService (unit)', () => {
  it('bulk-enqueues ordered receipt jobs and returns their ids in order', async () => {
    /*
     * Scenario: a small campaign.
     * Rule it protects: one send-receipt job is built per item with an
     * index-stamped payload, and the returned ids preserve input order.
     */
    const { service, enqueueBulk } = setup()
    enqueueBulk.mockResolvedValue([
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ] as Partial<Job>[] as Job[])

    const result = await service.sendReceipts(3)

    const [queueName, jobs] = enqueueBulk.mock.calls[0] ?? []
    expect(queueName).toBe(EMAIL_QUEUE)
    expect(jobs).toHaveLength(3)
    expect(jobs?.[0]).toEqual({
      name: RECEIPT_JOB,
      data: { orderId: 'campaign-0', to: 'user-0@example.com', total: 0 },
    })
    expect(result).toEqual({ enqueued: 3, jobIds: ['1', '2', '3'] })
  })

  it('lets the bulk_enqueue_failed exception propagate for an oversized batch', async () => {
    /*
     * Scenario: a batch above the library cap.
     * Rule it protects: the service does not catch-and-rewrap; the typed
     * bulk_enqueue_failed exception propagates and only one bulk call is made.
     */
    const { service, enqueueBulk } = setup()
    enqueueBulk.mockRejectedValue(
      new QueueException(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, HttpStatus.INTERNAL_SERVER_ERROR, {
        size: 1001,
      }),
    )

    await expect(service.sendReceipts(1001)).rejects.toBeInstanceOf(QueueException)
    expect(enqueueBulk).toHaveBeenCalledTimes(1)
    expect(enqueueBulk.mock.calls[0]?.[1]).toHaveLength(1001)
  })
})
