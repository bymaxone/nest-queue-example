/**
 * @fileoverview Error-explorer module. Wires the catalog controller and service.
 * Imports {@link AdminModule} to reuse its guarded operations for the
 * consumer-raised codes; the library's `QueueService` and `WorkerRegistry` come
 * from the globally-registered queue module.
 * @layer app/errors
 */
import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module.js'
import { ErrorExplorerController } from './error-explorer.controller.js'
import { ErrorExplorerService } from './error-explorer.service.js'

/** Module wiring the error explorer over the admin plane and the queue library. */
@Module({
  imports: [AdminModule],
  controllers: [ErrorExplorerController],
  providers: [ErrorExplorerService],
})
export class ErrorsModule {}
