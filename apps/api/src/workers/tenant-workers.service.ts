/**
 * @fileoverview Manages dynamic per-tenant notification workers at runtime. Wraps
 * the library's `WorkerRegistry` to register a tier-tuned worker per tenant, tear
 * it down on demand, and project the live set. The worker handler records each
 * delivery into {@link TenantDeliveries} so a tenant's consumption is observable.
 * @layer app/workers
 */
import { Injectable } from '@nestjs/common'
import { QueueService, WorkerRegistry } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import {
  NOTIFY_JOB,
  TENANT_QUEUE_PREFIX,
  TIER_CONCURRENCY,
  tenantQueueName,
} from './tenant.constants.js'
import type { TenantTier } from './tenant.constants.js'
import { TenantDeliveries } from './tenant-deliveries.service.js'
import type { NotificationData, TenantDelivery, TenantWorkerView } from './tenant.types.js'

/** Registers, tears down, lists, and feeds the dynamic per-tenant workers. */
@Injectable()
export class TenantWorkersService {
  /** Tier each registered tenant runs at, used to enrich the list projection. */
  private readonly tiers = new Map<string, TenantTier>()

  constructor(
    private readonly registry: WorkerRegistry,
    private readonly queueService: QueueService,
    private readonly deliveries: TenantDeliveries,
  ) {}

  /**
   * Register a worker for a tenant at the given tier. The worker consumes
   * `notifications:<tenantId>` at the tier's concurrency and records every
   * delivery. Records the tier only after a successful registration.
   *
   * @param tenantId - The validated tenant id.
   * @param tier - The service tier (`premium` or `free`).
   * @throws {QueueException} `queue.duplicate_processor` when already registered.
   */
  register(tenantId: string, tier: TenantTier): void {
    this.registry.register<NotificationData, TenantDelivery>({
      queueName: tenantQueueName(tenantId),
      handler: (job) => this.deliver(tenantId, job),
      options: { concurrency: TIER_CONCURRENCY[tier] },
    })
    this.tiers.set(tenantId, tier)
  }

  /**
   * Tear down a tenant's worker, stopping consumption of its queue. A no-op when
   * no worker is registered for the tenant.
   *
   * @param tenantId - The validated tenant id.
   * @returns `true` when a worker existed and was removed, `false` when there was
   *   nothing to remove.
   */
  async unregister(tenantId: string): Promise<boolean> {
    const queueName = tenantQueueName(tenantId)
    const existed = this.registry.list().includes(queueName)
    // Drop the tier only after a successful unregister, so a failure cannot leave
    // the worker registered while its tier metadata is lost (inconsistent list()).
    await this.registry.unregister(queueName)
    this.tiers.delete(tenantId)
    return existed
  }

  /**
   * Project the live tenant workers from the registry, enriched with each tenant's
   * tier. The registry is the source of truth for which workers exist. Passing a
   * `tenantId` scopes the result to that tenant; omitting it returns the full
   * aggregate (this reference app has no auth, so reads are unscoped by default).
   *
   * @param tenantId - Optional tenant id to scope the result to.
   * @returns One view per matching registered tenant worker.
   */
  list(tenantId?: string): TenantWorkerView[] {
    const views = this.registry
      .list()
      .filter((queue) => queue.startsWith(TENANT_QUEUE_PREFIX))
      .map((queue) => {
        const id = queue.slice(TENANT_QUEUE_PREFIX.length)
        return { tenantId: id, queue, tier: this.tiers.get(id) ?? null }
      })
    return tenantId === undefined ? views : views.filter((view) => view.tenantId === tenantId)
  }

  /**
   * Enqueue a notification onto a tenant's queue so its dynamic worker consumes it.
   *
   * @param tenantId - The validated tenant id.
   * @param message - The notification message.
   * @returns The enqueued job.
   */
  notify(tenantId: string, message: string): Promise<Job<NotificationData>> {
    return this.queueService.enqueue<NotificationData>(tenantQueueName(tenantId), NOTIFY_JOB, {
      message,
    })
  }

  /**
   * Return the recorded deliveries, oldest first. Passing a `tenantId` scopes the
   * trail to that tenant; omitting it returns the full aggregate (this reference
   * app has no auth, so reads are unscoped by default).
   *
   * @param tenantId - Optional tenant id to scope the trail to.
   * @returns A snapshot of the matching delivery trail.
   */
  listDeliveries(tenantId?: string): readonly TenantDelivery[] {
    const all = this.deliveries.list()
    return tenantId === undefined ? all : all.filter((entry) => entry.tenantId === tenantId)
  }

  /**
   * Handle one notification job: record the delivery and return it. Delivery is
   * at-least-once, so a redelivered job may record a duplicate trail entry.
   *
   * @param tenantId - The tenant the worker serves.
   * @param job - The notification job.
   * @returns The recorded delivery.
   */
  private deliver(
    tenantId: string,
    job: Job<NotificationData, TenantDelivery>,
  ): Promise<TenantDelivery> {
    const delivery: TenantDelivery = { tenantId, notification: job.data.message, at: Date.now() }
    this.deliveries.record(delivery)
    return Promise.resolve(delivery)
  }
}
