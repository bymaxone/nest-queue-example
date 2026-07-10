/**
 * @fileoverview Small promise-based delay helper shared by the long-running
 * processors that simulate staged work. Isolated so its timing can be driven by
 * fake timers in unit tests without pulling in a dependency.
 * @layer app/timing
 */

/**
 * Resolve after the given number of milliseconds.
 *
 * @param ms - Delay in milliseconds before the returned promise resolves.
 * @returns A promise that resolves once the delay elapses.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
