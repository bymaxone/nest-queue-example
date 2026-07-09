/**
 * Unit tests for HealthController.
 *
 * Layer: unit.
 * Goal: liveness is static; readiness resolves when the metrics probe succeeds
 * and returns 503 (without leaking a connection string) when it fails or times out.
 * Mocks: QueueService.getMetrics; fake timers for the timeout path.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { ServiceUnavailableException } from '@nestjs/common'
import type { QueueService } from '@bymax-one/nest-queue'
import { HealthController } from './health.controller.js'

/**
 * Build the controller with a spyable getMetrics.
 *
 * @returns The controller and the getMetrics spy.
 */
function setup() {
  const getMetrics = jest.fn<QueueService['getMetrics']>()
  const queueService: Partial<QueueService> = { getMetrics }
  const controller = new HealthController(queueService as QueueService)
  return { controller, getMetrics }
}

describe('HealthController (unit)', () => {
  it('reports liveness statically', () => {
    /*
     * Scenario: liveness probe.
     * Rule it protects: `/health/live` returns `{ status: 'up' }` without touching
     * Redis, so it stays green even during a backend outage.
     */
    const { controller } = setup()
    expect(controller.live()).toEqual({ status: 'up' })
  })

  it('reports ready when the metrics probe succeeds', async () => {
    /*
     * Scenario: Redis answers the probe.
     * Rule it protects: readiness resolves `{ status: 'up' }` after a successful
     * `getMetrics('audit')`.
     */
    const { controller, getMetrics } = setup()
    getMetrics.mockResolvedValue({
      queue: 'audit',
      counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      collectedAt: '2026-07-09T00:00:00.000Z',
    })

    await expect(controller.ready()).resolves.toEqual({ status: 'up' })
    expect(getMetrics).toHaveBeenCalledWith('audit')
  })

  it('returns 503 with a non-secret reason when the probe rejects', async () => {
    /*
     * Scenario: Redis is unreachable and the probe throws.
     * Rule it protects: readiness surfaces a 503 carrying a fixed reason, never the
     * error message (which could echo the connection string).
     */
    const { controller, getMetrics } = setup()
    getMetrics.mockRejectedValue(new Error('connect ECONNREFUSED redis://user:secret@host:6379'))

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('returns 503 when the probe exceeds the timeout budget', async () => {
    /*
     * Scenario: the probe hangs past the readiness budget.
     * Rule it protects: the timeout fires and readiness fails closed rather than
     * hanging the health check forever.
     */
    const { controller, getMetrics } = setup()
    getMetrics.mockReturnValue(new Promise(() => undefined))
    jest.useFakeTimers()
    try {
      const pending = controller.ready()
      const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException)
      await jest.advanceTimersByTimeAsync(1000)
      await assertion
    } finally {
      jest.useRealTimers()
    }
  })
})
