/**
 * @fileoverview Mode A (bring-your-own client) support. When
 * `QUEUE_CONNECTION_MODE=shared` the app owns an ioredis client and hands it to
 * the library as `{ client }`, exactly the shape a `@bymax-one/nest-cache` host
 * would produce. The library never closes an injected client, so this app closes
 * it on shutdown. In every other mode the token resolves to `null` and the
 * library opens its own connection (Mode B).
 * @layer app/config
 */
import { Inject, Injectable } from '@nestjs/common'
import type { OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import type { AppEnv } from './env.js'

/** Injection token for the app-owned Mode A client (or `null` in Mode B). */
export const SHARED_REDIS: unique symbol = Symbol('SHARED_REDIS')

/** Constructs an ioredis client from a URL; injected so tests avoid a real socket. */
export type RedisFactory = (url: string) => Redis

/**
 * Build the app-owned client only in Mode A. Returns `null` in every other mode
 * so the library falls back to opening its own connection.
 *
 * @param env - The validated environment.
 * @param factory - Creates the ioredis client (the real one opens a socket).
 * @returns The Mode A client, or `null` when the mode is not `shared`.
 */
export function createSharedRedis(env: AppEnv, factory: RedisFactory): Redis | null {
  return env.QUEUE_CONNECTION_MODE === 'shared' ? factory(env.REDIS_URL) : null
}

/**
 * Closes the app-owned Mode A client on shutdown. The library never closes an
 * injected client (Mode A contract), so ownership stays with the app. A no-op in
 * Mode B, where the token is `null`.
 */
@Injectable()
export class SharedRedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SHARED_REDIS) private readonly client: Redis | null) {}

  /**
   * Quit the app-owned client if one exists. Runs after the library's
   * `onModuleDestroy`, so the shared client is released only once the library has
   * finished using it.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.client !== null) {
      await this.client.quit()
    }
  }
}
