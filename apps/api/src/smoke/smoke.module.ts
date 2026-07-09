/**
 * @fileoverview Smoke feature module. Intentionally does NOT import the queue
 * module: `QueueService` resolves because the library registers globally. Imports
 * the processors module only for read access to the audit trail.
 * @layer app/smoke
 */
import { Module } from '@nestjs/common'
import { ProcessorsModule } from '../processors/processors.module.js'
import { SmokeController } from './smoke.controller.js'

/** Module exposing the smoke enqueue-and-inspect endpoints. */
@Module({
  imports: [ProcessorsModule],
  controllers: [SmokeController],
})
export class SmokeModule {}
