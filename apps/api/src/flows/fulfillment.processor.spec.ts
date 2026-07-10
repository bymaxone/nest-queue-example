/**
 * Unit tests for FulfillmentProcessor.
 *
 * Layer: unit.
 * Goal: the root and invoice-render handlers record their node into the trace and
 * return the node name.
 * Mocks: FlowTrace (record spy).
 */
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { FlowTrace } from './flow-trace.service.js'
import { RENDER_INVOICE_JOB, SHIP_ORDER_JOB } from './fulfillment.constants.js'
import { FulfillmentProcessor } from './fulfillment.processor.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** A minimal job stub exposing only the fields the handlers read. */
function jobStub(name: string): Job<FulfillmentNodeData, FulfillmentNodeResult> {
  return { name } as unknown as Job<FulfillmentNodeData, FulfillmentNodeResult>
}

describe('FulfillmentProcessor (unit)', () => {
  it('records and returns the ship-order node', () => {
    /*
     * Scenario: the flow root runs.
     * Rule it protects: the root records itself into the trace (landing last since
     * it runs after every descendant) and returns its node name.
     */
    const record = jest.fn()
    const processor = new FulfillmentProcessor({ record } as unknown as FlowTrace)

    const result = processor.ship(jobStub(SHIP_ORDER_JOB))

    expect(record).toHaveBeenCalledWith(SHIP_ORDER_JOB)
    expect(result).toEqual({ node: SHIP_ORDER_JOB })
  })

  it('records and returns the render-invoice node', () => {
    /*
     * Scenario: the invoice-render branch runs.
     * Rule it protects: render-invoice records itself after its grandchildren.
     */
    const record = jest.fn()
    const processor = new FulfillmentProcessor({ record } as unknown as FlowTrace)

    const result = processor.renderInvoice(jobStub(RENDER_INVOICE_JOB))

    expect(record).toHaveBeenCalledWith(RENDER_INVOICE_JOB)
    expect(result).toEqual({ node: RENDER_INVOICE_JOB })
  })
})
