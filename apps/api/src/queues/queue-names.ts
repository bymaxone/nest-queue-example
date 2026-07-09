/**
 * @fileoverview Canonical BullMQ queue names used across the example. Producers,
 * the admin plane, and processors all reference this single source of truth so
 * the admin allow-list can validate a requested queue name and refuse to create
 * an arbitrary queue from untrusted input.
 * @layer app/queues
 */

/** The `email` queue carries receipt and welcome notification jobs. */
export const EMAIL_QUEUE = 'email'

/** The `search` queue carries index-rebuild jobs (the deduplication lab). */
export const SEARCH_QUEUE = 'search'

/** The `audit` queue backs the boot-time smoke journey. */
export const AUDIT_QUEUE = 'audit'

/** The `webhooks` queue carries order-created fan-out jobs (the retry theater). */
export const WEBHOOKS_QUEUE = 'webhooks'

/** The `reports` queue carries long-running report-generation jobs (progress + lock tuning). */
export const REPORTS_QUEUE = 'reports'

/**
 * Every queue name the example registers. The admin plane validates a requested
 * queue name against this set before touching Redis, surfacing
 * `queue.queue_not_found` for anything else instead of lazily creating it.
 */
export const KNOWN_QUEUES = [
  EMAIL_QUEUE,
  SEARCH_QUEUE,
  AUDIT_QUEUE,
  WEBHOOKS_QUEUE,
  REPORTS_QUEUE,
] as const

/** Union of the known queue names. */
export type KnownQueue = (typeof KNOWN_QUEUES)[number]
