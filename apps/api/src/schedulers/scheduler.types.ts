/**
 * @fileoverview Typed contracts for the boot schedulers: the per-scheduler job
 * templates and the recorded monitoring tick. Kept free of server imports so the
 * shapes can be mirrored without pulling in NestJS.
 * @layer app/schedulers
 */

/** Template data for the nightly cleanup job. */
export interface CleanupJobData {
  /** Cleanup aggressiveness; the demo always runs the non-destructive mode. */
  mode: 'soft'
}

/** Template data for the demo heartbeat job. */
export interface HeartbeatJobData {
  /** The service the heartbeat reports for. */
  service: string
}

/** Template data for the metrics-snapshot job. */
export interface MetricsSnapshotJobData {
  /** The scope the snapshot covers. */
  scope: 'all'
}

/** A recorded scheduler tick: which monitoring job fired and when. */
export interface SchedulerTick {
  /** The job name that fired (heartbeat or metrics-snapshot). */
  job: string
  /** Epoch milliseconds when the tick was recorded. */
  at: number
}
