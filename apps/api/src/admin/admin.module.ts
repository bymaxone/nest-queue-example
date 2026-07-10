/**
 * @fileoverview Admin module exposing health, diagnostics, and the queue admin
 * plane. Controllers depend only on globally-registered queue providers plus the
 * local {@link AdminQueuesService}, so no queue module import is needed here.
 * @layer app/admin
 */
import { Module } from '@nestjs/common'
import { DedupController } from './dedup.controller.js'
import { DiagnosticsController } from './diagnostics.controller.js'
import { HealthController } from './health.controller.js'
import { JobsController } from './jobs.controller.js'
import { MetricsController } from './metrics.controller.js'
import { QueuesController } from './queues.controller.js'
import { AdminQueuesService } from './queues.service.js'

/**
 * Module wiring the admin controllers and the queue admin service.
 * {@link AdminQueuesService} is exported so the error explorer can reuse its
 * real, guarded operations to provoke the consumer-raised catalog codes.
 */
@Module({
  controllers: [
    HealthController,
    DiagnosticsController,
    DedupController,
    QueuesController,
    JobsController,
    MetricsController,
  ],
  providers: [AdminQueuesService],
  exports: [AdminQueuesService],
})
export class AdminModule {}
