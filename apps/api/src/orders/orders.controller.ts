/**
 * @fileoverview Orders HTTP surface. Thin controller: validate the body at the
 * trust boundary, delegate to the service, return the result. Invalid payloads
 * surface the library's stable `queue.invalid_job_data` envelope.
 * @layer app/orders
 */
import { Body, Controller, Post } from '@nestjs/common'
import { z } from 'zod'
import { parseJobData } from '../http/validation.js'
import { OrdersService } from './orders.service.js'
import type { PlacedOrder } from './orders.service.js'

/** Upper bound on an order total; a demo guardrail against absurd input. */
const MAX_ORDER_TOTAL = 1_000_000

/**
 * Body accepted by `POST /orders`. The email uses the HTML5 pattern (matching a
 * browser `type="email"` field) rather than zod's stricter default, which would
 * reject short but legal addresses such as the docs' `a@b.c` sample.
 */
const placeOrderSchema = z.object({
  to: z.email({ pattern: z.regexes.html5Email }),
  total: z.number().positive().max(MAX_ORDER_TOTAL),
  vip: z.boolean().default(false),
})

/** Enqueue surface for placing orders. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Place an order: validate, store, and enqueue its typed receipt email.
   *
   * @param body - Unvalidated request body; parsed against the order schema.
   * @returns The stored order id and the enqueued receipt job id.
   * @throws {QueueException} `queue.invalid_job_data` (400) for a bad payload.
   */
  @Post()
  async place(@Body() body: unknown): Promise<PlacedOrder> {
    const input = parseJobData(placeOrderSchema, body)
    return this.orders.place(input)
  }
}
