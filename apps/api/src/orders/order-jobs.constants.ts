/**
 * @fileoverview Job-name and option constants for jobs triggered by the order
 * lifecycle: the `email` queue family (receipt, welcome) and the `webhooks`
 * fan-out. Declared once here so producers and their consuming processors share
 * a single source of truth for each job name.
 * @layer app/orders
 */

/** Job name for a per-order receipt email. */
export const RECEIPT_JOB = 'send-receipt'

/** Job name for a per-user onboarding welcome email. */
export const WELCOME_JOB = 'send-welcome'

/** Job name for the `webhooks` fan-out enqueued when an order is placed. */
export const ORDER_CREATED_JOB = 'order-created'

/**
 * BullMQ priority for a VIP order's receipt: lower numbers run first, so `1`
 * jumps ahead of the default (unset) priority.
 */
export const VIP_PRIORITY = 1
