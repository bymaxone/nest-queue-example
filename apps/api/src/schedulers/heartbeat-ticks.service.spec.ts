/**
 * Unit tests for HeartbeatTicks.
 *
 * Layer: unit.
 * Goal: ticks are recorded in order, memory is bounded, and the snapshot is a copy.
 * Mocks: none (pure in-memory state).
 */
import { HeartbeatTicks } from './heartbeat-ticks.service.js'

/** One more than the internal capacity, to force a single eviction. */
const OVER_CAPACITY = 201

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

  it('evicts the oldest tick once capacity is exceeded', () => {
    /*
     * Boundary: recording one past the capacity.
     * Rule it protects: memory stays bounded over a long-running app, dropping the
     * oldest tick and keeping the newest.
     */
    const ticks = new HeartbeatTicks()

    for (let index = 0; index < OVER_CAPACITY; index += 1) {
      ticks.record(`tick-${String(index)}`)
    }

    const recorded = ticks.list()
    expect(recorded).toHaveLength(OVER_CAPACITY - 1)
    expect(recorded[0]?.job).toBe('tick-1')
  })

  it('returns a snapshot that cannot mutate the store', () => {
    /*
     * Scenario: a caller mutates the returned array.
     * Rule it protects: list() hands back a copy so external mutation never
     * corrupts the internal buffer.
     */
    const ticks = new HeartbeatTicks()
    ticks.record('heartbeat')

    const snapshot = ticks.list()
    ;(snapshot as unknown as { length: number }).length = 0

    expect(ticks.list()).toHaveLength(1)
  })
})
