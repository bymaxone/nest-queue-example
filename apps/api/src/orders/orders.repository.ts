/**
 * @fileoverview In-memory order store for the demo domain. Bounded to a fixed
 * capacity so a long-running demo never grows without limit: when the cap is
 * reached the oldest order is evicted (insertion-ordered `Map`). This is not a
 * database; the example is deliberately Redis-only.
 * @layer app/orders
 */
import { Injectable } from '@nestjs/common'

/** Maximum number of orders retained; the oldest is evicted past this. */
const MAX_ORDERS = 500

/** A stored order in the in-memory demo repository. */
export interface StoredOrder {
  /** Server-generated unique order id. */
  id: string
  /** Destination email address for the receipt. */
  to: string
  /** Order total amount. */
  total: number
  /** Whether the order is flagged VIP (jumps the email queue). */
  vip: boolean
  /** ISO 8601 UTC timestamp of when the order was placed. */
  createdAt: string
}

/** Bounded, insertion-ordered in-memory repository of demo orders. */
@Injectable()
export class OrdersRepository {
  /** Insertion-ordered store; iteration yields oldest-first for eviction. */
  private readonly orders = new Map<string, StoredOrder>()

  /**
   * Persist an order, evicting the oldest entry first when at capacity.
   *
   * @param order - The order to store.
   * @returns The stored order (unchanged).
   */
  save(order: StoredOrder): StoredOrder {
    if (this.orders.size >= MAX_ORDERS && !this.orders.has(order.id)) {
      // Inside this block the store is at capacity, so it is never empty: the
      // first key is the oldest entry. Iterate-and-break to drop exactly it.
      for (const oldest of this.orders.keys()) {
        this.orders.delete(oldest)
        break
      }
    }
    this.orders.set(order.id, order)
    return order
  }

  /**
   * Look up an order by id.
   *
   * @param id - The order id.
   * @returns The stored order, or `undefined` when absent.
   */
  find(id: string): StoredOrder | undefined {
    return this.orders.get(id)
  }
}
