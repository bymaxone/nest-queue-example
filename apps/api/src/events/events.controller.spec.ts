/**
 * Unit tests for EventsController.
 *
 * Layer: unit.
 * Goal: the SSE stream replays recent entries then streams live ones as
 * MessageEvents, and the recent endpoint returns the buffer snapshot.
 * Mocks: a real EventFeed drives both surfaces (no framework container).
 */
import type { MessageEvent } from '@nestjs/common'
import { EventFeed } from './event-feed.service.js'
import { EventsController } from './events.controller.js'
import type { FeedEntry } from './event-feed.types.js'

/**
 * Build a minimal feed entry fixture with a distinguishing job id.
 *
 * @param jobId - The job id to tag the entry with.
 * @returns The feed entry.
 */
function entry(jobId: string): FeedEntry {
  return {
    source: 'global',
    queue: 'webhooks',
    event: 'completed',
    jobId,
    at: '2026-07-09T00:00:00.000Z',
  }
}

describe('EventsController (unit)', () => {
  it('replays recent entries then streams live ones as SSE messages', () => {
    /*
     * Scenario: a subscriber attaches after one entry exists, then another arrives.
     * Rule it protects: the stream replays the buffered entry then pushes the live
     * one, each wrapped as a MessageEvent whose data is the entry.
     */
    const feed = new EventFeed()
    feed.push(entry('a'))
    const controller = new EventsController(feed)
    const received: MessageEvent[] = []

    const subscription = controller.stream().subscribe((message) => received.push(message))
    feed.push(entry('b'))
    subscription.unsubscribe()

    expect(received.map((message) => (message.data as FeedEntry).jobId)).toEqual(['a', 'b'])
    expect(received[0]).toEqual({ data: entry('a') })
  })

  it('returns the feed snapshot for the recent endpoint', () => {
    /*
     * Scenario: reading the recent buffer over HTTP.
     * Rule it protects: `recent` mirrors the feed snapshot.
     */
    const feed = new EventFeed()
    feed.push(entry('a'))
    const controller = new EventsController(feed)

    expect(controller.recent()).toEqual([entry('a')])
  })
})
