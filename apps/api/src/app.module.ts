/**
 * @fileoverview Root application module. Composes the global configuration and
 * wires the queue library through `forRootAsync`.
 * @layer app/root
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module.js'

/** Root module wiring configuration and feature modules. */
@Module({
  imports: [ConfigModule],
})
export class AppModule {}
