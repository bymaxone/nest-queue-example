/**
 * Unit tests for EventFeed.
 *
 * Layer: unit.
 * Goal: entries are buffered (bounded to 200) for replay, `recent` returns the
 * newest slice, and `live` pushes entries to subscribers.
 * Mocks: none.
 */
import { EventFeed } from './event-feed.service.js'
import type { FeedEntry } from './event-feed.types.js'

/**
 * Build a minimal feed entry fixture with a distinguishing job id.
 *
 * @param jobId - The job id to tag the entry with.
 * @returns The feed entry.
 */
function entry(jobId: string): FeedEntry {
  return {
    source: 'worker',
    queue: 'email',
    event: 'completed',
    jobId,
    at: '2026-07-09T00:00:00.000Z',
  }
}

describe('EventFeed (unit)', () => {
  it('buffers pushed entries and returns them in a snapshot', () => {
    /*
     * Scenario: a single push.
     * Rule it protects: the entry is retained and surfaced by `snapshot`.
     */
    const feed = new EventFeed()

    feed.push(entry('a'))

    expect(feed.snapshot()).toEqual([entry('a')])
  })

  it('caps the buffer at 200 entries, evicting the oldest', () => {
    /*
     * Scenario: more than the buffer capacity of pushes.
     * Rule it protects: the feed is a demo surface, not a store, so memory stays
     * bounded and the earliest entry is evicted.
     */
    const feed = new EventFeed()
    for (let index = 0; index <= 200; index += 1) {
      feed.push(entry(String(index)))
    }

    const snapshot = feed.snapshot()

    expect(snapshot).toHaveLength(200)
    expect(snapshot[0]?.jobId).toBe('1')
    expect(snapshot.at(-1)?.jobId).toBe('200')
  })

  it('recent returns the last N entries and defaults to 20', () => {
    /*
     * Scenario: reading recent slices.
     * Rule it protects: `recent(n)` returns the newest n, and the default replay
     * window is 20 for the SSE stream.
     */
    const feed = new EventFeed()
    for (let index = 0; index < 25; index += 1) {
      feed.push(entry(String(index)))
    }

    expect(feed.recent(2).map((item) => item.jobId)).toEqual(['23', '24'])
    expect(feed.recent()).toHaveLength(20)
  })

  it('live emits entries pushed after subscription only', () => {
    /*
     * Scenario: a subscriber attaches, then entries are pushed before and after it
     * unsubscribes.
     * Rule it protects: `live` is a hot channel that delivers pushes to current
     * subscribers and stops on unsubscribe.
     */
    const feed = new EventFeed()
    const received: FeedEntry[] = []
    const subscription = feed.live().subscribe((item) => received.push(item))

    feed.push(entry('a'))
    subscription.unsubscribe()
    feed.push(entry('b'))

    expect(received.map((item) => item.jobId)).toEqual(['a'])
  })
})
