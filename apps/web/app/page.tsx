/**
 * @fileoverview Overview page (`/`) - aggregate totals across every managed
 * queue, followed by one `QueueCard` per queue. Polls `GET /admin/metrics`
 * every 3s (aligned with the API's metrics cache TTL, spec §13.1).
 * @layer app/page
 */

'use client'

import type { JobStatus, QueueMetrics } from '@bymax-one/nest-queue/shared'
import { AppShell } from '@/components/layout/AppShell'
import { QueueCard } from '@/components/queue-card'
import { JobStatusBadge } from '@/components/job-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMetrics } from '@/hooks/use-metrics'
import { ALL_JOB_STATUSES } from '@/lib/queue-status'

/**
 * Sum one status across every queue's metrics snapshot.
 *
 * @param snapshots - Every queue's metrics snapshot.
 * @param status - The status to aggregate.
 * @returns The total count for that status across all queues.
 */
function aggregate(snapshots: readonly QueueMetrics[], status: JobStatus): number {
  return snapshots.reduce((sum, snapshot) => sum + snapshot.counts[status], 0)
}

/** Overview page: aggregate totals plus a card per managed queue. */
export default function OverviewPage() {
  const { data, isPending, isError } = useMetrics()

  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <Card className="mb-8">
        <CardHeader accent>
          <CardTitle className="text-base">Aggregate totals</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <dl className="flex flex-wrap gap-4">
              {ALL_JOB_STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <JobStatusBadge status={status} />
                  <dd className="font-mono text-sm">{aggregate(data ?? [], status)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {isError ? (
        <p className="text-sm text-destructive">Could not load queue metrics from the API.</p>
      ) : null}

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((metrics) => (
            <QueueCard key={metrics.queue} metrics={metrics} />
          ))}
        </div>
      )}
    </AppShell>
  )
}
