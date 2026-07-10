/**
 * Unit tests for HealthController.
 *
 * Layer: unit.
 * Goal: liveness is static; readiness composes MetricsService (a cached probe for
 * reachability plus an active-count aggregate) and returns 503 without leaking a
 * connection string when the probe fails or times out.
 * Mocks: MetricsService.get / getAll; fake timers for the timeout path.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { ServiceUnavailableException } from '@nestjs/common'
import type { MetricsService, QueueMetrics } from '@bymax-one/nest-queue'
import { HealthController } from './health.controller.js'

/** Build a snapshot with a given active count for the aggregate assertions. */
function snapshot(queue: string, active: number): QueueMetrics {
  return {
    queue,
    counts: { waiting: 0, active, completed: 0, failed: 0, delayed: 0, paused: 0 },
    collectedAt: '2026-07-09T00:00:00.000Z',
  }
}

/**
 * Build the controller with spyable get/getAll.
 *
 * @returns The controller and the two spies.
 */
function setup() {
  const get = jest.fn<MetricsService['get']>()
  const getAll = jest.fn<MetricsService['getAll']>()
  const metrics: Partial<MetricsService> = { get, getAll }
  const controller = new HealthController(metrics as MetricsService)
  return { controller, get, getAll }
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

  it('reports ready with the aggregate active count when the probe succeeds', async () => {
    /*
     * Scenario: Redis answers the cached probe and two queues are cached.
     * Rule it protects: readiness probes the known `audit` queue for reachability,
     * then aggregates `active` across every cached queue via getAll (lib §9.5).
     */
    const { controller, get, getAll } = setup()
    get.mockResolvedValue(snapshot('audit', 1))
    getAll.mockResolvedValue([snapshot('audit', 1), snapshot('email', 2)])

    await expect(controller.ready()).resolves.toEqual({ status: 'up', activeJobs: 3 })
    expect(get).toHaveBeenCalledWith('audit')
  })

  it('returns 503 with a non-secret reason when the probe rejects', async () => {
    /*
     * Scenario: Redis is unreachable and the cached probe throws.
     * Rule it protects: readiness surfaces a 503 carrying a fixed reason, never the
     * error message (which could echo the connection string).
     */
    const { controller, get } = setup()
    get.mockRejectedValue(new Error('connect ECONNREFUSED redis://user:secret@host:6379'))

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('returns 503 when the cached probe exceeds the timeout budget', async () => {
    /*
     * Scenario: the cached probe hangs past the readiness budget.
     * Rule it protects: the timeout fires and readiness fails closed rather than
     * hanging the health check forever.
     */
    const { controller, get } = setup()
    get.mockReturnValue(new Promise(() => undefined))
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

  it('returns 503 when the aggregate call hangs past the timeout budget', async () => {
    /*
     * Scenario: the reachability probe resolves but getAll stalls mid-probe.
     * Rule it protects: the whole probe (get + getAll) shares one timeout budget, so
     * a stall on the second Redis round-trip still fails closed within the budget.
     */
    const { controller, get, getAll } = setup()
    get.mockResolvedValue(snapshot('audit', 0))
    getAll.mockReturnValue(new Promise(() => undefined))
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
