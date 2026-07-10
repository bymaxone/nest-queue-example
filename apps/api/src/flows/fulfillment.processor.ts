/**
 * @fileoverview Processor for the `fulfillment` queue: the flow root (`ship-order`)
 * and the nested `render-invoice` branch. Each handler records its node into the
 * shared {@link FlowTrace} so the execution order is observable. The root only
 * runs after every descendant completes, so its trace entry lands last.
 * @layer app/flows
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import {
  FLOW_NODE_CONCURRENCY,
  FULFILLMENT_QUEUE,
  RENDER_INVOICE_JOB,
  SHIP_ORDER_JOB,
} from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** Consumes the fulfillment root and the invoice-render branch nodes. */
@Processor(FULFILLMENT_QUEUE, { concurrency: FLOW_NODE_CONCURRENCY })
export class FulfillmentProcessor {
  constructor(private readonly trace: FlowTrace) {}

  /**
   * Ship the order. As the flow root, this runs only after every descendant has
   * completed, so its trace entry is recorded last.
   *
   * @param job - The `ship-order` job.
   * @returns The recorded node name.
   */
  @Process(SHIP_ORDER_JOB)
  ship(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }

  /**
   * Render the invoice. Runs after its two data-fetch grandchildren complete.
   *
   * @param job - The `render-invoice` job.
   * @returns The recorded node name.
   */
  @Process(RENDER_INVOICE_JOB)
  renderInvoice(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }
}
