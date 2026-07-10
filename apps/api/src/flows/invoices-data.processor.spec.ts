/**
 * Unit tests for InvoicesDataProcessor.
 *
 * Layer: unit.
 * Goal: both data-fetch grandchild handlers record their node and return the name.
 * Mocks: FlowTrace (record spy).
 */
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { FlowTrace } from './flow-trace.service.js'
import { FETCH_CUSTOMER_JOB, FETCH_LINES_JOB } from './fulfillment.constants.js'
import { InvoicesDataProcessor } from './invoices-data.processor.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

/** A minimal job stub exposing only the fields the handlers read. */
function jobStub(name: string): Job<FulfillmentNodeData, FulfillmentNodeResult> {
  return { name } as unknown as Job<FulfillmentNodeData, FulfillmentNodeResult>
}

describe('InvoicesDataProcessor (unit)', () => {
  it('records and returns the fetch-lines node', () => {
    /*
     * Scenario: the first grandchild runs.
     * Rule it protects: a grandchild records itself before its parent branch runs.
     */
    const record = jest.fn()
    const processor = new InvoicesDataProcessor({ record } as unknown as FlowTrace)

    const result = processor.fetchLines(jobStub(FETCH_LINES_JOB))

    expect(record).toHaveBeenCalledWith(FETCH_LINES_JOB)
    expect(result).toEqual({ node: FETCH_LINES_JOB })
  })

  it('records and returns the fetch-customer node', () => {
    /*
     * Scenario: the second grandchild runs.
     * Rule it protects: both grandchildren record independently.
     */
    const record = jest.fn()
    const processor = new InvoicesDataProcessor({ record } as unknown as FlowTrace)

    const result = processor.fetchCustomer(jobStub(FETCH_CUSTOMER_JOB))

    expect(record).toHaveBeenCalledWith(FETCH_CUSTOMER_JOB)
    expect(result).toEqual({ node: FETCH_CUSTOMER_JOB })
  })
})
