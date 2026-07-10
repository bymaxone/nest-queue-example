/**
 * Unit tests for FulfillmentService.
 *
 * Layer: unit.
 * Goal: the flow builder produces the fan-out/fan-in tree with the nested invoice
 * branch, launching delegates to FlowService, and the tree reader projects the
 * live producer tree to a secret-free shape.
 * Mocks: FlowService (add + getProducer.getFlow spies).
 */
import { jest } from '@jest/globals'
import type { FlowService, JobNode } from '@bymax-one/nest-queue'
import {
  CHARGE_PAYMENT_JOB,
  FETCH_CUSTOMER_JOB,
  FETCH_LINES_JOB,
  FULFILLMENT_QUEUE,
  INVOICES_DATA_QUEUE,
  PAYMENTS_QUEUE,
  RENDER_INVOICE_JOB,
  RESERVE_STOCK_JOB,
  SHIP_ORDER_JOB,
  STOCK_QUEUE,
} from './fulfillment.constants.js'
import { FulfillmentService } from './fulfillment.service.js'
import type { FulfillmentVariant } from './fulfillment.types.js'

/** Build a fake JobNode with a resolvable state, for tree-projection tests. */
function fakeNode(id: string, name: string, queue: string, children?: JobNode[]): JobNode {
  const getState = jest.fn<() => Promise<string>>().mockResolvedValue('completed')
  return {
    job: { id, name, queueName: queue, getState },
    children,
  } as unknown as JobNode
}

describe('FulfillmentService (unit)', () => {
  it('builds the fan-out/fan-in tree with the nested invoice branch', () => {
    /*
     * Scenario: constructing the flow definition for an order.
     * Rule it protects: reserve-stock + charge-payment fan out under the ship-order
     * root, and render-invoice parents the two data-fetch grandchildren (rows 50, 51).
     */
    const service = new FulfillmentService({} as unknown as FlowService)

    const flow = service.buildFulfillmentFlow('order-1')

    expect(flow.name).toBe(SHIP_ORDER_JOB)
    expect(flow.queueName).toBe(FULFILLMENT_QUEUE)
    const children = flow.children ?? []
    expect(children.map((child) => [child.name, child.queueName])).toEqual([
      [RESERVE_STOCK_JOB, STOCK_QUEUE],
      [CHARGE_PAYMENT_JOB, PAYMENTS_QUEUE],
      [RENDER_INVOICE_JOB, FULFILLMENT_QUEUE],
    ])
    const invoice = children[2]
    expect(invoice?.children?.map((grand) => [grand.name, grand.queueName])).toEqual([
      [FETCH_LINES_JOB, INVOICES_DATA_QUEUE],
      [FETCH_CUSTOMER_JOB, INVOICES_DATA_QUEUE],
    ])
  })

  it('encodes the failure-propagation flag on the payment child per variant', () => {
    /*
     * Scenario: building each variant's flow definition.
     * Rule it protects: the charge-payment child carries no override on the happy
     * path, a bare single-attempt cap for the stuck pitfall, failParentOnFailure
     * for propagation, and ignoreDependencyOnFailure for the resilient parent
     * (rows 52 to 54).
     */
    const service = new FulfillmentService({} as unknown as FlowService)
    const paymentOpts = (variant: FulfillmentVariant): unknown =>
      (service.buildFulfillmentFlow('order-1', variant).children ?? [])[1]?.opts

    expect(paymentOpts('default')).toBeUndefined()
    expect(paymentOpts('stuck')).toEqual({ attempts: 1 })
    expect(paymentOpts('failParent')).toEqual({ attempts: 1, failParentOnFailure: true })
    expect(paymentOpts('ignoreDependency')).toEqual({
      attempts: 1,
      ignoreDependencyOnFailure: true,
    })
  })

  it('bulk-launches one flow per order id in input order', async () => {
    /*
     * Scenario: launching a batch of flows.
     * Rule it protects: runBulk maps each order id to its built flow and delegates
     * the whole batch to FlowService.addBulk in one roundtrip, preserving order
     * (row 55).
     */
    const nodes = [
      fakeNode('r1', SHIP_ORDER_JOB, FULFILLMENT_QUEUE),
      fakeNode('r2', SHIP_ORDER_JOB, FULFILLMENT_QUEUE),
    ]
    const addBulk = jest.fn<FlowService['addBulk']>().mockResolvedValue(nodes)
    const service = new FulfillmentService({ addBulk } as unknown as FlowService)

    const result = await service.runBulk(['o1', 'o2'], 'stuck')

    expect(addBulk).toHaveBeenCalledWith([
      service.buildFulfillmentFlow('o1', 'stuck'),
      service.buildFulfillmentFlow('o2', 'stuck'),
    ])
    expect(result).toBe(nodes)
  })

  it('launches the flow by delegating the built tree to FlowService.add', async () => {
    /*
     * Scenario: running a fulfillment flow.
     * Rule it protects: the service hands the exact built tree to FlowService.add
     * and returns the root JobNode it produced.
     */
    const root = fakeNode('root-1', SHIP_ORDER_JOB, FULFILLMENT_QUEUE)
    const add = jest.fn<FlowService['add']>().mockResolvedValue(root)
    const service = new FulfillmentService({ add } as unknown as FlowService)

    const result = await service.run('order-9', 'default')

    expect(add).toHaveBeenCalledWith(service.buildFulfillmentFlow('order-9', 'default'))
    expect(result).toBe(root)
  })

  it('projects the live tree with per-node status via the producer', async () => {
    /*
     * Scenario: reading the tree of a launched flow.
     * Rule it protects: getFlow's JobNode tree is projected to { id, name, queue,
     * status } recursively, exposing status but never job data (row 56).
     */
    const tree = fakeNode('root-1', SHIP_ORDER_JOB, FULFILLMENT_QUEUE, [
      fakeNode('c1', RESERVE_STOCK_JOB, STOCK_QUEUE),
    ])
    const getFlow = jest
      .fn<(opts: { queueName: string; id: string }) => Promise<JobNode | undefined>>()
      .mockResolvedValue(tree)
    const service = new FulfillmentService({
      getProducer: () => ({ getFlow }),
    } as unknown as FlowService)

    const node = await service.readTree('root-1')

    expect(getFlow).toHaveBeenCalledWith({ queueName: FULFILLMENT_QUEUE, id: 'root-1' })
    expect(node).toEqual({
      id: 'root-1',
      name: SHIP_ORDER_JOB,
      queue: FULFILLMENT_QUEUE,
      status: 'completed',
      children: [
        {
          id: 'c1',
          name: RESERVE_STOCK_JOB,
          queue: STOCK_QUEUE,
          status: 'completed',
          children: [],
        },
      ],
    })
  })

  it('returns null when no flow exists for the id', async () => {
    /*
     * Edge case: reading the tree of an unknown id.
     * Rule it protects: a missing flow yields null so the controller can surface a
     * clean not-found envelope instead of throwing on undefined.
     */
    const getFlow = jest
      .fn<(opts: { queueName: string; id: string }) => Promise<JobNode | undefined>>()
      .mockResolvedValue(undefined)
    const service = new FulfillmentService({
      getProducer: () => ({ getFlow }),
    } as unknown as FlowService)

    expect(await service.readTree('missing')).toBeNull()
  })
})
