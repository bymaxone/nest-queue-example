/**
 * Unit tests for TenantDeliveries.
 *
 * Layer: unit.
 * Goal: deliveries are recorded in order (the bounded ring buffer's eviction and
 * copy semantics are covered by its own suite).
 * Mocks: none (pure in-memory state).
 */
import { TenantDeliveries } from './tenant-deliveries.service.js'
import type { TenantDelivery } from './tenant.types.js'

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
})
