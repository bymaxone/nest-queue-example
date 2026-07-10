/**
 * @fileoverview Flows HTTP surface. Launches the fulfillment flow, reads its live
 * tree (via the producer escape hatch), and exposes the in-memory execution trace.
 * All request input is validated at the trust boundary; the tree response carries
 * only structural fields and never job data, so nothing sensitive leaks.
 * @layer app/flows
 */
import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { FULFILLMENT_QUEUE } from './fulfillment.constants.js'
import { FlowTrace } from './flow-trace.service.js'
import type { FlowTraceEntry } from './flow-trace.service.js'
import { FulfillmentService } from './fulfillment.service.js'
import type { FlowTreeNode, FulfillmentVariant } from './fulfillment.types.js'

/** Upper bound on an order id; a demo guardrail against absurd input. */
const MAX_ORDER_ID_LENGTH = 128

/** Upper bound on a bulk launch; each flow fans out into six jobs, so keep it small. */
const MAX_BULK_ORDERS = 50

/** Order ids are conservative identifiers: alphanumeric plus dash/underscore. */
const orderIdSchema = z
  .string()
  .min(1)
  .max(MAX_ORDER_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)

/** A root job id: the same conservative identifier shape as an order id. */
const rootIdSchema = orderIdSchema

/** The four failure-propagation postures, defaulting to the happy path. */
const variantSchema = z
  .enum(['default', 'stuck', 'failParent', 'ignoreDependency'])
  .default('default')

/** Body accepted by the single-flow launcher. */
const launchSchema = z.object({ orderId: orderIdSchema, variant: variantSchema })

/** Body accepted by the bulk launcher: one flow per order id, one shared variant. */
const bulkSchema = z.object({
  orderIds: z.array(orderIdSchema).min(1).max(MAX_BULK_ORDERS),
  variant: variantSchema,
})

/** The root job id paired with the order it fulfills. */
export interface FlowRoot {
  /** The root (`ship-order`) job id, used to read the tree back. */
  rootId: string | undefined
  /** The order the flow fulfills. */
  orderId: string
}

/** Outcome of launching a single fulfillment flow. */
export interface FlowLaunched extends FlowRoot {
  /** The failure-propagation posture the flow was launched with. */
  variant: FulfillmentVariant
}

/** Outcome of a bulk launch: the roots in input order plus the shared variant. */
export interface FlowsLaunched {
  /** The created flow roots, preserving input order. */
  roots: FlowRoot[]
  /** The failure-propagation posture applied to every flow. */
  variant: FulfillmentVariant
}

/** Launches fulfillment flows and reads their live tree and execution trace. */
@Controller('flows')
export class FlowsController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly trace: FlowTrace,
  ) {}

  /**
   * Launch a fulfillment flow for the given order and failure-propagation variant.
   *
   * @param body - The unknown request body carrying the order id and variant.
   * @returns The root job id, the order id, and the variant.
   * @throws {BadRequestException} When the body is malformed.
   */
  @Post('fulfillment')
  async launch(@Body() body: unknown): Promise<FlowLaunched> {
    const { orderId, variant } = parseRequest(launchSchema, body)
    const root = await this.fulfillment.run(orderId, variant)
    return { rootId: root.job.id, orderId, variant }
  }

  /**
   * Launch several fulfillment flows in one Redis roundtrip via `addBulk`.
   *
   * @param body - The unknown request body carrying the order ids and variant.
   * @returns The created roots in input order and the shared variant.
   * @throws {BadRequestException} When the body is malformed.
   */
  @Post('fulfillment/bulk')
  async launchBulk(@Body() body: unknown): Promise<FlowsLaunched> {
    const { orderIds, variant } = parseRequest(bulkSchema, body)
    const nodes = await this.fulfillment.runBulk(orderIds, variant)
    // Map over the input ids (not the nodes) so every root keeps its `string`
    // order id and pairs positionally with the node addBulk returned for it.
    const roots = orderIds.map((orderId, index) => ({ rootId: nodes[index]?.job.id, orderId }))
    return { roots, variant }
  }

  /**
   * Return the in-memory execution trace, oldest first, so the child-before-parent
   * ordering is observable without Redis access.
   *
   * @returns The recorded flow-node executions.
   */
  @Get('trace')
  readTrace(): { entries: readonly FlowTraceEntry[] } {
    return { entries: this.trace.list() }
  }

  /**
   * Read the live flow tree rooted at a job id.
   *
   * @param rootId - The root job id returned when the flow was launched.
   * @returns The projected tree with per-node status.
   * @throws {BadRequestException} When the id is malformed.
   * @throws {QueueException} `queue.job_not_found` (404) when no flow exists.
   */
  @Get(':rootId/tree')
  async tree(@Param('rootId') rootId: unknown): Promise<FlowTreeNode> {
    const id = parseRequest(rootIdSchema, rootId)
    const node = await this.fulfillment.readTree(id)
    if (node === null) {
      throw new QueueException(QUEUE_ERROR_CODES.JOB_NOT_FOUND, HttpStatus.NOT_FOUND, {
        queue: FULFILLMENT_QUEUE,
        jobId: id,
      })
    }
    return node
  }
}
