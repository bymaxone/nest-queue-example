/**
 * @fileoverview In-memory record of per-tenant notification deliveries: a bounded
 * ring buffer each dynamic tenant worker appends to as it consumes. Demo-only
 * state; the entries carry only the tenant id, the message, and a timestamp.
 * Delivery is at-least-once, so a redelivered job may append a duplicate entry;
 * the trail is an observation aid, not a ledger.
 * @layer app/workers
 */
import { Injectable } from '@nestjs/common'
import type { TenantDelivery } from './tenant.types.js'

/** Maximum number of deliveries retained; older entries are evicted first. */
const DELIVERIES_CAPACITY = 500

/** Bounded, in-memory store of recorded tenant deliveries. */
@Injectable()
export class TenantDeliveries {
  private readonly deliveries: TenantDelivery[] = []

  /**
   * Append a delivery, evicting the oldest once capacity is exceeded so memory
   * stays bounded no matter how many notifications flow.
   *
   * @param delivery - The recorded delivery.
   */
  record(delivery: TenantDelivery): void {
    this.deliveries.push(delivery)
    if (this.deliveries.length > DELIVERIES_CAPACITY) {
      this.deliveries.shift()
    }
  }

  /**
   * Return a snapshot of the recorded deliveries, oldest first.
   *
   * @returns A copy of the current deliveries; mutating it never affects the store.
   */
  list(): readonly TenantDelivery[] {
    return [...this.deliveries]
  }
}
