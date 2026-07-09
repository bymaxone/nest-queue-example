/**
 * @fileoverview Read surface for the event feed. `GET /events/stream` is a
 * Server-Sent Events endpoint that replays the recent entries then streams live
 * ones; `GET /events/recent` returns the retained buffer as JSON. Entries are
 * already redacted by the listeners, so no sensitive payload is streamed.
 * @layer app/events
 */
import { Controller, Get, Sse } from '@nestjs/common'
import type { MessageEvent } from '@nestjs/common'
import { concat, from, map } from 'rxjs'
import type { Observable } from 'rxjs'
import { EventFeed } from './event-feed.service.js'
import type { FeedEntry } from './event-feed.types.js'

/** Number of recent entries replayed to a new SSE subscriber before going live. */
const SSE_REPLAY_COUNT = 20

/**
 * Wrap a feed entry as an SSE message. The entry is a plain, already-redacted
 * object, which satisfies the `MessageEvent.data` contract.
 *
 * @param entry - The feed entry to wrap.
 * @returns The SSE message carrying the entry.
 */
function toMessageEvent(entry: FeedEntry): MessageEvent {
  return { data: entry }
}

/** Exposes the event feed over SSE and a plain snapshot endpoint. */
@Controller('events')
export class EventsController {
  constructor(private readonly feed: EventFeed) {}

  /**
   * Stream feed entries: replay the most recent, then push live ones. NestJS
   * unsubscribes automatically when the client disconnects.
   *
   * @returns An observable of SSE messages.
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    const replay = from(this.feed.recent(SSE_REPLAY_COUNT))
    return concat(replay, this.feed.live()).pipe(map(toMessageEvent))
  }

  /**
   * Return the retained feed buffer as JSON.
   *
   * @returns A snapshot of every retained entry.
   */
  @Get('recent')
  recent(): readonly FeedEntry[] {
    return this.feed.snapshot()
  }
}
