/**
 * @fileoverview In-memory record of successful webhook deliveries. A bounded
 * ring buffer that the webhook processor writes to once a delivery finally
 * succeeds, exposing how many attempts each order took (the retry theater made
 * observable). Demo-only state, kept dependency-free.
 * @layer app/processors
 */
import { Injectable } from '@nestjs/common'

/** Maximum number of delivery records retained; older records are evicted first. */
const WEBHOOK_LOG_CAPACITY = 500

/** A single successful webhook delivery. */
export interface WebhookDelivery {
  /** Identifier of the order whose webhook was delivered. */
  orderId: string
  /** Total attempts it took to deliver, including the successful one. */
  attempts: number
  /** ISO 8601 timestamp of when the delivery was recorded. */
  at: string
}

/** Bounded, in-memory store of successful webhook deliveries. */
@Injectable()
export class WebhookLog {
  private readonly deliveries: WebhookDelivery[] = []

  /**
   * Record a successful delivery, evicting the oldest once capacity is exceeded
   * so memory stays bounded regardless of throughput.
   *
   * @param delivery - The successful delivery to record.
   */
  record(delivery: WebhookDelivery): void {
    this.deliveries.push(delivery)
    if (this.deliveries.length > WEBHOOK_LOG_CAPACITY) {
      this.deliveries.shift()
    }
  }

  /**
   * Return a snapshot of the recorded deliveries, newest last.
   *
   * @returns A copy of the current deliveries; mutating it never affects the log.
   */
  list(): readonly WebhookDelivery[] {
    return [...this.deliveries]
  }
}
