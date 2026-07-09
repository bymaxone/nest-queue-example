/**
 * @fileoverview Job-name and option constants for the `email` queue family,
 * shared by the order, onboarding, and campaign producers so a job name is
 * declared exactly once.
 * @layer app/orders
 */

/** Job name for a per-order receipt email. */
export const RECEIPT_JOB = 'send-receipt'

/** Job name for a per-user onboarding welcome email. */
export const WELCOME_JOB = 'send-welcome'

/**
 * BullMQ priority for a VIP order's receipt: lower numbers run first, so `1`
 * jumps ahead of the default (unset) priority.
 */
export const VIP_PRIORITY = 1
