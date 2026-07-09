/**
 * @fileoverview Pure factory that maps the validated environment to the queue
 * library's module options. No `process.env` access and no side effects, so it
 * is fully unit-testable and is the single copy of the canonical wiring. The
 * connection resolves to the library-owned URL form (Mode B); the bring-your-own
 * client and host/port option shapes are layered on when their env-driven
 * branches are added.
 * @layer app/config
 */
import type { BymaxQueueModuleOptions } from '@bymax-one/nest-queue'
import type { AppEnv } from './env.js'

/** Retry budget applied to every job; individual enqueues may still override it. */
const DEFAULT_JOB_ATTEMPTS = 4
/** Base delay (ms) for the exponential backoff between retries. */
const BACKOFF_BASE_DELAY_MS = 1500
/** Metrics cache TTL (ms); short so dashboard reads stay near real time. */
const METRICS_CACHE_TTL_MS = 3000

/**
 * Build the queue library options from the parsed environment.
 *
 * @param env - The validated, frozen application environment.
 * @returns Module options with a Mode B URL connection, key prefix, default job
 *   options, flows and metrics enabled, and the shutdown drain budget.
 */
export function buildQueueOptions(env: AppEnv): BymaxQueueModuleOptions {
  return {
    connection: { url: env.REDIS_URL },
    prefix: env.QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: DEFAULT_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: BACKOFF_BASE_DELAY_MS },
    },
    flows: { enabled: true },
    metrics: { enabled: true, cacheTtlMs: METRICS_CACHE_TTL_MS },
    shutdown: {
      drainTimeoutMs: env.QUEUE_DRAIN_TIMEOUT_MS,
      drainOnShutdown: env.QUEUE_DRAIN_ON_SHUTDOWN,
    },
  }
}
