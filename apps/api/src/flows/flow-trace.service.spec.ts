/**
 * Unit tests for FlowTrace.
 *
 * Layer: unit.
 * Goal: the trace records node executions in order, bounds its memory, and hands
 * back an immutable snapshot.
 * Mocks: none (pure in-memory state).
 */
import { FlowTrace } from './flow-trace.service.js'

/** One more than the internal ring-buffer capacity, to force a single eviction. */
const OVER_CAPACITY = 501

describe('FlowTrace (unit)', () => {
  it('records nodes in call order with a timestamp', () => {
    /*
     * Scenario: two nodes run in sequence.
     * Rule it protects: the trace preserves execution order so a reader can see
     * children recorded before their parent.
     */
    const trace = new FlowTrace()

    trace.record('reserve-stock')
    trace.record('ship-order')

    const entries = trace.list()
    expect(entries.map((entry) => entry.node)).toEqual(['reserve-stock', 'ship-order'])
    expect(typeof entries[0]?.at).toBe('number')
  })

  it('evicts the oldest entry once capacity is exceeded', () => {
    /*
     * Boundary: recording one past the capacity.
     * Rule it protects: memory stays bounded no matter how many flows run, so the
     * oldest entry is dropped and the newest is kept.
     */
    const trace = new FlowTrace()

    for (let index = 0; index < OVER_CAPACITY; index += 1) {
      trace.record(`node-${String(index)}`)
    }

    const entries = trace.list()
    expect(entries).toHaveLength(OVER_CAPACITY - 1)
    expect(entries[0]?.node).toBe('node-1')
    expect(entries.at(-1)?.node).toBe(`node-${String(OVER_CAPACITY - 1)}`)
  })

  it('returns a snapshot that cannot mutate the trace', () => {
    /*
     * Scenario: a caller mutates the returned array.
     * Rule it protects: list() hands back a copy, so external mutation never
     * corrupts the internal buffer.
     */
    const trace = new FlowTrace()
    trace.record('ship-order')

    const snapshot = trace.list()
    ;(snapshot as unknown as { length: number }).length = 0

    expect(trace.list()).toHaveLength(1)
  })
})
