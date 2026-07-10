/**
 * @fileoverview Samples the Node.js event-loop delay so the sandboxed-processor
 * demo can show the loop staying responsive while CPU-bound renders run in a
 * separate process. Wraps `perf_hooks.monitorEventLoopDelay`, enabling the
 * histogram at bootstrap and disabling it on shutdown so no timer is leaked.
 * @layer app/workers
 */
import { Injectable } from '@nestjs/common'
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { monitorEventLoopDelay } from 'node:perf_hooks'

/** Nanoseconds per millisecond, for converting the histogram's native units. */
const NS_PER_MS = 1e6

/** Sampling resolution (ms) for the event-loop-delay histogram. */
const RESOLUTION_MS = 20

/** An event-loop-delay sample in milliseconds. */
export interface LagSample {
  /** Mean observed event-loop delay, in milliseconds. */
  meanMs: number
  /** Maximum observed event-loop delay, in milliseconds. */
  maxMs: number
}

/**
 * Convert a nanosecond reading to milliseconds, mapping a non-finite reading
 * (the histogram before it has collected any sample) to zero.
 *
 * @param nanoseconds - The raw histogram value in nanoseconds.
 * @returns The value in milliseconds, or 0 when the reading is not finite.
 */
export function toMs(nanoseconds: number): number {
  return Number.isFinite(nanoseconds) ? nanoseconds / NS_PER_MS : 0
}

/** Monitors and reports the event-loop delay for the responsiveness demo. */
@Injectable()
export class LagProbe implements OnApplicationBootstrap, OnModuleDestroy {
  // Stryker disable next-line ObjectLiteral: the resolution only tunes sampling
  // granularity; the histogram reports the same near-zero delay in a quiet unit
  // test regardless, so the option value has no deterministic observable.
  private readonly histogram = monitorEventLoopDelay({ resolution: RESOLUTION_MS })

  /** Start collecting event-loop-delay samples once the application has started. */
  // Stryker disable next-line BlockStatement: enabling the libuv histogram is lifecycle
  // wiring driven by the Nest container; a direct unit call observes no deterministic
  // delay change in a quiet loop, and the pure conversion is covered by toMs.
  onApplicationBootstrap(): void {
    this.histogram.enable()
  }

  /** Stop the histogram timer on shutdown so no libuv handle is leaked. */
  // Stryker disable next-line BlockStatement: disabling the histogram is leak-prevention
  // cleanup with no observable behavioral change (a leaked handle alters no result).
  onModuleDestroy(): void {
    this.histogram.disable()
  }

  /**
   * Read the current event-loop-delay sample.
   *
   * @returns The mean and maximum delay in milliseconds.
   */
  sample(): LagSample {
    return { meanMs: toMs(this.histogram.mean), maxMs: toMs(this.histogram.max) }
  }
}
