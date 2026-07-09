/**
 * @fileoverview Job-name and option constants for the `email` queue family,
 * shared by the order, onboarding, and campaign producers so a job name is
 * declared exactly once.
 * @layer app/orders
 */

/** Job name for a per-order receipt email. */
export const RECEIPT_JOB = 'send-receipt'
