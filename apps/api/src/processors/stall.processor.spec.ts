/**
 * Unit tests for StallProcessor.
 *
 * Layer: unit.
 * Goal: the slow handler completes after its sleep, and the worker-local event
 * listeners bridge the active, stalled, and completed timeline onto the feed.
 * Mocks: EventFeed.push (spy); fake timers drive the sleep; Date#toISOString
 * pinned for a deterministic completion timestamp.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import type { EventFeed } from '../events/event-feed.service.js'
import type { FeedEntry } from '../events/event-feed.types.js'
import type { StallJobData, StallJobResult } from '../demos/demo-jobs.types.js'
import { StallProcessor } from './stall.processor.js'
import { readWorkerEventListeners } from '../testing/processor-metadata.js'

/**
 * Build the processor with a spyable feed.
 *
 * @returns The processor and the push spy.
 */
function setup() {
  const push = jest.fn<EventFeed['push']>()
  const feed: Pick<EventFeed, 'push'> = { push }
  const processor = new StallProcessor(feed as EventFeed)
  return { processor, push }
}

/**
 * Extract the single feed entry pushed by a listener.
 *
 * @param push - The push spy.
 * @returns The pushed entry.
 */
function pushedEntry(push: jest.Mock<EventFeed['push']>): FeedEntry {
  expect(push).toHaveBeenCalledTimes(1)
  const call = push.mock.calls[0]
  if (call === undefined) {
    throw new Error('expected a pushed entry')
  }
  return call[0]
}

describe('StallProcessor (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('completes the slow job after sleeping', async () => {
    /*
     * Scenario: the handler runs to completion (uninterrupted).
     * Rule it protects: the slow job resolves with the demo id and a completion
     * timestamp once its sleep elapses.
     */
    jest.useFakeTimers()
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')
    const { processor } = setup()
    const job = { data: { demoId: 'd1' } } as Job<StallJobData, StallJobResult>

    const pending = processor.stall(job)
    await jest.runAllTimersAsync()
    const result = await pending

    expect(result).toEqual({ demoId: 'd1', completedAt: '2026-07-09T00:00:00.000Z' })
  })

  it('wires each worker-event listener to its BullMQ event name', () => {
    /*
     * Scenario: the @OnWorkerEvent decorator arguments.
     * Rule it protects: each listener subscribes to the exact event name (active,
     * stalled, completed); a wrong or blank name would silently detach the listener
     * so the recovery timeline never reaches the feed.
     */
    expect(readWorkerEventListeners(StallProcessor)).toEqual([
      { eventName: 'active', methodKey: 'onActive' },
      { eventName: 'stalled', methodKey: 'onStalled' },
      { eventName: 'completed', methodKey: 'onCompleted' },
    ])
  })

  it('bridges an active event with the attempt count', () => {
    /*
     * Scenario: the job starts (or restarts) processing.
     * Rule it protects: the active listener records the job id and attempts so the
     * recovery timeline shows each attempt.
     */
    const { processor, push } = setup()
    const job = { id: 'j1', attemptsMade: 1 } as Job<StallJobData>

    processor.onActive(job)

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.queue).toBe('demos')
    expect(entry.event).toBe('active')
    expect(entry.jobId).toBe('j1')
    expect(entry.attemptsMade).toBe(1)
  })

  it('bridges a stalled event carrying only the job id', () => {
    /*
     * Scenario: the stalled-job check detects an orphaned job.
     * Rule it protects: the stalled listener records the job id (the only field the
     * event carries), making the recovery visible.
     */
    const { processor, push } = setup()

    processor.onStalled('j1')

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.event).toBe('stalled')
    expect(entry.jobId).toBe('j1')
  })

  it('bridges a completed event with the return value', () => {
    /*
     * Scenario: the recovering worker finishes the job.
     * Rule it protects: the completed listener records the return value so the demo
     * shows the job completing after recovery.
     */
    const { processor, push } = setup()
    const job = { id: 'j1', attemptsMade: 2 } as Job<StallJobData, StallJobResult>

    processor.onCompleted(job, { demoId: 'd1', completedAt: 'x' })

    const entry = pushedEntry(push)
    expect(entry.source).toBe('worker')
    expect(entry.event).toBe('completed')
    expect(entry.returnvalue).toEqual({ demoId: 'd1', completedAt: 'x' })
  })
})
