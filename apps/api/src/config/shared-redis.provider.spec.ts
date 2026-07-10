/**
 * Unit tests for the Mode A shared-redis provider.
 *
 * Layer: unit.
 * Goal: the app-owned client is created only in `shared` mode and closed on
 * shutdown, and is a no-op in every other mode.
 * Mocks: a fake Redis factory and a client stub with a spied quit.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Redis } from 'ioredis'
import { parseEnv } from './env.js'
import { createSharedRedis, SharedRedisLifecycle } from './shared-redis.provider.js'

describe('createSharedRedis (unit)', () => {
  it('creates the client from REDIS_URL in shared mode', () => {
    /*
     * Scenario: QUEUE_CONNECTION_MODE=shared.
     * Rule it protects: Mode A builds an app-owned client from the configured URL.
     */
    const client = {} as Redis
    const factory = jest.fn<(url: string) => Redis>().mockReturnValue(client)
    const result = createSharedRedis(
      parseEnv({ QUEUE_CONNECTION_MODE: 'shared', REDIS_URL: 'redis://cache:6390/2' }),
      factory,
    )
    expect(result).toBe(client)
    expect(factory).toHaveBeenCalledWith('redis://cache:6390/2')
  })

  it('returns null and never constructs a client in own mode', () => {
    /*
     * Scenario: the default `own` mode (Mode B).
     * Rule it protects: no app-owned client exists, so the library opens its own.
     */
    const factory = jest.fn<(url: string) => Redis>()
    expect(createSharedRedis(parseEnv({ QUEUE_CONNECTION_MODE: 'own' }), factory)).toBeNull()
    expect(factory).not.toHaveBeenCalled()
  })
})

describe('SharedRedisLifecycle (unit)', () => {
  it('quits the app-owned client on shutdown', async () => {
    /*
     * Scenario: Mode A shutdown.
     * Rule it protects: the app closes the client the library never owns (Mode A
     * contract).
     */
    const quit = jest.fn<Redis['quit']>().mockResolvedValue('OK')
    const client = { quit } as unknown as Redis
    await new SharedRedisLifecycle(client).onApplicationShutdown()
    expect(quit).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when there is no client', async () => {
    /*
     * Scenario: Mode B shutdown (token resolved to null).
     * Rule it protects: with no app-owned client the shutdown hook does nothing.
     */
    await expect(new SharedRedisLifecycle(null).onApplicationShutdown()).resolves.toBeUndefined()
  })
})
