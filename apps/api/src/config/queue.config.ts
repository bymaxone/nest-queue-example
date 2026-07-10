/**
 * @fileoverview Pure factory that maps the validated environment to the queue
 * library's module options. No `process.env` access and no side effects, so it is
 * fully unit-testable and is the single copy of the canonical wiring. The
 * connection resolves the full spec union: an app-owned client (Mode A, when a
 * shared client is provided), a host/port options object (Mode B options style),
 * or a URL (Mode B url style, the default).
 * @layer app/config
 */
import type { BymaxQueueModuleOptions, QueueConnectionConfig } from '@bymax-one/nest-queue'
import type { Redis, RedisOptions } from 'ioredis'
import type { AppEnv } from './env.js'

/** Retry budget applied to every job; individual enqueues may still override it. */
const DEFAULT_JOB_ATTEMPTS = 4
/** Base delay (ms) for the exponential backoff between retries. */
const BACKOFF_BASE_DELAY_MS = 1500
/** Metrics cache TTL (ms); short so dashboard reads stay near real time. */
const METRICS_CACHE_TTL_MS = 3000
/** Default Redis port when a URL omits it. */
const DEFAULT_REDIS_PORT = 6379

/**
 * Parse a Redis URL into a discrete `RedisOptions` object (Mode B options style).
 * Credentials are carried through untouched for the library to use and are never
 * logged or surfaced.
 *
 * @param url - The Redis connection URL.
 * @returns The equivalent host/port/db options, with auth and TLS when present.
 */
export function parseRedisOptions(url: string): RedisOptions {
  const parsed = new URL(url)
  const db = parsed.pathname.replace('/', '')
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? DEFAULT_REDIS_PORT : Number(parsed.port),
    ...(db === '' ? {} : { db: Number(db) }),
    ...(parsed.username === '' ? {} : { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password === '' ? {} : { password: decodeURIComponent(parsed.password) }),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

/**
 * Select the connection arm per the spec §9.1 union with precedence
 * client > options > url: an injected client (Mode A) wins, then the options
 * style, then the default URL (Mode B).
 *
 * @param env - The validated environment.
 * @param sharedClient - The app-owned Mode A client, when in `shared` mode.
 * @returns The chosen connection configuration.
 */
function selectConnection(env: AppEnv, sharedClient?: Redis): QueueConnectionConfig {
  if (env.QUEUE_CONNECTION_MODE === 'shared' && sharedClient !== undefined) {
    return { client: sharedClient }
  }
  if (env.QUEUE_CONNECTION_STYLE === 'options') {
    return { options: parseRedisOptions(env.REDIS_URL) }
  }
  return { url: env.REDIS_URL }
}

/**
 * Build the queue library options from the parsed environment.
 *
 * @param env - The validated, frozen application environment.
 * @param sharedClient - The app-owned Mode A client injected in `shared` mode.
 * @returns Module options with the resolved connection, key prefix, default job
 *   options, flows and metrics enabled, and the shutdown drain budget.
 */
export function buildQueueOptions(env: AppEnv, sharedClient?: Redis): BymaxQueueModuleOptions {
  return {
    connection: selectConnection(env, sharedClient),
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
