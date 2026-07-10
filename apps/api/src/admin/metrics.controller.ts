/**
 * @fileoverview Cached metrics HTTP surface over the library's `MetricsService`.
 * Exposes the opt-in TTL cache (`get`, `getAll`, `invalidate`) so an overview can
 * aggregate every known queue while a per-second poll reads the cache instead of
 * hammering Redis. The `:queue` param is validated against the managed allow-list
 * so untrusted input can never lazily create an arbitrary Redis queue.
 * @layer app/admin
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { MetricsService } from '@bymax-one/nest-queue'
import type { QueueMetrics } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { assertKnownQueue } from '../queues/queue-names.js'

/**
 * Body accepted by the invalidate action: an optional queue name. Omitting it
 * clears the whole cache; providing a known name drops just that entry.
 */
const invalidateSchema = z.object({ queue: z.string().min(1).optional() })

/** Result of an invalidate call: which scope was dropped. */
export interface InvalidateResult {
  /** `true` when the entire cache was cleared, `false` for a single queue. */
  all: boolean
  /** The queue whose entry was dropped, or `null` when the whole cache was cleared. */
  queue: string | null
}

/** Cached queue-metrics surface for the managed queues. */
@Controller('admin/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * GET /admin/metrics - a cached snapshot for every queue currently cached in
   * the library's `QueueService`.
   *
   * @returns One cached metrics snapshot per known queue.
   */
  @Get()
  all(): Promise<readonly QueueMetrics[]> {
    return this.metrics.getAll()
  }

  /**
   * GET /admin/metrics/:queue - the cached snapshot for one managed queue.
   * Repeated calls inside the TTL window return the same `collectedAt`.
   *
   * @param queue - The queue name (validated against the managed set).
   * @returns The cached metrics snapshot.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Get(':queue')
  one(@Param('queue') queue: string): Promise<QueueMetrics> {
    return this.metrics.get(assertKnownQueue(queue))
  }

  /**
   * POST /admin/metrics/invalidate - force a cache refresh. With `{ queue }` it
   * drops that entry; with an empty body it clears the whole cache, so the next
   * read fetches fresh counts from Redis.
   *
   * @param body - Unvalidated body; parsed against the invalidate schema.
   * @returns The scope that was invalidated.
   * @throws {BadRequestException} When the body is malformed.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue.
   */
  @Post('invalidate')
  @HttpCode(HttpStatus.OK)
  invalidate(@Body() body: unknown): InvalidateResult {
    const { queue } = parseRequest(invalidateSchema, body)
    // Validate a named queue against the allow-list for parity with `one()`, so the
    // invalidate surface never reports success for a queue that was never real.
    const known = queue === undefined ? undefined : assertKnownQueue(queue)
    this.metrics.invalidate(known)
    return { all: known === undefined, queue: known ?? null }
  }
}
