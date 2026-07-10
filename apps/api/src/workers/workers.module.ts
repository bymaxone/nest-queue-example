/**
 * @fileoverview Workers module: the dynamic per-tenant worker service and its HTTP
 * surface, the shared delivery trail, and the sandboxed invoice processor with its
 * event-loop-delay probe. The trail is exported so other read surfaces can inspect
 * per-tenant consumption.
 * @layer app/workers
 */
import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller.js'
import { LagProbe } from './lag-probe.service.js'
import { SandboxedBootstrapService } from './sandboxed-bootstrap.service.js'
import { TenantDeliveries } from './tenant-deliveries.service.js'
import { TenantWorkersController } from './tenant-workers.controller.js'
import { TenantWorkersService } from './tenant-workers.service.js'

/**
 * Wires the dynamic per-tenant workers and their delivery trail, plus the
 * sandboxed invoice processor (registered at boot) and its responsiveness probe.
 */
@Module({
  controllers: [TenantWorkersController, InvoicesController],
  providers: [TenantDeliveries, TenantWorkersService, SandboxedBootstrapService, LagProbe],
  exports: [TenantDeliveries],
})
export class WorkersModule {}
