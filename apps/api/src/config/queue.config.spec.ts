/**
 * Unit tests for buildQueueOptions.
 *
 * Layer: unit.
 * Goal: every field of the canonical wiring maps from the parsed environment.
 * Mocks: none — the factory is pure; the env is produced by parseEnv on a literal.
 */
import { parseEnv } from './env.js'
import { buildQueueOptions } from './queue.config.js'

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
