/**
 * @fileoverview Admin module exposing the health and diagnostics surfaces. Both
 * controllers depend only on globally-registered queue providers, so no queue
 * import is needed here.
 * @layer app/admin
 */
import { Module } from '@nestjs/common'
import { DiagnosticsController } from './diagnostics.controller.js'
import { HealthController } from './health.controller.js'

/** Module wiring the health and diagnostics controllers. */
@Module({
  controllers: [HealthController, DiagnosticsController],
})
export class AdminModule {}
