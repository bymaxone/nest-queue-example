/**
 * @fileoverview Environment-derived constants for the browser client. The API
 * origin is read from `NEXT_PUBLIC_API_URL` (never hardcoded, never a secret)
 * so the dashboard can point at any running `apps/api` instance.
 * @layer lib/constants
 */

/** Base URL the browser calls for every API request. */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3080'

/** Poll interval (ms) for metrics and other near-real-time reads, aligned with the API's 3s metrics cache TTL. */
export const METRICS_POLL_INTERVAL_MS = 3_000

/** Poll interval (ms) for the topbar Redis readiness chip. */
export const HEALTH_POLL_INTERVAL_MS = 5_000
