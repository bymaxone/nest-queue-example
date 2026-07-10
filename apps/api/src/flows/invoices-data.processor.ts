/**
 * @fileoverview Processor for the `invoices-data` queue: the two data-fetch
 * grandchildren (`fetch-lines`, `fetch-customer`) of the invoice branch. Each
 * handler records its execution into the shared {@link FlowTrace} so the
 * grandchild-before-child ordering is observable.
 * @layer app/flows
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import {
  FETCH_CUSTOMER_JOB,
  FETCH_LINES_JOB,
  FLOW_NODE_CONCURRENCY,
  INVOICES_DATA_QUEUE,
} from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** Consumes the invoice-branch data-fetch grandchildren. */
@Processor(INVOICES_DATA_QUEUE, { concurrency: FLOW_NODE_CONCURRENCY })
export class InvoicesDataProcessor {
  constructor(private readonly trace: FlowTrace) {}

  /**
   * Fetch the invoice line items.
   *
   * @param job - The `fetch-lines` job.
   * @returns The recorded node name.
   */
  @Process(FETCH_LINES_JOB)
  fetchLines(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }

  /**
   * Fetch the invoice customer record.
   *
   * @param job - The `fetch-customer` job.
   * @returns The recorded node name.
   */
  @Process(FETCH_CUSTOMER_JOB)
  fetchCustomer(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }
}
