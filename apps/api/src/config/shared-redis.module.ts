/**
 * @fileoverview Global module exposing the Mode A app-owned Redis client under
 * {@link SHARED_REDIS}. The `new Redis(...)` instantiation lives here as DI
 * wiring; the conditional logic and shutdown behaviour live in the provider file
 * so they are unit-tested without opening a socket.
 * @layer app/config
 */
import { Global, Module } from '@nestjs/common'
import type { FactoryProvider } from '@nestjs/common'
import { Redis } from 'ioredis'
import { APP_ENV } from './env.js'
import type { AppEnv } from './env.js'
import { createSharedRedis, SHARED_REDIS, SharedRedisLifecycle } from './shared-redis.provider.js'

/** Binds {@link SHARED_REDIS} to an app-owned client in Mode A, `null` otherwise. */
const sharedRedisProvider: FactoryProvider = {
  provide: SHARED_REDIS,
  inject: [APP_ENV],
  useFactory: (env: AppEnv) => createSharedRedis(env, (url) => new Redis(url)),
}

/** Global module providing the Mode A client and its shutdown owner. */
@Global()
@Module({
  providers: [sharedRedisProvider, SharedRedisLifecycle],
  exports: [SHARED_REDIS],
})
export class SharedRedisModule {}
