/**
 * @fileoverview Health (`/health`) - liveness/readiness chips, a metrics
 * cache freshness meter (age of the newest `collectedAt` vs the 3s TTL), and
 * the connection diagnostics card (mode, style, per-role retry policy).
 * @layer app/health/page
 */

'use client'

import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDiagnostics, useLiveness, useReadiness } from '@/hooks/use-health-page'
import { useMetrics } from '@/hooks/use-metrics'
import { METRICS_POLL_INTERVAL_MS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { DiagnosticsSnapshot, ReadinessStatus } from '@/lib/api-types'

/** A small chip reflecting a boolean up/down probe result, color + icon + text. */
function ProbeChip({ label, isUp }: { label: string; isUp: boolean | undefined }) {
  const state = isUp === undefined ? 'checking' : isUp ? 'up' : 'down'
  const color =
    state === 'checking' ? 'text-white/40' : state === 'up' ? 'text-green-400' : 'text-red-400'
  return (
    <div
      className={cn(
        'rounded-full border border-(--glass-border) bg-(--glass-bg) px-3 py-1 font-mono text-xs',
        color,
      )}
    >
      {label}: {state}
    </div>
  )
}

/** Freshness meter: how old the newest metrics snapshot is versus the 3s cache TTL. */
function FreshnessMeter() {
  const { data } = useMetrics()
  if (data === undefined || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No metrics collected yet.</p>
  }
  const newest = Math.max(...data.map((snapshot) => new Date(snapshot.collectedAt).getTime()))
  const ageMs = Date.now() - newest
  const isWithinTtl = ageMs <= METRICS_POLL_INTERVAL_MS
  return (
    <p className={cn('font-mono text-sm', isWithinTtl ? 'text-green-400' : 'text-amber-400')}>
      newest snapshot is {ageMs}ms old (TTL {METRICS_POLL_INTERVAL_MS}ms)
    </p>
  )
}

/** Freshness meter plus the aggregate active-job count from the readiness probe. */
function FreshnessCard({ ready }: { ready: ReadinessStatus | undefined }) {
  return (
    <Card className="mb-4">
      <CardHeader accent>
        <CardTitle className="text-base">Metrics cache freshness</CardTitle>
      </CardHeader>
      <CardContent>
        <FreshnessMeter />
        {ready !== undefined ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            aggregate active jobs: {ready.activeJobs}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Resolved connection mode, style, and the per-role retry policy. */
function DiagnosticsCard({ diagnostics }: { diagnostics: DiagnosticsSnapshot | undefined }) {
  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Connection diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 font-mono text-xs text-white/70">
        {diagnostics === undefined ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <p>mode: {diagnostics.mode}</p>
            <p>style: {diagnostics.connection.style}</p>
            <p>prefix: {diagnostics.prefix ?? '(none)'}</p>
            <p>flows enabled: {String(diagnostics.flowsEnabled)}</p>
            <p>metrics enabled: {String(diagnostics.metricsEnabled)}</p>
            <p>queue-role max retries: {diagnostics.connection.queueRoleMaxRetries ?? 'null'}</p>
            <p>worker-role max retries: {diagnostics.connection.workerRoleMaxRetries ?? 'null'}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Health page: liveness/readiness, metrics freshness, and connection diagnostics. */
export default function HealthPage() {
  const { data: live, isError: liveError } = useLiveness()
  const { data: ready, isError: readyError } = useReadiness()
  const { data: diagnostics } = useDiagnostics()

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-bold">Health</h1>
      <div className="mb-6 flex gap-2">
        <ProbeChip label="live" isUp={live !== undefined ? true : liveError ? false : undefined} />
        <ProbeChip
          label="ready"
          isUp={ready !== undefined ? true : readyError ? false : undefined}
        />
      </div>
      <FreshnessCard ready={ready} />
      <DiagnosticsCard diagnostics={diagnostics} />
    </AppShell>
  )
}
