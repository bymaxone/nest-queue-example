/**
 * @fileoverview Flows module: the fulfillment flow service and its HTTP surface,
 * the shared execution trace, and the per-queue node processors discovered by the
 * globally-registered queue library. The trace is exported so other read surfaces
 * can inspect it.
 * @layer app/flows
 */
import { Module } from '@nestjs/common'
import { FlowTrace } from './flow-trace.service.js'
import { FlowsController } from './flows.controller.js'
import { FulfillmentProcessor } from './fulfillment.processor.js'
import { FulfillmentService } from './fulfillment.service.js'
import { InvoicesDataProcessor } from './invoices-data.processor.js'
import { PaymentsProcessor } from './payments.processor.js'
import { StockProcessor } from './stock.processor.js'

/** Wires the fulfillment flow, its node processors, and the execution trace. */
@Module({
  controllers: [FlowsController],
  providers: [
    FlowTrace,
    FulfillmentService,
    FulfillmentProcessor,
    StockProcessor,
    PaymentsProcessor,
    InvoicesDataProcessor,
  ],
  exports: [FlowTrace],
})
export class FlowsModule {}
