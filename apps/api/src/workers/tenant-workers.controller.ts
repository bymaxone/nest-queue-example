/**
 * @fileoverview HTTP surface for the dynamic per-tenant workers: register, list,
 * remove, feed, and read the delivery trail. Every input is validated at the trust
 * boundary; the tenant id is a strict identifier (never a dot or colon), so the
 * derived queue name always stays inside the tenant's own `notifications.` namespace and
 * one tenant's request can never target another tenant's worker.
 * @layer app/workers
 */
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { tenantQueueName } from './tenant.constants.js'
import type { TenantTier } from './tenant.constants.js'
import { TenantWorkersService } from './tenant-workers.service.js'
import type { TenantDelivery, TenantWorkerView } from './tenant.types.js'

/** Upper bound on a tenant id length; a demo guardrail against absurd input. */
const MAX_TENANT_ID_LENGTH = 64

/** Upper bound on a notification message length. */
const MAX_MESSAGE_LENGTH = 512

/** Tenant ids are strict identifiers: alphanumeric plus dash/underscore, no colon. */
const tenantIdSchema = z
  .string()
  .min(1)
  .max(MAX_TENANT_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)

/** Body accepted when registering a tenant worker. */
const registerSchema = z.object({ tenantId: tenantIdSchema, tier: z.enum(['premium', 'free']) })

/** Body accepted when sending a notification. */
const notifySchema = z.object({ message: z.string().min(1).max(MAX_MESSAGE_LENGTH) })

/** Query accepted by the read endpoints: an optional tenant id to scope the result. */
const scopeQuerySchema = z.object({ tenantId: tenantIdSchema.optional() })

/** Outcome of registering a tenant worker. */
export interface TenantRegistered {
  /** The tenant the worker serves. */
  tenantId: string
  /** The tier the worker runs at. */
  tier: TenantTier
  /** The tenant's notification queue. */
  queue: string
}

/** Manages the dynamic per-tenant notification workers. */
@Controller('workers/tenants')
export class TenantWorkersController {
  constructor(private readonly tenants: TenantWorkersService) {}

  /**
   * Register a worker for a tenant at a tier.
   *
   * @param body - The unknown request body carrying the tenant id and tier.
   * @returns The registered tenant, tier, and queue.
   * @throws {BadRequestException} When the body is malformed.
   * @throws {QueueException} `queue.duplicate_processor` when already registered.
   */
  @Post()
  register(@Body() body: unknown): TenantRegistered {
    const { tenantId, tier } = parseRequest(registerSchema, body)
    this.tenants.register(tenantId, tier)
    return { tenantId, tier, queue: tenantQueueName(tenantId) }
  }

  /**
   * List the registered tenant workers, optionally scoped to one tenant.
   *
   * @param query - The unknown query carrying an optional tenant id.
   * @returns One view per matching registered tenant worker.
   * @throws {BadRequestException} When the query is malformed.
   */
  @Get()
  list(@Query() query: unknown): { workers: TenantWorkerView[] } {
    const { tenantId } = parseRequest(scopeQuerySchema, query)
    return { workers: this.tenants.list(tenantId) }
  }

  /**
   * Return the recorded delivery trail, oldest first, optionally scoped to one
   * tenant.
   *
   * @param query - The unknown query carrying an optional tenant id.
   * @returns The recorded deliveries.
   * @throws {BadRequestException} When the query is malformed.
   */
  @Get('deliveries')
  deliveries(@Query() query: unknown): { deliveries: readonly TenantDelivery[] } {
    const { tenantId } = parseRequest(scopeQuerySchema, query)
    return { deliveries: this.tenants.listDeliveries(tenantId) }
  }

  /**
   * Enqueue a notification onto a tenant's queue so its worker consumes it.
   *
   * @param tenantId - The tenant to notify (validated).
   * @param body - The unknown request body carrying the message.
   * @returns The tenant and the enqueued job id.
   * @throws {BadRequestException} When the id or body is malformed.
   */
  @Post(':tenantId/notify')
  async notify(
    @Param('tenantId') tenantId: unknown,
    @Body() body: unknown,
  ): Promise<{ tenantId: string; jobId: string | undefined }> {
    const id = parseRequest(tenantIdSchema, tenantId)
    const { message } = parseRequest(notifySchema, body)
    const job = await this.tenants.notify(id, message)
    return { tenantId: id, jobId: job.id }
  }

  /**
   * Tear down a tenant's worker, stopping consumption of its queue.
   *
   * @param tenantId - The tenant whose worker to remove (validated).
   * @returns The tenant and whether a worker actually existed and was removed.
   * @throws {BadRequestException} When the id is malformed.
   */
  @Delete(':tenantId')
  async remove(
    @Param('tenantId') tenantId: unknown,
  ): Promise<{ tenantId: string; unregistered: boolean }> {
    const id = parseRequest(tenantIdSchema, tenantId)
    const unregistered = await this.tenants.unregister(id)
    return { tenantId: id, unregistered }
  }
}
