/**
 * @fileoverview Workers module: the dynamic per-tenant worker service and its HTTP
 * surface, plus the shared delivery trail. The trail is exported so other read
 * surfaces can inspect per-tenant consumption.
 * @layer app/workers
 */
import { Module } from '@nestjs/common'
import { TenantDeliveries } from './tenant-deliveries.service.js'
import { TenantWorkersController } from './tenant-workers.controller.js'
import { TenantWorkersService } from './tenant-workers.service.js'

/** Wires the dynamic per-tenant workers, their delivery trail, and the HTTP surface. */
@Module({
  controllers: [TenantWorkersController],
  providers: [TenantDeliveries, TenantWorkersService],
  exports: [TenantDeliveries],
})
export class WorkersModule {}
