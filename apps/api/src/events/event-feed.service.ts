/**
 * @fileoverview In-memory event feed bridging queue events to Server-Sent Events.
 * A bounded ring buffer holds the most recent entries for replay, and an RxJS
 * subject pushes each new entry to live subscribers. This is a demonstration
 * surface, not an event store: history is capped and lost on restart.
 * @layer app/events
 */
import { Injectable } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import type { FeedEntry } from './event-feed.types.js'

/** Maximum number of entries retained for replay; older entries are evicted first. */
const FEED_BUFFER_CAPACITY = 200

/** Default number of recent entries an SSE subscriber replays before going live. */
const DEFAULT_REPLAY_COUNT = 20

/** Bounded event feed with a live push channel for SSE subscribers. */
@Injectable()
export class EventFeed {
  private readonly buffer: FeedEntry[] = []
  private readonly channel = new Subject<FeedEntry>()

  /**
   * Append an entry to the buffer and push it to live subscribers, evicting the
   * oldest entry once the buffer is full so memory stays bounded.
   *
   * @param entry - The feed entry to record and broadcast.
   */
  push(entry: FeedEntry): void {
    this.buffer.push(entry)
    if (this.buffer.length > FEED_BUFFER_CAPACITY) {
      this.buffer.shift()
    }
    this.channel.next(entry)
  }

  /**
   * Return the most recent entries, newest last.
   *
   * @param limit - Maximum number of entries to return. Default: 20.
   * @returns A snapshot of the last `limit` entries.
   */
  recent(limit: number = DEFAULT_REPLAY_COUNT): readonly FeedEntry[] {
    return this.buffer.slice(-limit)
  }

  /**
   * Return the full retained buffer, newest last.
   *
   * @returns A copy of every retained entry.
   */
  snapshot(): readonly FeedEntry[] {
    return [...this.buffer]
  }

  /**
   * Observable of entries pushed after subscription. Combine with {@link recent}
   * to replay history before going live.
   *
   * @returns A hot observable of newly pushed entries.
   */
  live(): Observable<FeedEntry> {
    return this.channel.asObservable()
  }
}
