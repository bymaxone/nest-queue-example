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
import type { FlowTreeNode } from './fulfillment.types.js'

/** Upper bound on an order id; a demo guardrail against absurd input. */
const MAX_ORDER_ID_LENGTH = 128

/** Order ids are conservative identifiers: alphanumeric plus dash/underscore. */
const orderIdSchema = z
  .string()
  .min(1)
  .max(MAX_ORDER_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)

/** A root job id: the same conservative identifier shape as an order id. */
const rootIdSchema = orderIdSchema

/** Body accepted by the fulfillment launcher. The only variant here is the happy path. */
const launchSchema = z.object({
  orderId: orderIdSchema,
  variant: z.literal('default').default('default'),
})

/** Outcome of launching a fulfillment flow: the root job id and the order id. */
export interface FlowLaunched {
  /** The root (`ship-order`) job id, used to read the tree back. */
  rootId: string | undefined
  /** The order the flow fulfills. */
  orderId: string
}

/** Launches fulfillment flows and reads their live tree and execution trace. */
@Controller('flows')
export class FlowsController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly trace: FlowTrace,
  ) {}

  /**
   * Launch a fulfillment flow for the given order.
   *
   * @param body - The unknown request body carrying the order id.
   * @returns The root job id and the order id.
   * @throws {BadRequestException} When the body is malformed.
   */
  @Post('fulfillment')
  async launch(@Body() body: unknown): Promise<FlowLaunched> {
    const { orderId } = parseRequest(launchSchema, body)
    const root = await this.fulfillment.run(orderId)
    return { rootId: root.job.id, orderId }
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
