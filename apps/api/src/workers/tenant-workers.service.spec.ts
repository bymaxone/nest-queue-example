/**
 * Unit tests for TenantWorkersService.
 *
 * Layer: unit.
 * Goal: registration maps the tier to concurrency and a recording handler,
 * unregister tears the worker down, the list projection derives tenants from the
 * registry and enriches tier, and notify enqueues onto the tenant queue.
 * Mocks: WorkerRegistry, QueueService, TenantDeliveries (spies).
 */
import { jest } from '@jest/globals'
import type { Job, QueueService, WorkerRegistry } from '@bymax-one/nest-queue'
import { TenantDeliveries } from './tenant-deliveries.service.js'
import { TenantWorkersService } from './tenant-workers.service.js'
import type { NotificationData, TenantDelivery } from './tenant.types.js'

/** The registration config the service passes to WorkerRegistry.register. */
interface RegisterConfig {
  queueName: string
  handler: (job: Job<NotificationData, TenantDelivery>) => Promise<TenantDelivery>
  options: { concurrency: number }
}

/** Spied collaborators plus the service under test. */
interface Harness {
  service: TenantWorkersService
  register: jest.Mock
  unregister: jest.Mock
  enqueue: jest.Mock
  record: jest.Mock
  list: jest.Mock
  deliveriesList: jest.Mock
}

/** Build the service over spied registry, queue service, and delivery store. */
function build(registryQueues: string[] = [], recorded: TenantDelivery[] = []): Harness {
  const register = jest.fn()
  const unregister = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const list = jest.fn(() => registryQueues)
  const enqueue = jest.fn<() => Promise<Job>>().mockResolvedValue({ id: 'job-1' } as Job)
  const record = jest.fn()
  const deliveriesList = jest.fn(() => recorded)
  const registry = { register, unregister, list } as unknown as WorkerRegistry
  const queueService = { enqueue } as unknown as QueueService
  const deliveries = { record, list: deliveriesList } as unknown as TenantDeliveries
  return {
    service: new TenantWorkersService(registry, queueService, deliveries),
    register,
    unregister,
    enqueue,
    record,
    list,
    deliveriesList,
  }
}

describe('TenantWorkersService (unit)', () => {
  it('registers a premium worker at concurrency 10 on the tenant queue', () => {
    /*
     * Scenario: registering a premium tenant.
     * Rule it protects: the tier maps to concurrency 10 and the worker consumes the
     * derived notifications:<tenantId> queue (row 47).
     */
    const harness = build()

    harness.service.register('t1', 'premium')

    const config = harness.register.mock.calls[0]?.[0] as RegisterConfig
    expect(config.queueName).toBe('notifications:t1')
    expect(config.options.concurrency).toBe(10)
  })

  it('registers a free worker at concurrency 2', () => {
    /*
     * Scenario: registering a free tenant.
     * Rule it protects: the free tier maps to concurrency 2.
     */
    const harness = build()

    harness.service.register('t2', 'free')

    const config = harness.register.mock.calls[0]?.[0] as RegisterConfig
    expect(config.options.concurrency).toBe(2)
  })

  it('records a delivery when the worker handler runs', async () => {
    /*
     * Scenario: the dynamic worker consumes a notification.
     * Rule it protects: the handler records { tenantId, notification, at } into the
     * delivery trail and returns it.
     */
    const harness = build()
    harness.service.register('t1', 'premium')
    const config = harness.register.mock.calls[0]?.[0] as RegisterConfig

    const result = await config.handler({ data: { message: 'hello' } } as Job<
      NotificationData,
      TenantDelivery
    >)

    expect(harness.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', notification: 'hello' }),
    )
    expect(result).toMatchObject({ tenantId: 't1', notification: 'hello' })
  })

  it('unregisters the tenant worker by its queue name', async () => {
    /*
     * Scenario: removing a tenant worker.
     * Rule it protects: unregister stops consumption by tearing down the worker for
     * the tenant's queue (row 48).
     */
    const harness = build()

    await harness.service.unregister('t1')

    expect(harness.unregister).toHaveBeenCalledWith('notifications:t1')
  })

  it('projects only tenant workers from the registry and enriches known tiers', () => {
    /*
     * Scenario: listing while unrelated workers exist in the registry.
     * Rule it protects: the list derives from registry.list(), keeps only the
     * notifications:* queues, and attaches each registered tier (null when unknown)
     * (row 48).
     */
    const harness = build(['email', 'notifications:t1', 'notifications:t2', 'invoices'])
    harness.service.register('t1', 'premium')

    expect(harness.service.list()).toEqual([
      { tenantId: 't1', queue: 'notifications:t1', tier: 'premium' },
      { tenantId: 't2', queue: 'notifications:t2', tier: null },
    ])
  })

  it('enqueues a notification onto the tenant queue', async () => {
    /*
     * Scenario: notifying a tenant.
     * Rule it protects: the message is enqueued onto notifications:<tenantId> so the
     * dynamic worker consumes it.
     */
    const harness = build()

    const job = await harness.service.notify('t1', 'ping')

    expect(harness.enqueue).toHaveBeenCalledWith('notifications:t1', 'notify', { message: 'ping' })
    expect(job.id).toBe('job-1')
  })

  it('exposes the delivery trail from the store', () => {
    /*
     * Scenario: reading the delivery trail.
     * Rule it protects: the service mirrors the delivery store so the trail is
     * observable through the workers surface.
     */
    const recorded: TenantDelivery[] = [{ tenantId: 't1', notification: 'hello', at: 1 }]
    const harness = build([], recorded)

    expect(harness.service.listDeliveries()).toEqual(recorded)
    expect(harness.deliveriesList).toHaveBeenCalledTimes(1)
  })
})
