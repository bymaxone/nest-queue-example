/**
 * @fileoverview Global configuration module. Registers the parsed environment
 * under the {@link APP_ENV} token and exports it, so any provider (including the
 * queue module's async options factory) can inject it without importing this
 * module explicitly.
 * @layer app/config
 */
import { Global, Module } from '@nestjs/common'
import { APP_ENV, appEnvProvider } from './env.js'

/** Global module exposing the frozen {@link AppEnv} under {@link APP_ENV}. */
@Global()
@Module({
  providers: [appEnvProvider],
  exports: [APP_ENV],
})
export class ConfigModule {}
