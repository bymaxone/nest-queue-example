/**
 * @fileoverview Orders feature module. Injects the globally-registered
 * `QueueService` without importing the queue module, exercising the library's
 * global registration.
 * @layer app/orders
 */
import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller.js'
import { OrdersRepository } from './orders.repository.js'
import { OrdersService } from './orders.service.js'

/** Module exposing the order placement surface. */
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
