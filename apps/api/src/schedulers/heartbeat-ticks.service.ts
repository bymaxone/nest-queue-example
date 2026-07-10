/**
 * @fileoverview In-memory record of monitoring scheduler ticks: a bounded ring
 * buffer the heartbeat processor appends to as scheduled jobs fire, making the
 * scheduler clock observable without Redis access. Demo-only state; the entries
 * carry only a job name and a timestamp, never secrets.
 * @layer app/schedulers
 */
import { Injectable } from '@nestjs/common'
import type { SchedulerTick } from './scheduler.types.js'

/** Maximum number of ticks retained; older ticks are evicted first. */
const TICKS_CAPACITY = 200

/** Bounded, in-memory store of recorded scheduler ticks. */
@Injectable()
export class HeartbeatTicks {
  private readonly ticks: SchedulerTick[] = []

  /**
   * Record a scheduler tick, evicting the oldest once capacity is exceeded so
   * memory stays bounded no matter how long the app runs.
   *
   * @param job - The monitoring job name that fired.
   */
  record(job: string): void {
    this.ticks.push({ job, at: Date.now() })
    if (this.ticks.length > TICKS_CAPACITY) {
      this.ticks.shift()
    }
  }

  /**
   * Return a snapshot of the recorded ticks, oldest first.
   *
   * @returns A copy of the current ticks; mutating it never affects the store.
   */
  list(): readonly SchedulerTick[] {
    return [...this.ticks]
  }
}
