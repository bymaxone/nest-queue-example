/**
 * @fileoverview Liveness and readiness endpoints. Liveness is a static "process
 * is up" signal; readiness probes Redis through a cheap `getMetrics` call bounded
 * by a short timeout, returning 503 (never leaking the connection string) when
 * the backend is unreachable.
 * @layer app/admin
 */
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'

/** Queue probed to decide readiness. */
const READINESS_QUEUE = 'audit'
/** Upper bound (ms) for the readiness probe before it is considered failed. */
const READINESS_TIMEOUT_MS = 1000

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
  constructor(private readonly queueService: QueueService) {}

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
   * GET /health/ready - readiness. Confirms Redis answers a cheap metrics call
   * within the timeout budget.
   *
   * @returns An up signal when Redis is reachable.
   * @throws {ServiceUnavailableException} 503 with a non-secret reason when the
   *   probe fails or times out.
   */
  @Get('ready')
  async ready(): Promise<{ status: 'up' }> {
    try {
      await withTimeout(this.queueService.getMetrics(READINESS_QUEUE), READINESS_TIMEOUT_MS)
      return { status: 'up' }
    } catch {
      throw new ServiceUnavailableException({ status: 'down', reason: 'redis_unreachable' })
    }
  }
}
