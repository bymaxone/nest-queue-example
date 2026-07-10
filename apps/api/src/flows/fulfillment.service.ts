/**
 * @fileoverview Builds and launches the fulfillment flow and reads its live tree.
 * The flow is a fan-out/fan-in tree: a `ship-order` root over `reserve-stock`,
 * `charge-payment`, and a nested `render-invoice` branch (itself parenting two
 * data-fetch grandchildren). The root becomes processable only once every
 * descendant completes, which is what the execution trace makes observable.
 * @layer app/flows
 */
import { Injectable } from '@nestjs/common'
import { FlowService } from '@bymax-one/nest-queue'
import type { FlowJob, JobNode } from '@bymax-one/nest-queue'
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
import type { FlowTreeNode, FulfillmentNodeData } from './fulfillment.types.js'

/** A single child (or grandchild) node of the fulfillment flow tree. */
type FulfillmentChild = NonNullable<FlowJob['children']>[number]

/**
 * Orchestrates the fulfillment flow: constructs the `FlowJob` tree, launches it
 * through {@link FlowService}, and projects the live tree for the read endpoint
 * via the producer escape hatch.
 */
@Injectable()
export class FulfillmentService {
  constructor(private readonly flowService: FlowService) {}

  /**
   * Build the fulfillment `FlowJob` tree for an order. Pure and side-effect free
   * so the tree shape is fully unit-testable.
   *
   * @param orderId - The order the flow fulfills.
   * @returns The root `FlowJob` with its children and grandchildren.
   */
  buildFulfillmentFlow(orderId: string): FlowJob {
    const data: FulfillmentNodeData = { orderId }
    return {
      name: SHIP_ORDER_JOB,
      queueName: FULFILLMENT_QUEUE,
      data,
      children: [
        { name: RESERVE_STOCK_JOB, queueName: STOCK_QUEUE, data },
        { name: CHARGE_PAYMENT_JOB, queueName: PAYMENTS_QUEUE, data },
        this.buildInvoiceChild(orderId),
      ],
    }
  }

  /**
   * Launch a single fulfillment flow.
   *
   * @param orderId - The order the flow fulfills.
   * @returns The root `JobNode` of the created flow.
   */
  run(orderId: string): Promise<JobNode> {
    return this.flowService.add(this.buildFulfillmentFlow(orderId))
  }

  /**
   * Read the live flow tree rooted at a job id and project each node to a
   * secret-free `{ id, name, queue, status }` shape. Uses the producer escape
   * hatch (`getFlow`), which resolves against the library's configured key prefix.
   *
   * @param rootId - The root job id returned when the flow was launched.
   * @returns The projected tree, or `null` when no flow exists for that id.
   */
  async readTree(rootId: string): Promise<FlowTreeNode | null> {
    const node = await this.fetchFlowNode(rootId)
    return node ? this.projectNode(node) : null
  }

  /**
   * Fetch the raw flow node via the producer escape hatch. BullMQ types `getFlow`
   * as `Promise<JobNode>` but returns `undefined` at runtime when the root job
   * does not exist (or the producer is closing); the wider declared return type
   * corrects that upstream nullability so the missing-flow branch stays honest.
   *
   * @param rootId - The root job id to resolve.
   * @returns The root `JobNode`, or `undefined` when no such flow exists.
   */
  private fetchFlowNode(rootId: string): Promise<JobNode | undefined> {
    return this.flowService.getProducer().getFlow({ queueName: FULFILLMENT_QUEUE, id: rootId })
  }

  /**
   * Recursively project a BullMQ `JobNode` into a serializable {@link FlowTreeNode},
   * resolving each node's live state.
   *
   * @param node - The BullMQ job node to project.
   * @returns The serializable projection including children.
   */
  private async projectNode(node: JobNode): Promise<FlowTreeNode> {
    const status = await node.job.getState()
    const children = await Promise.all(
      (node.children ?? []).map((child) => this.projectNode(child)),
    )
    return { id: node.job.id, name: node.job.name, queue: node.job.queueName, status, children }
  }

  /**
   * Build the nested `render-invoice` branch with its two data-fetch grandchildren.
   *
   * @param orderId - The order the flow fulfills.
   * @returns The invoice branch node.
   */
  private buildInvoiceChild(orderId: string): FulfillmentChild {
    const data: FulfillmentNodeData = { orderId }
    return {
      name: RENDER_INVOICE_JOB,
      queueName: FULFILLMENT_QUEUE,
      data,
      children: [
        { name: FETCH_LINES_JOB, queueName: INVOICES_DATA_QUEUE, data },
        { name: FETCH_CUSTOMER_JOB, queueName: INVOICES_DATA_QUEUE, data },
      ],
    }
  }
}
