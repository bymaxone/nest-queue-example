/**
 * Unit tests for buildQueueOptions and parseRedisOptions.
 *
 * Layer: unit.
 * Goal: every field of the canonical wiring maps from the parsed environment and
 * the connection resolves each arm of the spec union (client > options > url).
 * Mocks: none - the factory is pure; the env is produced by parseEnv on a literal.
 */
import 'reflect-metadata'
import type { Redis } from 'ioredis'
import { parseEnv } from './env.js'
import { buildQueueOptions, parseRedisOptions } from './queue.config.js'

/** A parsed env with non-default values so each mapping is observable. */
const env = parseEnv({
  REDIS_URL: 'redis://cache:6390/3',
  QUEUE_PREFIX: 'tenant-a',
  QUEUE_DRAIN_TIMEOUT_MS: '4200',
  QUEUE_DRAIN_ON_SHUTDOWN: 'true',
})

describe('buildQueueOptions (unit)', () => {
  it('resolves the Mode B url connection from REDIS_URL', () => {
    /*
     * Scenario: the default (own / url) connection style.
     * Rule it protects: the connection is the library-owned `{ url }` arm carrying
     * REDIS_URL, never a client or a host/port options object.
     */
    expect(buildQueueOptions(env).connection).toEqual({ url: 'redis://cache:6390/3' })
  })

  it('resolves the Mode B options connection when the style is options', () => {
    /*
     * Scenario: QUEUE_CONNECTION_STYLE=options.
     * Rule it protects: the connection is the `{ options }` arm carrying the parsed
     * host/port/db, exercising the options branch of the union.
     */
    const optionsEnv = parseEnv({
      REDIS_URL: 'redis://cache:6390/3',
      QUEUE_CONNECTION_STYLE: 'options',
    })
    expect(buildQueueOptions(optionsEnv).connection).toEqual({
      options: { host: 'cache', port: 6390, db: 3 },
    })
  })

  it('resolves the Mode A client connection when a shared client is provided', () => {
    /*
     * Scenario: QUEUE_CONNECTION_MODE=shared with an injected client.
     * Rule it protects: the app-owned client wins (client > options > url), producing
     * the `{ client }` arm the library uses as-is.
     */
    const sharedClient = {} as Redis
    const sharedEnv = parseEnv({ QUEUE_CONNECTION_MODE: 'shared' })
    expect(buildQueueOptions(sharedEnv, sharedClient).connection).toEqual({ client: sharedClient })
  })

  it('falls back to a library-owned connection when shared mode lacks a client', () => {
    /*
     * Scenario: shared mode but no client was injected.
     * Rule it protects: the factory never emits `{ client: undefined }`; it falls
     * through to the URL arm so the app still boots.
     */
    const sharedEnv = parseEnv({
      QUEUE_CONNECTION_MODE: 'shared',
      REDIS_URL: 'redis://cache:6390/3',
    })
    expect(buildQueueOptions(sharedEnv).connection).toEqual({ url: 'redis://cache:6390/3' })
  })

  it('propagates the queue prefix for multi-tenant isolation', () => {
    /*
     * Scenario: a custom QUEUE_PREFIX.
     * Rule it protects: the prefix passes through verbatim so every Redis key is
     * namespaced to this deployment.
     */
    expect(buildQueueOptions(env).prefix).toBe('tenant-a')
  })

  it('sets the module default job options (attempts + exponential backoff)', () => {
    /*
     * Scenario: inherited retry policy.
     * Rule it protects: 4 attempts with a 1500ms exponential backoff is the module
     * default that per-job options later override.
     */
    expect(buildQueueOptions(env).defaultJobOptions).toEqual({
      attempts: 4,
      backoff: { type: 'exponential', delay: 1500 },
    })
  })

  it('enables flows', () => {
    /*
     * Scenario: opt-in flow support.
     * Rule it protects: `flows.enabled` is true so FlowService operates instead of
     * throwing FLOW_DISABLED.
     */
    expect(buildQueueOptions(env).flows).toEqual({ enabled: true })
  })

  it('enables metrics with a short cache TTL', () => {
    /*
     * Scenario: opt-in metrics cache.
     * Rule it protects: metrics are enabled with a 3000ms TTL so readiness polls hit
     * the cache rather than hammering Redis.
     */
    expect(buildQueueOptions(env).metrics).toEqual({ enabled: true, cacheTtlMs: 3000 })
  })

  it('maps the shutdown drain budget and dev-only drain flag from env', () => {
    /*
     * Scenario: env-driven shutdown block.
     * Rule it protects: `drainTimeoutMs` and `drainOnShutdown` come straight from the
     * parsed environment so the graceful-drain budget is configurable.
     */
    expect(buildQueueOptions(env).shutdown).toEqual({
      drainTimeoutMs: 4200,
      drainOnShutdown: true,
    })
  })
})

describe('parseRedisOptions (unit)', () => {
  it('parses host, port, and db from a plain URL', () => {
    /*
     * Scenario: a minimal redis:// URL with a db path.
     * Rule it protects: host/port/db map across, and no auth or tls keys are added.
     */
    expect(parseRedisOptions('redis://cache:6390/3')).toEqual({ host: 'cache', port: 6390, db: 3 })
  })

  it('defaults the port and omits the db when the URL has neither', () => {
    /*
     * Scenario: a URL with only a host.
     * Rule it protects: the port defaults to 6379 and no db key is emitted when the
     * path is empty.
     */
    expect(parseRedisOptions('redis://cache')).toEqual({ host: 'cache', port: 6379 })
  })

  it('carries auth and enables tls for a rediss URL', () => {
    /*
     * Scenario: a secured URL with username and password.
     * Rule it protects: credentials pass through for the library and tls is enabled
     * for the rediss scheme.
     */
    expect(parseRedisOptions('rediss://user:p%40ss@cache:6380/1')).toEqual({
      host: 'cache',
      port: 6380,
      db: 1,
      username: 'user',
      password: 'p@ss',
      tls: {},
    })
  })
})
