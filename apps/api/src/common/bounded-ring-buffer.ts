/**
 * @fileoverview Generic bounded ring buffer: a fixed-capacity in-memory list that
 * evicts the oldest entry once full and hands back defensive-copy snapshots. Shared
 * by the demo observation trails (flow trace, scheduler ticks, tenant deliveries)
 * so the eviction and copy semantics live in exactly one place.
 * @layer app/common
 */

/** A fixed-capacity in-memory buffer that drops its oldest entry when full. */
export class BoundedRingBuffer<T> {
  private readonly items: T[] = []

  /**
   * @param capacity - Maximum number of entries retained before eviction begins.
   */
  constructor(private readonly capacity: number) {}

  /**
   * Append an entry, evicting the oldest once capacity is exceeded so memory stays
   * bounded no matter how many entries are pushed.
   *
   * @param item - The entry to append.
   */
  push(item: T): void {
    this.items.push(item)
    if (this.items.length > this.capacity) {
      this.items.shift()
    }
  }

  /**
   * Return a snapshot of the retained entries, oldest first.
   *
   * @returns A copy of the current entries; mutating it never affects the buffer.
   */
  snapshot(): readonly T[] {
    return [...this.items]
  }
}
