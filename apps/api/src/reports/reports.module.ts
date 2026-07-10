/**
 * @fileoverview Reports feature module. Exposes the report-request surface and
 * injects the globally-registered `QueueService` without importing the queue
 * module. The report processor itself is registered by the processors module.
 * @layer app/reports
 */
import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller.js'

/** Module exposing the report-request surface. */
@Module({
  controllers: [ReportsController],
})
export class ReportsModule {}
