/**
 * @fileoverview Error-explorer module. Wires the catalog controller and service
 * and binds the `duplicate_processor` probe seam to a real isolated-context
 * bootstrap: an in-process `BymaxQueueModule` whose `WorkerRegistry` the probe
 * double-registers to hit the library's duplicate guard, always torn down after.
 * Imports {@link AdminModule} to reuse its guarded operations for the
 * consumer-raised codes.
 * @layer app/errors
 */
import { Module } from '@nestjs/common'
import type { FactoryProvider } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { BymaxQueueModule } from '@bymax-one/nest-queue'
import { AdminModule } from '../admin/admin.module.js'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
import { provokeDuplicateProcessor } from './duplicate-probe.js'
import { ErrorExplorerController } from './error-explorer.controller.js'
import { DUPLICATE_PROBE, ErrorExplorerService } from './error-explorer.service.js'
import type { DuplicateProbe } from './error-explorer.service.js'

/**
 * Bind the duplicate-processor probe to a throwaway `BymaxQueueModule` context
 * opened from the app's Redis URL. The context is always closed by the probe, so
 * the connections the library opens for it never leak.
 */
const duplicateProbeProvider: FactoryProvider = {
  provide: DUPLICATE_PROBE,
  inject: [APP_ENV],
  useFactory:
    (env: AppEnv): DuplicateProbe =>
    (): Promise<never> =>
      provokeDuplicateProcessor(() =>
        NestFactory.createApplicationContext(
          BymaxQueueModule.forRoot({ connection: { url: env.REDIS_URL }, isGlobal: false }),
          { abortOnError: false, logger: false },
        ),
      ),
}

/** Module wiring the error explorer and its isolated duplicate-processor probe. */
@Module({
  imports: [AdminModule],
  controllers: [ErrorExplorerController],
  providers: [ErrorExplorerService, duplicateProbeProvider],
})
export class ErrorsModule {}
