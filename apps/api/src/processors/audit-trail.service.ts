/**
 * @fileoverview In-memory audit trail: a bounded ring buffer that records the
 * entries produced by the audit processor. Demo-only state (no database - the
 * library is Redis-only and persistence would blur the example's focus).
 * @layer app/processors
 */
import { Injectable } from '@nestjs/common'
import type { AuditEntry } from './audit.types.js'

/** Maximum number of entries retained; older entries are evicted first. */
const RING_BUFFER_CAPACITY = 100

/** Bounded, in-memory store of processed audit entries. */
@Injectable()
export class AuditTrail {
  private readonly entries: AuditEntry[] = []

  /**
   * Append an entry, evicting the oldest once the capacity is exceeded so memory
   * stays bounded no matter how many jobs run.
   *
   * @param entry - The processed entry to record.
   */
  append(entry: AuditEntry): void {
    this.entries.push(entry)
    if (this.entries.length > RING_BUFFER_CAPACITY) {
      this.entries.shift()
    }
  }

  /**
   * Return a snapshot of the recorded entries, newest last.
   *
   * @returns A copy of the current entries; mutating it never affects the trail.
   */
  list(): readonly AuditEntry[] {
    return [...this.entries]
  }
}
