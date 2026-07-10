/**
 * @fileoverview Liveness and readiness endpoints. Liveness is a static "process
 * is up" signal; readiness composes the library's `MetricsService` (the documented
 * consumer-side health pattern): a cached `get` on a known queue proves Redis is
 * reachable while exercising the TTL cache, and `getAll` aggregates the active
 * count across every cached queue. It returns 503 (never leaking the connection
 * string) when the backend is unreachable.
 * @layer app/admin
 */
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { MetricsService } from '@bymax-one/nest-queue'
import { AUDIT_QUEUE } from '../queues/queue-names.js'

/** Queue probed to decide readiness (a known, boot-created queue). */
const READINESS_QUEUE = AUDIT_QUEUE
/** Upper bound (ms) for the readiness probe before it is considered failed. */
const READINESS_TIMEOUT_MS = 1000

/** Readiness payload: the process is up and how many jobs are active right now. */
interface ReadinessStatus {
  /** Fixed up signal. */
  status: 'up'
  /** Aggregate `active` count across every cached queue. */
  activeJobs: number
}

/**
 * Reject if `promise` does not settle within `ms`. The timer is always cleared,
 * so a fast success never leaves a dangling handle.
 *
 * @param promise - Work to bound.
 * @param ms - Timeout budget in milliseconds.
 * @returns The resolved value when it settles in time.
 * @throws {Error} When the budget elapses first.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('readiness probe timed out'))
        }, ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Probe-safe health surface. */
@Controller('health')
export class HealthController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * GET /health/live - liveness. Returns 200 as long as the process serves HTTP.
   *
   * @returns A static up signal.
   */
  @Get('live')
  live(): { status: 'up' } {
    return { status: 'up' }
  }

  /**
   * GET /health/ready - readiness. A cached `get` on a known queue reaches Redis
   * on a cache miss (proving reachability while exercising the TTL cache), then
   * `getAll` aggregates the active count across every cached queue.
   *
   * @returns An up signal plus the aggregate active job count when Redis is
   *   reachable.
   * @throws {ServiceUnavailableException} 503 with a non-secret reason when the
   *   probe fails or times out.
   */
  @Get('ready')
  async ready(): Promise<ReadinessStatus> {
    try {
      await withTimeout(this.metrics.get(READINESS_QUEUE), READINESS_TIMEOUT_MS)
      const all = await this.metrics.getAll()
      const activeJobs = all.reduce((sum, snapshot) => sum + snapshot.counts.active, 0)
      return { status: 'up', activeJobs }
    } catch {
      throw new ServiceUnavailableException({ status: 'down', reason: 'redis_unreachable' })
    }
  }
}
