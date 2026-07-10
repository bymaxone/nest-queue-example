/**
 * @fileoverview Processor for the `monitoring` queue. A catch-all handler records
 * every scheduled monitoring job (heartbeat and metrics-snapshot) into the
 * {@link HeartbeatTicks} store, so the scheduler clock is observable and the
 * boot-registered schedulers are demonstrably firing.
 * @layer app/schedulers
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { MONITORING_QUEUE, SCHEDULER_TICK_CONCURRENCY } from './scheduler.constants.js'
import { HeartbeatTicks } from './heartbeat-ticks.service.js'

/** Records ticks for every scheduled job on the monitoring queue. */
@Processor(MONITORING_QUEUE, { concurrency: SCHEDULER_TICK_CONCURRENCY })
export class HeartbeatProcessor {
  constructor(private readonly ticks: HeartbeatTicks) {}

  /**
   * Record a monitoring tick. A catch-all handler so both the heartbeat and the
   * metrics-snapshot schedulers register their firings.
   *
   * @param job - The scheduled monitoring job that fired.
   */
  @Process()
  tick(job: Job): void {
    this.ticks.record(job.name)
  }
}
