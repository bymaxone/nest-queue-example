/**
 * Unit tests for AuditTrail.
 *
 * Layer: unit.
 * Goal: appends record in order, the ring buffer evicts at capacity, and list
 * returns an isolated snapshot.
 * Mocks: none - the store is pure in-memory state.
 */
import { AuditTrail } from './audit-trail.service.js'

describe('AuditTrail (unit)', () => {
  it('appends entries and lists them oldest-first', () => {
    /*
     * Scenario: two appends below capacity.
     * Rule it protects: entries are retained in insertion order (the eviction
     * branch is not taken while under capacity).
     */
    const trail = new AuditTrail()
    trail.append({ at: 't1', payload: 'a' })
    trail.append({ at: 't2', payload: 'b' })
    expect(trail.list()).toEqual([
      { at: 't1', payload: 'a' },
      { at: 't2', payload: 'b' },
    ])
  })

  it('evicts the oldest entry once the 100-entry capacity is exceeded', () => {
    /*
     * Scenario: 101 appends.
     * Rule it protects: the buffer stays bounded at 100 by dropping the oldest
     * entry, so a long-running demo never leaks memory.
     */
    const trail = new AuditTrail()
    for (let i = 0; i <= 100; i += 1) {
      trail.append({ at: `t${String(i)}`, payload: `p${String(i)}` })
    }
    const entries = trail.list()
    expect(entries).toHaveLength(100)
    expect(entries[0]).toEqual({ at: 't1', payload: 'p1' })
    expect(entries[99]).toEqual({ at: 't100', payload: 'p100' })
  })

  it('returns a fresh snapshot on every call', () => {
    /*
     * Scenario: two reads of the trail.
     * Rule it protects: list returns a copy, so a caller mutating the result cannot
     * corrupt the internal store.
     */
    const trail = new AuditTrail()
    trail.append({ at: 't', payload: 'x' })
    expect(trail.list()).not.toBe(trail.list())
    expect(trail.list()).toEqual([{ at: 't', payload: 'x' }])
  })
})
