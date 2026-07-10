/**
 * @fileoverview Canonical queue names, scheduler ids, and job names for the boot
 * schedulers. The boot registrar, the management controller, and the heartbeat
 * processor all reference this single source of truth, and the queue allow-list
 * gates the management endpoints so untrusted input can never target an arbitrary
 * Redis queue.
 * @layer app/schedulers
 */

/** Queue backing the nightly maintenance scheduler. */
export const MAINTENANCE_QUEUE = 'maintenance'

/** Queue backing the heartbeat and metrics-snapshot schedulers. */
export const MONITORING_QUEUE = 'monitoring'

/**
 * Every queue the scheduler surface manages. The management endpoints validate a
 * requested queue name against this set before touching Redis, refusing to
 * lazily create an arbitrary queue from untrusted input.
 */
export const SCHEDULER_QUEUES = [MAINTENANCE_QUEUE, MONITORING_QUEUE] as const

/** Union of the scheduler-managed queue names. */
export type SchedulerQueue = (typeof SCHEDULER_QUEUES)[number]

/** Stable id (upsert key) of the nightly cleanup scheduler. */
export const NIGHTLY_CLEANUP_ID = 'nightly-cleanup'

/** Stable id (upsert key) of the 30-second demo heartbeat scheduler. */
export const DEMO_HEARTBEAT_ID = 'demo-heartbeat'

/** Stable id (upsert key) of the metrics-snapshot interval scheduler. */
export const METRICS_SNAPSHOT_ID = 'metrics-snapshot'

/** Job name produced by the nightly cleanup scheduler. */
export const CLEANUP_JOB = 'cleanup'

/** Job name produced by the demo heartbeat scheduler. */
export const HEARTBEAT_JOB = 'heartbeat'

/** Job name produced by the metrics-snapshot scheduler. */
export const METRICS_SNAPSHOT_JOB = 'metrics-snapshot'

/** Concurrency for the monitoring tick worker: ticks are trivial, so a small pool suffices. */
export const SCHEDULER_TICK_CONCURRENCY = 2
