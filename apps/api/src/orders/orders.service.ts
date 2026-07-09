/**
 * @fileoverview Order placement service. Stores the order in memory and enqueues
 * strongly-typed email jobs: a `send-receipt` on placement (VIP orders jump the
 * queue via priority) and a delayed reminder on demand. The email processor
 * arrives later, so the jobs wait: a visible, correct producer/consumer split.
 * @layer app/orders
 */
import { randomUUID } from 'node:crypto'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB, VIP_PRIORITY } from './order-jobs.constants.js'
import type { ReceiptEmailJobData, ReceiptEmailJobResult } from './order-jobs.types.js'
import { OrdersRepository } from './orders.repository.js'

/** Validated input accepted by {@link OrdersService.place}. */
export interface PlaceOrderInput {
  /** Destination email address for the receipt. */
  to: string
  /** Order total amount. */
  total: number
  /** Whether the order is flagged VIP (its receipt jumps the queue). */
  vip: boolean
}

/** Outcome of a producer action: the order id and the enqueued job id. */
export interface PlacedOrder {
  /** The stored order id. */
  orderId: string
  /** The enqueued job id (undefined only if BullMQ omits it). */
  jobId: string | undefined
}

/** Places orders and enqueues their receipt and reminder emails. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly queueService: QueueService,
    private readonly repository: OrdersRepository,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /**
   * Store an order and enqueue its typed receipt email. A VIP order enqueues at
   * the highest priority so its receipt is processed ahead of standard orders.
   *
   * @param input - The validated order payload.
   * @returns The stored order id and the enqueued receipt job id.
   */
  async place(input: PlaceOrderInput): Promise<PlacedOrder> {
    const order = this.repository.save({
      id: randomUUID(),
      to: input.to,
      total: input.total,
      vip: input.vip,
      createdAt: new Date().toISOString(),
    })
    const job = await this.queueService.enqueue<ReceiptEmailJobData, ReceiptEmailJobResult>(
      EMAIL_QUEUE,
      RECEIPT_JOB,
      { orderId: order.id, to: order.to, total: order.total },
      input.vip ? { priority: VIP_PRIORITY } : undefined,
    )
    return { orderId: order.id, jobId: job.id }
  }

  /**
   * Enqueue a delayed reminder receipt for an existing order. The job lands in
   * the `delayed` status until its delay elapses.
   *
   * @param orderId - The id of the order to remind about.
   * @returns The order id and the enqueued reminder job id.
   * @throws {NotFoundException} When no order with that id exists.
   */
  async remind(orderId: string): Promise<PlacedOrder> {
    const order = this.repository.find(orderId)
    if (!order) {
      throw new NotFoundException({
        error: { code: 'order_not_found', message: 'Order not found', details: { orderId } },
      })
    }
    const job = await this.queueService.enqueue<ReceiptEmailJobData, ReceiptEmailJobResult>(
      EMAIL_QUEUE,
      RECEIPT_JOB,
      { orderId: order.id, to: order.to, total: order.total },
      { delay: this.env.REMINDER_DELAY_MS },
    )
    return { orderId: order.id, jobId: job.id }
  }
}
