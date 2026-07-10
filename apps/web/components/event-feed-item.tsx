/**
 * @fileoverview `EventFeedItem` - one row of the live events feed: a
 * worker/global source badge, an event-kind colored dot (reusing the job
 * status palette where the event name matches a status), the queue/job
 * identifiers, and a timestamp.
 * @layer components/event-feed-item
 */

import type { FeedEntry } from '@/lib/api-types'
import { paletteVisual } from '@/lib/queue-status'
import { cn } from '@/lib/utils'

export interface EventFeedItemProps {
  /** The feed entry to render. */
  entry: FeedEntry
}

/**
 * One live-feed row: source badge, event-kind badge, queue/job id, timestamp.
 *
 * @param props - Item props.
 * @param props.entry - The feed entry to render.
 * @returns The rendered feed row.
 */
export function EventFeedItem({ entry }: EventFeedItemProps) {
  const visual = paletteVisual(entry.event)
  const Icon = visual.icon
  return (
    <li className="flex items-center gap-3 border-b border-white/6 px-4 py-2 last:border-0">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs',
          visual.className,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {entry.event}
      </span>
      <span
        className={cn(
          'rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
          entry.source === 'worker'
            ? 'border-brand-500/30 text-brand-500'
            : 'border-white/15 text-white/50',
        )}
      >
        {entry.source}
      </span>
      <span className="font-mono text-xs text-white/70">{entry.queue}</span>
      {entry.jobId !== undefined ? (
        <span className="font-mono text-xs text-white/40">#{entry.jobId}</span>
      ) : null}
      <span className="ml-auto font-mono text-[11px] text-white/35">
        {new Date(entry.at).toLocaleTimeString()}
      </span>
    </li>
  )
}
