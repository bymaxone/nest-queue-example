/**
 * @fileoverview Admin module exposing health, diagnostics, and the queue admin
 * plane. Controllers depend only on globally-registered queue providers plus the
 * local {@link AdminQueuesService}, so no queue module import is needed here.
 * @layer app/admin
 */
import { Module } from '@nestjs/common'
import { DiagnosticsController } from './diagnostics.controller.js'
import { HealthController } from './health.controller.js'
import { AdminQueuesService } from './queues.service.js'

/** Module wiring the admin controllers and the queue admin service. */
@Module({
  controllers: [HealthController, DiagnosticsController],
  providers: [AdminQueuesService],
})
export class AdminModule {}
