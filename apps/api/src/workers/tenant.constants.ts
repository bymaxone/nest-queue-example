/**
 * @fileoverview Canonical naming and tuning for the dynamic per-tenant notification
 * workers. The tenant queue name is always derived from a validated tenant id
 * through {@link tenantQueueName}, so an untrusted id can never widen the queue
 * namespace it targets.
 * @layer app/workers
 */

/** Prefix for every per-tenant notification queue: `notifications:<tenantId>`. */
export const TENANT_QUEUE_PREFIX = 'notifications:'

/** Job name enqueued onto a tenant queue. */
export const NOTIFY_JOB = 'notify'

/** Service tier a tenant worker runs at. */
export type TenantTier = 'premium' | 'free'

/** Concurrency each tier maps to: premium workers overlap more in-flight deliveries. */
export const TIER_CONCURRENCY: Record<TenantTier, number> = {
  premium: 10,
  free: 2,
}

/**
 * Derive the queue name for a tenant. The id is validated at the trust boundary
 * (alphanumeric plus dash/underscore, never a colon), so the derived name always
 * stays inside the `notifications:` namespace and cannot target another queue.
 *
 * @param tenantId - The validated tenant id.
 * @returns The tenant's notification queue name.
 */
export function tenantQueueName(tenantId: string): string {
  return `${TENANT_QUEUE_PREFIX}${tenantId}`
}
