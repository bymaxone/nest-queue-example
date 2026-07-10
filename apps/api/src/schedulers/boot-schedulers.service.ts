/**
 * @fileoverview Registers the recurring Job Schedulers at application bootstrap.
 * Three schedulers demonstrate the supported schedule kinds: a 5-field cron with a
 * timezone, a 6-field (seconds) cron, and a fixed interval with a phase offset and
 * a run cap. Registration is idempotent by scheduler id, so re-running it on every
 * boot updates each schedule in place and never creates a duplicate.
 * @layer app/schedulers
 */
import { Injectable } from '@nestjs/common'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import {
  CLEANUP_JOB,
  DEMO_HEARTBEAT_ID,
  HEARTBEAT_JOB,
  MAINTENANCE_QUEUE,
  METRICS_SNAPSHOT_ID,
  METRICS_SNAPSHOT_JOB,
  MONITORING_QUEUE,
  NIGHTLY_CLEANUP_ID,
} from './scheduler.constants.js'
import type { CleanupJobData, HeartbeatJobData, MetricsSnapshotJobData } from './scheduler.types.js'

/** Nightly cleanup cron: every day at 03:00 (5-field). */
const NIGHTLY_CRON = '0 3 * * *'

/** Timezone the nightly cron is evaluated in. */
const NIGHTLY_TZ = 'America/Sao_Paulo'

/** Demo heartbeat cron: every 30 seconds (6-field, seconds granularity). */
const HEARTBEAT_CRON = '*/30 * * * * *'

/** Metrics-snapshot interval: every five minutes. */
const METRICS_EVERY_MS = 300_000

/** Phase offset applied to the metrics-snapshot interval. */
const METRICS_OFFSET_MS = 15_000

/** Cap on the number of metrics-snapshot runs. */
const METRICS_LIMIT = 100

/** Registers the boot-time recurring schedulers, idempotently by scheduler id. */
@Injectable()
export class BootSchedulersService implements OnApplicationBootstrap {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Upsert every recurring scheduler once the application has fully started.
   * Because each upsert is idempotent by its stable id, a reboot re-registers the
   * same three schedulers without duplicating any of them.
   */
  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([
      this.registerNightlyCleanup(),
      this.registerHeartbeat(),
      this.registerMetricsSnapshot(),
    ])
  }

  /**
   * Register the nightly cleanup scheduler (5-field cron with a timezone).
   *
   * @returns The first scheduled job, or `undefined`.
   */
  private registerNightlyCleanup(): Promise<unknown> {
    return this.queueService.upsertJobScheduler<CleanupJobData>(
      MAINTENANCE_QUEUE,
      NIGHTLY_CLEANUP_ID,
      { pattern: NIGHTLY_CRON, tz: NIGHTLY_TZ },
      { name: CLEANUP_JOB, data: { mode: 'soft' } },
    )
  }

  /**
   * Register the demo heartbeat scheduler (6-field, seconds-granularity cron).
   *
   * @returns The first scheduled job, or `undefined`.
   */
  private registerHeartbeat(): Promise<unknown> {
    return this.queueService.upsertJobScheduler<HeartbeatJobData>(
      MONITORING_QUEUE,
      DEMO_HEARTBEAT_ID,
      { pattern: HEARTBEAT_CRON },
      { name: HEARTBEAT_JOB, data: { service: 'api' } },
    )
  }

  /**
   * Register the metrics-snapshot scheduler (fixed interval with offset and limit).
   *
   * @returns The first scheduled job, or `undefined`.
   */
  private registerMetricsSnapshot(): Promise<unknown> {
    return this.queueService.upsertJobScheduler<MetricsSnapshotJobData>(
      MONITORING_QUEUE,
      METRICS_SNAPSHOT_ID,
      { every: METRICS_EVERY_MS, offset: METRICS_OFFSET_MS, limit: METRICS_LIMIT },
      { name: METRICS_SNAPSHOT_JOB, data: { scope: 'all' } },
    )
  }
}
