/**
 * Unit tests for StockProcessor.
 *
 * Layer: unit.
 * Goal: the reserve-stock handler records its node and returns the node name.
 * Mocks: FlowTrace (record spy).
 */
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { FlowTrace } from './flow-trace.service.js'
import { RESERVE_STOCK_JOB } from './fulfillment.constants.js'
import { StockProcessor } from './stock.processor.js'
import type { FulfillmentNodeData, FulfillmentNodeResult } from './fulfillment.types.js'

describe('StockProcessor (unit)', () => {
  it('records and returns the reserve-stock node', () => {
    /*
     * Scenario: the stock child runs.
     * Rule it protects: the child records itself into the trace before the parent
     * ships, and returns its node name.
     */
    const record = jest.fn()
    const processor = new StockProcessor({ record } as unknown as FlowTrace)

    const job = { name: RESERVE_STOCK_JOB } as unknown as Job<
      FulfillmentNodeData,
      FulfillmentNodeResult
    >
    const result = processor.reserve(job)

    expect(record).toHaveBeenCalledWith(RESERVE_STOCK_JOB)
    expect(result).toEqual({ node: RESERVE_STOCK_JOB })
  })
})
