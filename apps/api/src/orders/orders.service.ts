/**
 * @fileoverview Order placement service. Stores the order in memory and enqueues
 * a strongly-typed `send-receipt` email job. The email processor arrives later,
 * so the job waits — which is itself a visible, correct demonstration of the
 * producer/consumer split.
 * @layer app/orders
 */
import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { RECEIPT_JOB } from './order-jobs.constants.js'
import type { ReceiptEmailJobData, ReceiptEmailJobResult } from './order-jobs.types.js'
import { OrdersRepository } from './orders.repository.js'

/** Validated input accepted by {@link OrdersService.place}. */
export interface PlaceOrderInput {
  /** Destination email address for the receipt. */
  to: string
  /** Order total amount. */
  total: number
  /** Whether the order is flagged VIP. */
  vip: boolean
}

/** Outcome of placing an order: the stored id and the enqueued receipt job id. */
export interface PlacedOrder {
  /** The stored order id. */
  orderId: string
  /** The enqueued `send-receipt` job id (undefined only if BullMQ omits it). */
  jobId: string | undefined
}

/** Places orders and enqueues their receipt emails. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly queueService: QueueService,
    private readonly repository: OrdersRepository,
  ) {}

  /**
   * Store an order and enqueue its typed receipt email.
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
    )
    return { orderId: order.id, jobId: job.id }
  }
}
