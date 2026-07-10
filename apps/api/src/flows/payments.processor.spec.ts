/**
 * Unit tests for PaymentsProcessor.
 *
 * Layer: unit.
 * Goal: the charge-payment handler records its node and returns the node name.
 * Mocks: FlowTrace (record spy).
 */
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { FlowTrace } from './flow-trace.service.js'
import { CHARGE_PAYMENT_JOB } from './fulfillment.constants.js'
import { PaymentsProcessor } from './payments.processor.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** A minimal job stub carrying an order id. */
function jobStub(orderId: string): Job<FulfillmentNodeData, FulfillmentNodeResult> {
  return { name: CHARGE_PAYMENT_JOB, data: { orderId } } as unknown as Job<
    FulfillmentNodeData,
    FulfillmentNodeResult
  >
}

describe('PaymentsProcessor (unit)', () => {
  it('records and returns the charge-payment node', () => {
    /*
     * Scenario: the payment child runs for a healthy order.
     * Rule it protects: the child records itself into the trace and returns its
     * node name.
     */
    const record = jest.fn()
    const processor = new PaymentsProcessor({ record } as unknown as FlowTrace)

    const result = processor.charge(jobStub('order-1'))

    expect(record).toHaveBeenCalledWith(CHARGE_PAYMENT_JOB)
    expect(result).toEqual({ node: CHARGE_PAYMENT_JOB })
  })
})
