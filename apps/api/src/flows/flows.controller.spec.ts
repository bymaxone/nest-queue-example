/**
 * Unit tests for FlowsController.
 *
 * Layer: unit.
 * Goal: the controller validates input at the boundary, launches flows, exposes
 * the trace, and surfaces a clean not-found envelope for an unknown tree.
 * Mocks: FulfillmentService (run + readTree spies), FlowTrace (list spy).
 */
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { QueueException } from '@bymax-one/nest-queue'
import type { JobNode } from '@bymax-one/nest-queue'
import { FlowTrace } from './flow-trace.service.js'
import { FlowsController } from './flows.controller.js'
import { FULFILLMENT_QUEUE, SHIP_ORDER_JOB } from './fulfillment.constants.js'
import { FulfillmentService } from './fulfillment.service.js'
import type { FlowTreeNode } from './fulfillment.types.js'

/** Build a controller over spied collaborators. */
function build(overrides: {
  run?: FulfillmentService['run']
  readTree?: FulfillmentService['readTree']
  list?: FlowTrace['list']
}): FlowsController {
  const fulfillment = {
    run: overrides.run ?? jest.fn(),
    readTree: overrides.readTree ?? jest.fn(),
  } as unknown as FulfillmentService
  const trace = { list: overrides.list ?? jest.fn(() => []) } as unknown as FlowTrace
  return new FlowsController(fulfillment, trace)
}

describe('FlowsController (unit)', () => {
  it('launches a fulfillment flow and returns the root id', async () => {
    /*
     * Scenario: a valid launch request.
     * Rule it protects: the validated order id reaches the service and the root
     * job id is returned so the caller can poll the tree.
     */
    const run = jest.fn<FulfillmentService['run']>().mockResolvedValue({
      job: { id: 'root-1' },
    } as unknown as JobNode)
    const controller = build({ run })

    const result = await controller.launch({ orderId: 'order-1' })

    expect(run).toHaveBeenCalledWith('order-1')
    expect(result).toEqual({ rootId: 'root-1', orderId: 'order-1' })
  })

  it('rejects a malformed order id at the boundary', async () => {
    /*
     * Scenario: an order id with an illegal character.
     * Rule it protects: unvalidated input never reaches the flow producer; a safe
     * 400 is raised instead.
     */
    const controller = build({})

    await expect(controller.launch({ orderId: 'bad id!' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('returns the recorded execution trace', () => {
    /*
     * Scenario: reading the trace.
     * Rule it protects: the endpoint mirrors FlowTrace.list so the child-before-parent
     * ordering is observable.
     */
    const entries = [{ node: SHIP_ORDER_JOB, at: 1 }]
    const controller = build({ list: jest.fn(() => entries) })

    expect(controller.readTrace()).toEqual({ entries })
  })

  it('returns the projected tree for a known root', async () => {
    /*
     * Scenario: reading the tree of a launched flow.
     * Rule it protects: a found tree is returned verbatim to the caller.
     */
    const tree: FlowTreeNode = {
      id: 'root-1',
      name: SHIP_ORDER_JOB,
      queue: FULFILLMENT_QUEUE,
      status: 'completed',
      children: [],
    }
    const controller = build({
      readTree: jest.fn<FulfillmentService['readTree']>().mockResolvedValue(tree),
    })

    expect(await controller.tree('root-1')).toBe(tree)
  })

  it('surfaces a not-found envelope when the tree is missing', async () => {
    /*
     * Edge case: an unknown root id.
     * Rule it protects: a missing flow yields the stable queue.job_not_found (404)
     * envelope, never a raw error.
     */
    const controller = build({
      readTree: jest.fn<FulfillmentService['readTree']>().mockResolvedValue(null),
    })

    await expect(controller.tree('missing')).rejects.toBeInstanceOf(QueueException)
  })

  it('rejects a malformed root id at the boundary', async () => {
    /*
     * Scenario: a root id with an illegal character.
     * Rule it protects: the id is validated before it reaches the producer.
     */
    const controller = build({})

    await expect(controller.tree('bad:id')).rejects.toBeInstanceOf(BadRequestException)
  })
})
