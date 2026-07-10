/**
 * @fileoverview Demos feature module. Exposes the stall-request surface; the
 * stall processor itself is registered by the processors module alongside the
 * other queue consumers.
 * @layer app/demos
 */
import { Module } from '@nestjs/common'
import { DemosController } from './demos.controller.js'

/** Module exposing the operational-demo request surface. */
@Module({
  controllers: [DemosController],
})
export class DemosModule {}
