/**
 * @fileoverview Local mirrors of the `apps/api` response DTOs. The library's
 * `./shared` subpath only exports `JobStatus`, `QueueMetrics`,
 * `JobSchedulerRepeatOptions`, and `QUEUE_ERROR_CODES` (row 69) - every other
 * shape returned by this app's own controllers (job views, flow trees,
 * scheduler entries, tenant workers, the error catalog, the event feed) is
 * mirrored here so the browser stays on pure, server-free types. Kept in sync
 * by hand with the matching `apps/api/src/**` interfaces.
 * @layer lib/api-types
 */
import type { QueueErrorCode } from '@bymax-one/nest-queue/shared'

/** Mirrors `apps/api/src/admin/queues.service.ts` `JobView`. */
export interface JobView {
  id: string | undefined
  name: string
  data: unknown
  timestamp: number
  attemptsMade: number
  delay: number
  progress: unknown
  returnValue: unknown
  failedReason: string | undefined
}

/** Statuses BullMQ's `clean` action accepts. */
export const CLEAN_STATUSES = [
  'completed',
  'failed',
  'delayed',
  'wait',
  'active',
  'paused',
] as const

/** A status accepted by the queue clean action. */
export type CleanStatus = (typeof CLEAN_STATUSES)[number]

/** Mirrors `apps/api/src/admin/metrics.controller.ts` `InvalidateResult`. */
export interface InvalidateResult {
  all: boolean
  queue: string | null
}

/** Mirrors `apps/api/src/admin/diagnostics.controller.ts` `ConnectionDiagnostics`. */
export interface ConnectionDiagnostics {
  mode: 'mode-a-byo' | 'mode-b-owned'
  style: 'url' | 'options'
  queueRoleMaxRetries: number | null
  workerRoleMaxRetries: number | null
}

/** Mirrors `apps/api/src/admin/diagnostics.controller.ts` `DiagnosticsSnapshot`. */
export interface DiagnosticsSnapshot {
  mode: 'mode-a-byo' | 'mode-b-owned'
  prefix: string | undefined
  flowsEnabled: boolean
  metricsEnabled: boolean
  connection: ConnectionDiagnostics
}

/** Mirrors `apps/api/src/admin/health.controller.ts` readiness payload. */
export interface ReadinessStatus {
  status: 'up'
  activeJobs: number
}

/** The four failure-propagation postures a fulfillment flow can be launched with. */
export type FulfillmentVariant = 'default' | 'stuck' | 'failParent' | 'ignoreDependency'

/** Mirrors `apps/api/src/flows/flows.controller.ts` `FlowRoot`. */
export interface FlowRoot {
  rootId: string | undefined
  orderId: string
}

/** Mirrors `apps/api/src/flows/flows.controller.ts` `FlowLaunched`. */
export interface FlowLaunched extends FlowRoot {
  variant: FulfillmentVariant
}

/** Mirrors `apps/api/src/flows/flows.controller.ts` `FlowsLaunched`. */
export interface FlowsLaunched {
  roots: FlowRoot[]
  variant: FulfillmentVariant
}

/** Mirrors `apps/api/src/flows/fulfillment.types.ts` `FlowTreeNode`. */
export interface FlowTreeNode {
  id: string | undefined
  name: string
  queue: string
  status: string
  children: FlowTreeNode[]
}

/** Mirrors `apps/api/src/flows/flow-trace.service.ts` `FlowTraceEntry`. */
export interface FlowTraceEntry {
  node: string
  at: number
}

/** Mirrors bullmq's `JobSchedulerJson` as re-exported by the library's server subpath. */
export interface JobSchedulerJson {
  key: string
  name: string
  id?: string | null
  iterationCount?: number
  limit?: number
  startDate?: number
  endDate?: number
  tz?: string
  pattern?: string
  every?: number
  next?: number
  offset?: number
  template?: {
    data?: unknown
    opts?: Record<string, unknown>
  }
}

