/**
 * @fileoverview Processor for the `payments` queue: the `charge-payment` child of
 * the fulfillment flow. Records its execution into the shared {@link FlowTrace}.
 * This node is the failure-injection point for the flow-variant demonstrations:
 * it throws deterministically for orders whose id carries the failure prefix, so
 * the three propagation postures (stuck, fail-parent, ignore-dependency) can be
 * shown without any randomness.
 * @layer app/flows
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import {
  CHARGE_PAYMENT_JOB,
  FLOW_NODE_CONCURRENCY,
  ORDER_FAILURE_PREFIX,
  PAYMENTS_QUEUE,
} from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** Consumes the `charge-payment` child of the fulfillment flow. */
@Processor(PAYMENTS_QUEUE, { concurrency: FLOW_NODE_CONCURRENCY })
export class PaymentsProcessor {
  constructor(private readonly trace: FlowTrace) {}

  /**
   * Charge payment for the order. Records the attempt, then throws a static,
   * input-free failure for orders carrying the failure prefix so the variant
   * demonstrations are deterministic. The single-attempt cap on the demo variants
   * makes that failure terminal without retries.
   *
   * @param job - The `charge-payment` job.
   * @returns The recorded node name on success.
   * @throws {Error} When the order id carries the failure prefix.
   */
  @Process(CHARGE_PAYMENT_JOB)
  charge(job: Job<FulfillmentNodeData, FulfillmentNodeResult>): FulfillmentNodeResult {
    this.trace.record(job.name)
    if (job.data.orderId.startsWith(ORDER_FAILURE_PREFIX)) {
      throw new Error('payment declined (injected failure)')
    }
    return { node: job.name }
  }
}
