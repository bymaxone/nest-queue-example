/**
 * Unit tests for OrdersService.
 *
 * Layer: unit.
 * Goal: placing an order stores it and enqueues a typed send-receipt job (VIP
 * orders at priority 1); a reminder enqueues a delayed receipt for an existing
 * order and 404s for a missing one.
 * Mocks: QueueService (enqueue), OrdersRepository (save, find), AppEnv.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { NotFoundException } from '@nestjs/common'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import type { AppEnv } from '../config/env.js'
import { EMAIL_QUEUE, WEBHOOKS_QUEUE } from '../queues/queue-names.js'
import { ORDER_CREATED_JOB, RECEIPT_JOB, VIP_PRIORITY } from './order-jobs.constants.js'
import { OrdersService } from './orders.service.js'
import type { OrdersRepository, StoredOrder } from './orders.repository.js'

/** Reminder delay used by the fake environment. */
const REMINDER_DELAY_MS = 60000

/**
 * Build the service with mocked collaborators. `save` echoes its argument so the
 * test can read back the generated order id.
 *
 * @returns The service plus the enqueue, save, and find spies.
 */
function setup() {
  const enqueue =
    jest.fn<
      (queueName: string, jobName: string, data: unknown, options?: unknown) => Promise<Job>
    >()
  const save = jest.fn((order: StoredOrder): StoredOrder => order)
  const find = jest.fn<(id: string) => StoredOrder | undefined>()
  const queueService: Partial<QueueService> = { enqueue }
  const repository: Partial<OrdersRepository> = { save, find }
  const env = { REMINDER_DELAY_MS } as unknown as AppEnv
  const service = new OrdersService(
    queueService as QueueService,
    repository as OrdersRepository,
    env,
  )
  return { service, enqueue, save, find }
}

/** A stored order fixture. */
const storedOrder: StoredOrder = {
  id: 'order-1',
  to: 'a@b.co',
  total: 42,
  vip: false,
  createdAt: '2026-07-09T00:00:00.000Z',
}

describe('OrdersService (unit)', () => {
  it('stores the order and enqueues a typed receipt job at default priority', async () => {
    /*
     * Scenario: placing a standard (non-VIP) order.
     * Rule it protects: the order is persisted with a generated id and timestamp,
     * and a send-receipt job carrying the matching data is enqueued with no
     * priority override.
     */
    const { service, enqueue, save } = setup()
    enqueue.mockResolvedValue({ id: 'job-1' } as Partial<Job> as Job)

    const result = await service.place({ to: 'a@b.co', total: 42, vip: false })

    const storedId = save.mock.calls[0]?.[0].id
    expect(typeof storedId).toBe('string')
    expect(enqueue).toHaveBeenCalledWith(
      EMAIL_QUEUE,
      RECEIPT_JOB,
      { orderId: storedId, to: 'a@b.co', total: 42 },
      undefined,
    )
    expect(result).toEqual({ orderId: storedId, jobId: 'job-1' })
  })

  it('fans out an order-created webhook on placement', async () => {
    /*
     * Scenario: placing an order.
     * Rule it protects: besides the receipt email, an order-created webhook is
     * enqueued with no per-job overrides so it inherits the module's retry budget.
     */
    const { service, enqueue } = setup()
    enqueue.mockResolvedValue({ id: 'job-1' } as Partial<Job> as Job)

    const result = await service.place({ to: 'a@b.co', total: 42, vip: false })

    expect(enqueue).toHaveBeenCalledWith(WEBHOOKS_QUEUE, ORDER_CREATED_JOB, {
      orderId: result.orderId,
    })
  })

  it('enqueues a VIP order at the highest priority', async () => {
    /*
     * Scenario: placing a VIP order.
     * Rule it protects: vip maps to priority 1 so the receipt jumps ahead of
     * standard orders.
     */
    const { service, enqueue } = setup()
    enqueue.mockResolvedValue({ id: 'job-2' } as Partial<Job> as Job)

    await service.place({ to: 'vip@b.co', total: 99, vip: true })

    expect(enqueue).toHaveBeenCalledWith(EMAIL_QUEUE, RECEIPT_JOB, expect.any(Object), {
      priority: VIP_PRIORITY,
    })
  })

  it('enqueues a delayed reminder for an existing order', async () => {
    /*
     * Scenario: reminding about a known order.
     * Rule it protects: the reminder enqueues the receipt with the configured
     * delay so it lands in the delayed status.
     */
    const { service, enqueue, find } = setup()
    find.mockReturnValue(storedOrder)
    enqueue.mockResolvedValue({ id: 'job-3' } as Partial<Job> as Job)

    const result = await service.remind('order-1')

    expect(enqueue).toHaveBeenCalledWith(
      EMAIL_QUEUE,
      RECEIPT_JOB,
      { orderId: 'order-1', to: 'a@b.co', total: 42 },
      { delay: REMINDER_DELAY_MS },
    )
    expect(result).toEqual({ orderId: 'order-1', jobId: 'job-3' })
  })

  it('rejects a reminder for a missing order with 404', async () => {
    /*
     * Scenario: reminding about an unknown order.
     * Rule it protects: a missing order surfaces a NotFoundException and never
     * enqueues.
     */
    const { service, enqueue, find } = setup()
    find.mockReturnValue(undefined)

    const error = await service.remind('missing').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NotFoundException)
    // The stable envelope names the code, a safe message, and the requested id, so a
    // blanked body or message would leave the client without an actionable error.
    expect((error as NotFoundException).getResponse()).toEqual({
      error: {
        code: 'order_not_found',
        message: 'Order not found',
        details: { orderId: 'missing' },
      },
    })
    expect(enqueue).not.toHaveBeenCalled()
  })
})
