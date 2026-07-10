/**
 * @fileoverview A minimal `BymaxQueueOptionsFactory` and its hosting module,
 * shared by `registration.e2e-spec.ts` to exercise both the `useClass` (the
 * module instantiates the factory itself) and `useExisting` (the factory is
 * already provided elsewhere) async registration paths.
 * @layer test/support
 */
import { randomUUID } from 'node:crypto'
import { Injectable, Module } from '@nestjs/common'
import type { BymaxQueueModuleOptions, BymaxQueueOptionsFactory } from '@bymax-one/nest-queue'
import { e2eRedisUrl } from './test-app.js'

/**
 * Build fresh, per-call module options so repeated registrations never
 * collide on the same Redis key prefix.
 *
 * @returns Module options pointing at the e2e Redis instance under a unique prefix.
 */
export function factoryOptions(): BymaxQueueModuleOptions {
  return {
    connection: { url: e2eRedisUrl() },
    prefix: `e2e-registration-factory-${randomUUID().slice(0, 8)}`,
  }
}

/** A `BymaxQueueOptionsFactory` implementation used by the `useClass` and `useExisting` specs. */
@Injectable()
export class QueueOptionsFactory implements BymaxQueueOptionsFactory {
  /**
   * Build the module options this factory provides.
   *
   * @returns Fresh, uniquely-prefixed module options.
   */
  createQueueOptions(): BymaxQueueModuleOptions {
    return factoryOptions()
  }
}

/** Hosts {@link QueueOptionsFactory} as an existing provider for the `useExisting` registration path. */
@Module({ providers: [QueueOptionsFactory], exports: [QueueOptionsFactory] })
export class OptionsFactoryModule {}
