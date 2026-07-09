/**
 * @fileoverview Events feature module. Owns the shared {@link EventFeed} and its
 * read surface. The feed is exported so the processors can push worker-local and
 * global queue events into the same buffer the controller streams.
 * @layer app/events
 */
import { Module } from '@nestjs/common'
import { EventFeed } from './event-feed.service.js'
import { EventsController } from './events.controller.js'

/** Module holding the shared event feed and its SSE read surface. */
@Module({
  controllers: [EventsController],
  providers: [EventFeed],
  exports: [EventFeed],
})
export class EventsModule {}
