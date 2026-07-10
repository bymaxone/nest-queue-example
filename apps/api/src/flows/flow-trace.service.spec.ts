/**
 * Unit tests for FlowTrace.
 *
 * Layer: unit.
 * Goal: node executions are recorded, in order, with a timestamp (the bounded ring
 * buffer's eviction and copy semantics are covered by its own suite).
 * Mocks: none (pure in-memory state).
 */
import { FlowTrace } from './flow-trace.service.js'

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
})
