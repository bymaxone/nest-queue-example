/**
 * Unit tests for HeartbeatTicks.
 *
 * Layer: unit.
 * Goal: ticks are recorded in order with a timestamp (the bounded ring buffer's
 * eviction and copy semantics are covered by its own suite).
 * Mocks: none (pure in-memory state).
 */
import { HeartbeatTicks } from './heartbeat-ticks.service.js'

describe('HeartbeatTicks (unit)', () => {
  it('records ticks in order with a timestamp', () => {
    /*
     * Scenario: two scheduled jobs fire.
     * Rule it protects: each firing is recorded with its job name so the scheduler
     * clock is observable.
     */
    const ticks = new HeartbeatTicks()

    ticks.record('heartbeat')
    ticks.record('metrics-snapshot')

    const recorded = ticks.list()
    expect(recorded.map((tick) => tick.job)).toEqual(['heartbeat', 'metrics-snapshot'])
    expect(typeof recorded[0]?.at).toBe('number')
  })
})
