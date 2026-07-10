/**
 * @fileoverview Generic polling helper for timing-sensitive e2e assertions
 * (job completion, event-feed entries, scheduler ticks). Every timing-sensitive
 * spec uses this instead of a fixed `sleep`, so the suite runs as fast as the
 * real system allows while staying flake-free under load.
 * @layer test/support
 */

/** Options controlling a {@link waitFor} poll loop. */
export interface WaitForOptions {
  /** Maximum time to wait before failing, in milliseconds. Default: 5000. */
  timeoutMs?: number
  /** Delay between polls, in milliseconds. Default: 100. */
  intervalMs?: number
  /** Label folded into the timeout error, naming what was awaited. */
  label?: string
}

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_INTERVAL_MS = 100

/**
 * Poll `check` until it returns a truthy value or the timeout elapses.
 *
 * @param check - Probe returning the awaited value, or a falsy value while not
 *   yet ready.
 * @param options - Timeout, interval, and a label for the failure message.
 * @returns The first truthy value `check` produced.
 * @throws {Error} When the timeout elapses before `check` returns truthy.
 */
export async function waitFor<T>(
  check: () => Promise<T | undefined | null | false>,
  options: WaitForOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const result = await check()
    if (result) {
      return result
    }
    if (Date.now() >= deadline) {
      const suffix = options.label === undefined ? '' : ` (${options.label})`
      throw new Error(`waitFor timed out after ${String(timeoutMs)}ms${suffix}`)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
