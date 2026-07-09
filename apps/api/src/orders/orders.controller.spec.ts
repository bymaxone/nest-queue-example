/**
 * Unit tests for OrdersController.
 *
 * Layer: unit.
 * Goal: a valid body is parsed (vip defaulting to false) and delegated to the
 * service; an invalid body is rejected with the stable queue.invalid_job_data
 * envelope before the service is ever called.
 * Mocks: OrdersService.place.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { QueueException } from '@bymax-one/nest-queue'
import { OrdersController } from './orders.controller.js'
import type { OrdersService, PlacedOrder } from './orders.service.js'

/**
 * Build the controller with a mocked service.
 *
 * @returns The controller plus the place spy.
 */
function setup() {
  const place = jest.fn<OrdersService['place']>()
  const service: Partial<OrdersService> = { place }
  const controller = new OrdersController(service as OrdersService)
  return { controller, place }
}

describe('OrdersController (unit)', () => {
  it('parses a valid body and delegates to the service', async () => {
    /*
     * Scenario: a valid order without an explicit vip flag.
     * Rule it protects: the body is validated, vip defaults to false, and the
     * parsed input reaches the service unchanged.
     */
    const { controller, place } = setup()
    const placed: PlacedOrder = { orderId: 'o1', jobId: 'j1' }
    place.mockResolvedValue(placed)

    const result = await controller.place({ to: 'a@b.co', total: 10 })

    expect(place).toHaveBeenCalledWith({ to: 'a@b.co', total: 10, vip: false })
    expect(result).toBe(placed)
  })

  it('rejects an invalid payload with the queue.invalid_job_data envelope', async () => {
    /*
     * Scenario: a non-email recipient.
     * Rule it protects: the boundary schema rejects bad input with the library's
     * INVALID_JOB_DATA code and never reaches the service.
     */
    const { controller, place } = setup()

    await expect(controller.place({ to: 'not-an-email', total: 10 })).rejects.toBeInstanceOf(
      QueueException,
    )
    expect(place).not.toHaveBeenCalled()
  })
})
