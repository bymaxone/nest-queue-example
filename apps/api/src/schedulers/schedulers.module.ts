/**
 * @fileoverview Schedulers module: the boot-time registrar, the monitoring tick
 * processor and its store, and the management HTTP surface. The tick store is
 * exported so other read surfaces can inspect the scheduler clock.
 * @layer app/schedulers
 */
import { Module } from '@nestjs/common'
import { BootSchedulersService } from './boot-schedulers.service.js'
import { HeartbeatProcessor } from './heartbeat.processor.js'
import { HeartbeatTicks } from './heartbeat-ticks.service.js'
import { SchedulersController } from './schedulers.controller.js'

/** Wires the boot schedulers, the tick processor/store, and the management API. */
@Module({
  controllers: [SchedulersController],
  providers: [BootSchedulersService, HeartbeatProcessor, HeartbeatTicks],
  exports: [HeartbeatTicks],
})
export class SchedulersModule {}
