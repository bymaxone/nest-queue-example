/**
 * Unit tests for MetricsController.
 *
 * Layer: unit.
 * Goal: the controller delegates to the library's MetricsService, guards the
 * `:queue` param against the managed allow-list, and honours the TTL cache so two
 * rapid reads share `collectedAt` while invalidate forces a fresh Redis roundtrip.
 * Mocks: a spyable MetricsService for delegation; a real MetricsService over a
 * spied QueueService.getMetrics for the cache-behaviour proof.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { MetricsService, QueueException } from '@bymax-one/nest-queue'
import type { QueueMetrics, QueueService } from '@bymax-one/nest-queue'
import { MetricsController } from './metrics.controller.js'

/** Build a snapshot with a distinct `collectedAt` so cache hits are observable. */
function snapshot(queue: string, collectedAt: string): QueueMetrics {
  return {
    queue,
    counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
    collectedAt,
  }
}

describe('MetricsController (unit)', () => {
  it('returns the cached snapshot for every queue via getAll', async () => {
    /*
     * Scenario: overview aggregation.
     * Rule it protects: GET /admin/metrics delegates to MetricsService.getAll and
     * returns its result untouched.
     */
    const getAll = jest.fn<MetricsService['getAll']>().mockResolvedValue([snapshot('audit', 't0')])
    const metrics: Partial<MetricsService> = { getAll }
    const controller = new MetricsController(metrics as MetricsService)

    await expect(controller.all()).resolves.toEqual([snapshot('audit', 't0')])
  })

  it('returns the cached snapshot for a known queue', async () => {
    /*
     * Scenario: per-queue read for a managed queue.
     * Rule it protects: GET /admin/metrics/:queue validates the name then delegates
     * to MetricsService.get with the narrowed queue.
     */
    const get = jest.fn<MetricsService['get']>().mockResolvedValue(snapshot('email', 't0'))
    const metrics: Partial<MetricsService> = { get }
    const controller = new MetricsController(metrics as MetricsService)

    await expect(controller.one('email')).resolves.toEqual(snapshot('email', 't0'))
    expect(get).toHaveBeenCalledWith('email')
  })

  it('rejects an unknown queue with the stable not-found envelope', () => {
    /*
     * Scenario: per-queue read for an unregistered name.
     * Rule it protects: untrusted input is refused with queue_not_found (404) before
     * MetricsService is touched, so it can never lazily create an arbitrary queue.
     */
    const get = jest.fn<MetricsService['get']>()
    const metrics: Partial<MetricsService> = { get }
    const controller = new MetricsController(metrics as MetricsService)

    expect(() => controller.one('does-not-exist')).toThrow(QueueException)
    expect(get).not.toHaveBeenCalled()
  })

  it('invalidates a single queue when a name is provided', () => {
    /*
     * Scenario: targeted refresh.
     * Rule it protects: POST invalidate with `{ queue }` drops that entry and reports
     * the single-queue scope.
     */
    const invalidate = jest.fn<MetricsService['invalidate']>()
    const metrics: Partial<MetricsService> = { invalidate }
    const controller = new MetricsController(metrics as MetricsService)

    expect(controller.invalidate({ queue: 'email' })).toEqual({ all: false, queue: 'email' })
    expect(invalidate).toHaveBeenCalledWith('email')
  })

  it('clears the whole cache when no queue is provided', () => {
    /*
     * Scenario: full refresh.
     * Rule it protects: POST invalidate with an empty body clears everything and
     * reports the all-scope, passing `undefined` to MetricsService.invalidate.
     */
    const invalidate = jest.fn<MetricsService['invalidate']>()
    const metrics: Partial<MetricsService> = { invalidate }
    const controller = new MetricsController(metrics as MetricsService)

    expect(controller.invalidate({})).toEqual({ all: true, queue: null })
    expect(invalidate).toHaveBeenCalledWith(undefined)
  })

  it('rejects a malformed invalidate body', () => {
    /*
     * Scenario: invalid body shape.
     * Rule it protects: a non-string queue fails validation at the boundary with a
     * safe 400 rather than reaching MetricsService.
     */
    const invalidate = jest.fn<MetricsService['invalidate']>()
    const metrics: Partial<MetricsService> = { invalidate }
    const controller = new MetricsController(metrics as MetricsService)

    expect(() => controller.invalidate({ queue: 42 })).toThrow(BadRequestException)
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('serves two rapid reads from the cache and refetches after invalidate', async () => {
    /*
     * Scenario: TTL cache window then a forced refresh.
     * Rule it protects: within the TTL two reads share `collectedAt` (one Redis
     * roundtrip); invalidate drops the entry so the next read fetches a fresh one.
     * Uses a real MetricsService over a spied getMetrics to count roundtrips.
     */
    let tick = 0
    const getMetrics = jest
      .fn<QueueService['getMetrics']>()
      .mockImplementation((queue: string) => Promise.resolve(snapshot(queue, `t${String(tick++)}`)))
    const cachedQueues = new Map<string, unknown>([['audit', {}]])
    const queueService: Partial<QueueService> = {
      getMetrics,
      getCachedQueues: () => cachedQueues as ReturnType<QueueService['getCachedQueues']>,
    }
    const service = new MetricsService(queueService as QueueService, true, 3000)
    const controller = new MetricsController(service)

    const first = await controller.one('audit')
    const second = await controller.one('audit')
    expect(second.collectedAt).toBe(first.collectedAt)
    expect(getMetrics).toHaveBeenCalledTimes(1)

    controller.invalidate({ queue: 'audit' })
    const third = await controller.one('audit')
    expect(third.collectedAt).not.toBe(first.collectedAt)
    expect(getMetrics).toHaveBeenCalledTimes(2)
  })
})
