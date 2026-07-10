/**
 * Unit tests for the tenant queue-name derivation.
 *
 * Layer: unit.
 * Goal: the derived queue name is BullMQ-safe. BullMQ rejects a colon in a queue
 * name, so a prefix that reintroduced one would silently break tenant worker
 * registration and enqueue at runtime (the failure the class-reflection mocks in
 * the service tests do not exercise).
 * Mocks: none.
 */
import { TENANT_QUEUE_PREFIX, tenantQueueName } from './tenant.constants.js'

describe('tenantQueueName', () => {
  it('derives the fixed prefix plus the validated id', () => {
    // Scenario: list() slices the id back off this exact prefix, so the shape must hold.
    expect(tenantQueueName('tenant-a')).toBe(`${TENANT_QUEUE_PREFIX}tenant-a`)
  })

  it('never contains a colon, which BullMQ rejects in a queue name', () => {
    // Scenario: a ':' would make every Worker/Queue construction throw
    // "Queue name cannot contain :", breaking registration for every tenant.
    expect(TENANT_QUEUE_PREFIX).not.toContain(':')
    expect(tenantQueueName('tenant-a')).not.toContain(':')
  })
})
