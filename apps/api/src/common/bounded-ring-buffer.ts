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
  /** Index of the oldest slot (the next to be overwritten) once at capacity. */
  private head = 0

  /**
   * @param capacity - Maximum number of entries retained before eviction begins.
   */
  constructor(private readonly capacity: number) {}

  /**
   * Append an entry in constant time, overwriting the oldest slot once at capacity
   * so memory stays bounded no matter how many entries are pushed.
   *
   * @param item - The entry to append.
   */
  push(item: T): void {
    if (this.items.length < this.capacity) {
      this.items.push(item)
      return
    }
    this.items[this.head] = item
    this.head = (this.head + 1) % this.capacity
  }

  /**
   * Return a snapshot of the retained entries, oldest first.
   *
   * @returns A copy of the current entries; mutating it never affects the buffer.
   */
  snapshot(): readonly T[] {
    if (this.items.length < this.capacity) {
      return [...this.items]
    }
    return [...this.items.slice(this.head), ...this.items.slice(0, this.head)]
  }
}
