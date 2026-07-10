/**
 * Unit tests for BoundedRingBuffer.
 *
 * Layer: unit.
 * Goal: entries are appended in order, the oldest is evicted past capacity, and
 * the snapshot is a defensive copy.
 * Mocks: none (pure in-memory state).
 */
import { BoundedRingBuffer } from './bounded-ring-buffer.js'

describe('BoundedRingBuffer (unit)', () => {
  it('appends entries in order', () => {
    /*
     * Scenario: two entries pushed in sequence.
     * Rule it protects: the buffer preserves insertion order.
     */
    const buffer = new BoundedRingBuffer<string>(10)

    buffer.push('a')
    buffer.push('b')

    expect(buffer.snapshot()).toEqual(['a', 'b'])
  })

  it('evicts the oldest entry once capacity is exceeded', () => {
    /*
     * Boundary: pushing one past the capacity.
     * Rule it protects: memory stays bounded, dropping the oldest and keeping the
     * newest.
     */
    const buffer = new BoundedRingBuffer<number>(2)

    buffer.push(1)
    buffer.push(2)
    buffer.push(3)

    expect(buffer.snapshot()).toEqual([2, 3])
  })

  it('returns a snapshot that cannot mutate the buffer', () => {
    /*
     * Scenario: a caller mutates the returned array.
     * Rule it protects: snapshot() hands back a copy, so external mutation never
     * corrupts the internal storage.
     */
    const buffer = new BoundedRingBuffer<string>(10)
    buffer.push('a')

    const snapshot = buffer.snapshot()
    ;(snapshot as unknown as { length: number }).length = 0

    expect(buffer.snapshot()).toHaveLength(1)
  })
})
