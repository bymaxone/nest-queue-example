/**
 * Unit tests for OrdersService.
 *
 * Layer: unit.
 * Goal: placing an order stores it and enqueues a typed send-receipt job whose
 * data mirrors the stored order, returning the stored id and the job id.
 * Mocks: QueueService.enqueue and OrdersRepository.save.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB } from './order-jobs.constants.js'
import { OrdersService } from './orders.service.js'
import type { OrdersRepository, StoredOrder } from './orders.repository.js'

/**
 * Build the service with mocked collaborators. `save` echoes its argument so the
 * test can read back the generated order id.
 *
 * @returns The service plus the enqueue and save spies.
 */
function setup() {
  const enqueue = jest.fn<(queueName: string, jobName: string, data: unknown) => Promise<Job>>()
  const save = jest.fn((order: StoredOrder): StoredOrder => order)
  const queueService: Partial<QueueService> = { enqueue }
  const repository: Partial<OrdersRepository> = { save }
  const service = new OrdersService(queueService as QueueService, repository as OrdersRepository)
  return { service, enqueue, save }
}

describe('OrdersService (unit)', () => {
  it('stores the order and enqueues a typed receipt job', async () => {
    /*
     * Scenario: placing a valid order.
     * Rule it protects: the order is persisted with a generated id and timestamp,
     * and a send-receipt job carrying the matching order data is enqueued onto the
     * email queue; the response reports both ids.
     */
    const { service, enqueue, save } = setup()
    enqueue.mockResolvedValue({ id: 'job-1' } as Partial<Job> as Job)

    const result = await service.place({ to: 'a@b.co', total: 42, vip: false })

    const storedId = save.mock.calls[0]?.[0].id
    expect(typeof storedId).toBe('string')
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.co',
        total: 42,
        vip: false,
        createdAt: expect.any(String),
      }),
    )
    expect(enqueue).toHaveBeenCalledWith(EMAIL_QUEUE, RECEIPT_JOB, {
      orderId: storedId,
      to: 'a@b.co',
      total: 42,
    })
    expect(result).toEqual({ orderId: storedId, jobId: 'job-1' })
  })
})
