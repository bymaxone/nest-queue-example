/**
 * @fileoverview Live events feed (`/events`) - consumes `GET /events/stream`
 * over SSE via `useEventStream`, badging worker vs global entries and
 * coloring by event kind. Designs both the connecting and empty states so
 * the page never looks broken before the first entry arrives.
 * @layer app/events/page
 */

'use client'

import { Circle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { EventFeedItem } from '@/components/event-feed-item'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventStream } from '@/lib/use-event-stream'
import { cn } from '@/lib/utils'

/** Connection-status label and color, mirroring the accessible chip pattern. */
const STATUS_LABEL = { connecting: 'connecting...', open: 'live', error: 'disconnected' } as const
const STATUS_COLOR = {
  connecting: 'text-white/40',
  open: 'text-green-400',
  error: 'text-red-400',
} as const

/** Live events page: connection chip plus the capped, newest-first feed. */
export default function EventsPage() {
  const { entries, status } = useEventStream()

  return (
    <AppShell wide>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <div
          role="status"
          className={cn(
            'flex items-center gap-1.5 rounded-full border border-(--glass-border) bg-(--glass-bg) px-3 py-1 font-mono text-xs',
            STATUS_COLOR[status],
          )}
        >
          <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
          <span>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <Card>
        <CardHeader accent>
          <CardTitle className="text-base">Live feed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No events yet. Place an order or run the playground to see activity here.
            </p>
          ) : (
            <ol>
              {entries.map((entry, index) => (
                <EventFeedItem key={`${entry.at}-${entry.event}-${String(index)}`} entry={entry} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}
