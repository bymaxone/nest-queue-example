/**
 * @fileoverview Queues index (`/queues`) - the browsable entry point into
 * every managed queue's detail page. Shares the same live metrics snapshot
 * as the Overview page, presented as a plain list rather than a dashboard.
 * @layer app/queues/page
 */

'use client'

import { AppShell } from '@/components/layout/AppShell'
import { QueueCard } from '@/components/queue-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMetrics } from '@/hooks/use-metrics'

/** Queues index page: one card per managed queue, linking into its detail route. */
export default function QueuesIndexPage() {
  const { data, isPending, isError } = useMetrics()

  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Queues</h1>

      {isError ? (
        <p className="text-sm text-destructive">Could not load queues from the API.</p>
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