/** Mirrors `apps/api/src/schedulers/schedulers.controller.ts` `SchedulerUpserted`. */
export interface SchedulerUpserted {
  schedulerId: string
  firstJobId: string | null
}

/** Mirrors `apps/api/src/schedulers/scheduler.types.ts` `SchedulerTick`. */
export interface SchedulerTick {
  job: string
  at: number
}

/** Service tier a tenant worker runs at. */
export type TenantTier = 'premium' | 'free'

/** Mirrors `apps/api/src/workers/tenant-workers.controller.ts` `TenantRegistered`. */
export interface TenantRegistered {
  tenantId: string
  tier: TenantTier
  queue: string
}

/** Mirrors `apps/api/src/workers/tenant.types.ts` `TenantWorkerView`. */
export interface TenantWorkerView {
  tenantId: string
  queue: string
  tier: TenantTier | null
}

/** Mirrors `apps/api/src/workers/tenant.types.ts` `TenantDelivery`. */
export interface TenantDelivery {
  tenantId: string
  notification: string
  at: number
}

/** Mirrors `apps/api/src/workers/invoices.controller.ts` `RenderRequested`. */
export interface RenderRequested {
  invoiceId: string
  jobId: string | undefined
}

/** Mirrors `apps/api/src/workers/lag-probe.service.ts` `LagSample`. */
export interface LagSample {
  meanMs: number
  maxMs: number
}

/** Who raises a catalog code: the library itself, or this consumer using the library's exception. */
export type ErrorOrigin = 'library' | 'consumer'

/** Mirrors `apps/api/src/errors/error-catalog.ts` `CatalogEntry`. */
export interface CatalogEntry {
  code: QueueErrorCode
  message: string
  httpStatus: number
  reproducibleHere: boolean
  raisedBy: ErrorOrigin
  coveredBy: string
}

/** Where a feed entry originated. */
export type FeedSource = 'worker' | 'global'

/** Mirrors `apps/api/src/events/event-feed.types.ts` `FeedEntry`. */
export interface FeedEntry {
  source: FeedSource
  queue: string
  event: string
  jobId: string | undefined
  at: string
  data?: unknown
  returnvalue?: unknown
  progress?: unknown
  attemptsMade?: number
  failedReason?: string
  resolvedData?: unknown
}

/** Mirrors `apps/api/src/orders/orders.service.ts` `PlacedOrder`. */
export interface PlacedOrder {
  orderId: string
  jobId: string | undefined
}

/** Mirrors `apps/api/src/orders/campaign.service.ts` `CampaignResult`. */
export interface CampaignResult {
  enqueued: number
  jobIds: (string | undefined)[]
}

/** The four BullMQ-native deduplication strategies the reindex lab exposes. */
export const DEDUP_MODES = ['simple', 'throttle', 'debounce', 'keepLast'] as const

/** A deduplication strategy accepted by the reindex lab. */
export type DedupMode = (typeof DEDUP_MODES)[number]

/** Mirrors `apps/api/src/search/reindex.service.ts` `ReindexResult`. */
export interface ReindexResult {
  jobId: string | undefined
  deduplicated: boolean
}

/** Mirrors `apps/api/src/orders/onboarding.service.ts` `OnboardingResult`. */
export interface OnboardingResult {
  created: boolean
  jobId: string
}

/** The six queues the admin/metrics surface manages (mirrors `queue-names.ts`). */
export const KNOWN_QUEUES = ['email', 'search', 'audit', 'webhooks', 'reports', 'demos'] as const

/** A queue name managed by the admin surface. */
export type KnownQueue = (typeof KNOWN_QUEUES)[number]

/** The two queues the scheduler management surface manages. */
export const SCHEDULER_QUEUES = ['maintenance', 'monitoring'] as const

/** A queue name managed by the scheduler surface. */
export type SchedulerQueue = (typeof SCHEDULER_QUEUES)[number]
