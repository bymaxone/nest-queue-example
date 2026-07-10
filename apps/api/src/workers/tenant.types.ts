/**
 * @fileoverview Typed contracts for the dynamic per-tenant workers: the enqueued
 * notification payload, the recorded delivery, and the list projection. Free of
 * server imports so the shapes can be mirrored without pulling in NestJS.
 * @layer app/workers
 */
import type { TenantTier } from './tenant.constants.js'

/** Payload of a notification job enqueued onto a tenant queue. */
export interface NotificationData {
  /** The notification message to deliver. */
  message: string
}

/** A recorded delivery: which tenant received which notification, and when. */
export interface TenantDelivery {
  /** The tenant the notification was delivered to. */
  tenantId: string
  /** The delivered notification message. */
  notification: string
  /** Epoch milliseconds when the delivery was recorded. */
  at: number
}

/** A registered tenant worker as projected for the list endpoint. */
export interface TenantWorkerView {
  /** The tenant the worker serves. */
  tenantId: string
  /** The tenant's notification queue. */
  queue: string
  /** The tier the worker was registered at, or null when unknown. */
  tier: TenantTier | null
}
