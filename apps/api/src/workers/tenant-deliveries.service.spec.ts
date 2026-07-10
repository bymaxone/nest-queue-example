/**
 * Unit tests for TenantDeliveries.
 *
 * Layer: unit.
 * Goal: deliveries are recorded in order, memory is bounded, and the snapshot is a
 * copy.
 * Mocks: none (pure in-memory state).
 */
import { TenantDeliveries } from './tenant-deliveries.service.js'
import type { TenantDelivery } from './tenant.types.js'

/** One more than the internal capacity, to force a single eviction. */
const OVER_CAPACITY = 501

/** Build a delivery for tenant `id` with a sequential message. */
function delivery(id: string, index: number): TenantDelivery {
  return { tenantId: id, notification: `msg-${String(index)}`, at: index }
}

describe('TenantDeliveries (unit)', () => {
  it('records deliveries in order', () => {
    /*
     * Scenario: two tenants receive a notification each.
     * Rule it protects: deliveries are appended in the order they were consumed so
     * the trail reflects real consumption.
     */
    const deliveries = new TenantDeliveries()

    deliveries.record(delivery('t1', 0))
    deliveries.record(delivery('t2', 1))

    expect(deliveries.list().map((entry) => entry.tenantId)).toEqual(['t1', 't2'])
  })

  it('evicts the oldest delivery once capacity is exceeded', () => {
    /*
     * Boundary: recording one past the capacity.
     * Rule it protects: memory stays bounded no matter how many notifications flow.
     */
    const deliveries = new TenantDeliveries()

    for (let index = 0; index < OVER_CAPACITY; index += 1) {
      deliveries.record(delivery('t1', index))
    }

    const recorded = deliveries.list()
    expect(recorded).toHaveLength(OVER_CAPACITY - 1)
    expect(recorded[0]?.notification).toBe('msg-1')
  })

  it('returns a snapshot that cannot mutate the store', () => {
    /*
     * Scenario: a caller mutates the returned array.
     * Rule it protects: list() hands back a copy so external mutation never
     * corrupts the internal buffer.
     */
    const deliveries = new TenantDeliveries()
    deliveries.record(delivery('t1', 0))

    const snapshot = deliveries.list()
    ;(snapshot as unknown as { length: number }).length = 0

    expect(deliveries.list()).toHaveLength(1)
  })
})
