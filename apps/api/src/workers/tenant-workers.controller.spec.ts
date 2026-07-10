/**
 * Unit tests for TenantWorkersController.
 *
 * Layer: unit.
 * Goal: the controller validates input at the boundary and delegates register,
 * list, notify, delivery-read, and remove to the service.
 * Mocks: TenantWorkersService (spies).
 */
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import type { Job } from '@bymax-one/nest-queue'
import { TenantWorkersController } from './tenant-workers.controller.js'
import { TenantWorkersService } from './tenant-workers.service.js'
import type { TenantDelivery, TenantWorkerView } from './tenant.types.js'

/** Build a controller over a spied service. */
function build(overrides: Record<string, unknown>): TenantWorkersController {
  return new TenantWorkersController(overrides as unknown as TenantWorkersService)
}

describe('TenantWorkersController (unit)', () => {
  it('registers a tenant worker and echoes the derived queue', () => {
    /*
     * Scenario: a valid register request.
     * Rule it protects: the validated tenant and tier reach the service and the
     * derived notifications.<tenantId> queue is returned.
     */
    const register = jest.fn()
    const controller = build({ register })

    const result = controller.register({ tenantId: 't1', tier: 'premium' })

    expect(register).toHaveBeenCalledWith('t1', 'premium')
    expect(result).toEqual({ tenantId: 't1', tier: 'premium', queue: 'notifications.t1' })
  })

  it('rejects a malformed tenant id or unknown tier on register', () => {
    /*
     * Scenario: a tenant id containing a colon, or an out-of-set tier.
     * Rule it protects: an id can never widen the queue namespace, and only known
     * tiers are accepted; both are safe 400s.
     */
    const controller = build({ register: jest.fn() })

    expect(() => controller.register({ tenantId: 'a:b', tier: 'premium' })).toThrow(
      BadRequestException,
    )
    expect(() => controller.register({ tenantId: 't1', tier: 'gold' })).toThrow(BadRequestException)
  })

  it('lists the registered tenant workers, forwarding an optional scope', () => {
    /*
     * Scenario: listing tenant workers with a scope query.
     * Rule it protects: the endpoint mirrors the service projection and forwards the
     * validated tenant id (or undefined) so scoped reads work.
     */
    const workers: TenantWorkerView[] = [
      { tenantId: 't1', queue: 'notifications.t1', tier: 'free' },
    ]
    const list = jest.fn(() => workers)
    const controller = build({ list })

    expect(controller.list({ tenantId: 't1' })).toEqual({ workers })
    expect(list).toHaveBeenCalledWith('t1')
  })

  it('rejects a malformed scope on list', () => {
    /*
     * Boundary: a scope query with an illegal tenant id.
     * Rule it protects: the scope is validated before the service is touched.
     */
    const controller = build({ list: jest.fn(() => []) })

    expect(() => controller.list({ tenantId: 'a:b' })).toThrow(BadRequestException)
  })

  it('returns the delivery trail, forwarding an optional scope', () => {
    /*
     * Scenario: reading deliveries with a scope query.
     * Rule it protects: the endpoint mirrors the service delivery trail and forwards
     * the validated tenant id so a scoped read is possible.
     */
    const deliveries: TenantDelivery[] = [{ tenantId: 't1', notification: 'hi', at: 1 }]
    const listDeliveries = jest.fn(() => deliveries)
    const controller = build({ listDeliveries })

    expect(controller.deliveries({})).toEqual({ deliveries })
    expect(listDeliveries).toHaveBeenCalledWith(undefined)
  })

  it('notifies a tenant and returns the enqueued job id', async () => {
    /*
     * Scenario: a valid notify request.
     * Rule it protects: the validated id and message reach the service and the job
     * id is returned so the caller can track it.
     */
    const notify = jest.fn<() => Promise<Job>>().mockResolvedValue({ id: 'job-9' } as Job)
    const controller = build({ notify })

    const result = await controller.notify('t1', { message: 'ping' })

    expect(notify).toHaveBeenCalledWith('t1', 'ping')
    expect(result).toEqual({ tenantId: 't1', jobId: 'job-9' })
  })

  it('rejects a malformed message on notify', async () => {
    /*
     * Boundary: an empty message.
     * Rule it protects: a notification must carry a non-empty message; an empty one
     * is a safe 400.
     */
    const controller = build({ notify: jest.fn() })

    await expect(controller.notify('t1', { message: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('removes a tenant worker and surfaces whether it existed', async () => {
    /*
     * Scenario: a valid remove request for a registered worker.
     * Rule it protects: the validated id reaches unregister and its existed result
     * is surfaced honestly.
     */
    const unregister = jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
    const controller = build({ unregister })

    const result = await controller.remove('t1')

    expect(unregister).toHaveBeenCalledWith('t1')
    expect(result).toEqual({ tenantId: 't1', unregistered: true })
  })

  it('rejects a malformed tenant id on remove', async () => {
    /*
     * Scenario: a remove request with an illegal id.
     * Rule it protects: the id is validated before the service is touched.
     */
    const controller = build({ unregister: jest.fn() })

    await expect(controller.remove('bad id')).rejects.toBeInstanceOf(BadRequestException)
  })
})
