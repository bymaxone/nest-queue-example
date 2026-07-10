/**
 * @fileoverview Processor for the `stock` queue: the `reserve-stock` child of the
 * fulfillment flow. Records its execution into the shared {@link FlowTrace} so the
 * child-before-parent ordering is observable.
 * @layer app/flows
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { FLOW_NODE_CONCURRENCY, RESERVE_STOCK_JOB, STOCK_QUEUE } from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** Consumes the `reserve-stock` child of the fulfillment flow. */
@Processor(STOCK_QUEUE, { concurrency: FLOW_NODE_CONCURRENCY })
export class StockProcessor {
  constructor(private readonly trace: FlowTrace) {}

  /**
   * Reserve stock for the order.
   *
   * @param job - The `reserve-stock` job.
   * @returns The recorded node name.
   */
  @Process(RESERVE_STOCK_JOB)
  reserve(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }
}
