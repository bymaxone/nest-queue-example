/**
 * @fileoverview Processor for the `payments` queue: the `charge-payment` child of
 * the fulfillment flow. Records its execution into the shared {@link FlowTrace}.
 * This node is the failure-injection point for the flow-variant demonstrations.
 * @layer app/flows
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import {
  CHARGE_PAYMENT_JOB,
  FLOW_NODE_CONCURRENCY,
  PAYMENTS_QUEUE,
} from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** Consumes the `charge-payment` child of the fulfillment flow. */
@Processor(PAYMENTS_QUEUE, { concurrency: FLOW_NODE_CONCURRENCY })
export class PaymentsProcessor {
  constructor(private readonly trace: FlowTrace) {}

  /**
   * Charge payment for the order.
   *
   * @param job - The `charge-payment` job.
   * @returns The recorded node name.
   */
  @Process(CHARGE_PAYMENT_JOB)
  charge(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    return { node: job.name }
  }
}
