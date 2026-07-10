/**
 * @fileoverview Root application module. Composes the global configuration and
 * wires the queue library through `forRootAsync`, injecting the parsed
 * environment into the pure options factory.
 * @layer app/root
 */
import { Module } from '@nestjs/common'
import { BymaxQueueModule } from '@bymax-one/nest-queue'
import { ConfigModule } from './config/config.module.js'
import { APP_ENV } from './config/env.js'
import { buildQueueOptions } from './config/queue.config.js'
import { AdminModule } from './admin/admin.module.js'
import { DemosModule } from './demos/demos.module.js'
import { EventsModule } from './events/events.module.js'
import { FlowsModule } from './flows/flows.module.js'
import { OrdersModule } from './orders/orders.module.js'
import { ProcessorsModule } from './processors/processors.module.js'
import { ReportsModule } from './reports/reports.module.js'
import { SearchModule } from './search/search.module.js'
import { SmokeModule } from './smoke/smoke.module.js'

/** Root module wiring configuration and the globally-registered queue library. */
@Module({
  imports: [
    ConfigModule,
    BymaxQueueModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: buildQueueOptions,
    }),
    ProcessorsModule,
    EventsModule,
    SmokeModule,
    OrdersModule,
    ReportsModule,
    DemosModule,
    SearchModule,
    FlowsModule,
    AdminModule,
  ],
})
export class AppModule {}
