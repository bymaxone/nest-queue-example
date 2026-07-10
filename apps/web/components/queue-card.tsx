/**
 * @fileoverview `QueueCard` - the Overview/Queues-index tile for one managed
 * queue: its six status counts, a paused badge, and a link into the per-queue
 * detail page. A queue is treated as administratively paused when its
 * `paused` count is non-zero (the API's `QueueMetrics` carries no separate
 * `isPaused` flag, so this is the closest honest signal available).
 * @layer components/queue-card
 */

import Link from 'next/link'
import type { QueueMetrics } from '@bymax-one/nest-queue/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobStatusBadge } from '@/components/job-status-badge'
import { ALL_JOB_STATUSES } from '@/lib/queue-status'

export interface QueueCardProps {
  /** The metrics snapshot for one managed queue. */
  metrics: QueueMetrics
}

/**
 * Sum every status count into a single total.
 *
 * @param counts - The per-status job counts.
 * @returns The total job count across all statuses.
 */
function total(counts: QueueMetrics['counts']): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

/**
 * Overview tile for one managed queue: status counts, paused badge, and a
 * link into `/queues/[name]`.
 *
 * @param props - Card props.
 * @param props.metrics - The metrics snapshot to render.
 * @returns The rendered queue card.
 */
export function QueueCard({ metrics }: QueueCardProps) {
  const isPaused = metrics.counts.paused > 0
  return (
    <Link href={`/queues/${metrics.queue}`} className="block">
      <Card className="h-full transition-colors hover:bg-(--glass-bg-hover)">
        <CardHeader accent className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-mono text-base">{metrics.queue}</CardTitle>
            <p className="text-xs text-muted-foreground">{total(metrics.counts)} jobs total</p>
          </div>
          {isPaused ? <Badge variant="secondary">paused</Badge> : null}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_JOB_STATUSES.map((status) => (
              <div key={status} className="flex items-center justify-between gap-2">
                <JobStatusBadge status={status} />
                <dd className="font-mono text-sm text-foreground">{metrics.counts[status]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}
