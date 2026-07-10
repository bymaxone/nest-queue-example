/**
 * @fileoverview Job detail (`/jobs/[queue]/[id]`) - payload, the one per-job
 * option the admin API actually exposes (`delay`), the module's default retry
 * policy for context, the attempts timeline, live progress, and the return
 * value. Polls while the job looks non-final (spec §13.2).
 *
 * Reconciliation note: the task spec describes a full "options (inherited vs
 * overridden)" diff, but `GET /admin/jobs/:queue/:id` (built in an earlier
 * phase) does not return the job's `opts` at all, only `delay`. This page
 * renders what the endpoint actually provides and surfaces the module
 * defaults as read-only context rather than fabricating a diff the API
 * cannot back.
 * @layer app/jobs/[queue]/[id]/page
 */

'use client'

import { useParams } from 'next/navigation'
import { JOB_STATUS } from '@bymax-one/nest-queue/shared'
import { AppShell } from '@/components/layout/AppShell'
import { AttemptsTimeline } from '@/components/attempts-timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useJob, looksFinal } from '@/hooks/use-job'
import type { JobView } from '@/lib/api-types'

/** The module-wide default retry policy (mirrors `apps/api/src/config/queue.config.ts`). */
const MODULE_DEFAULT_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 1500 },
} as const

/** A titled card wrapping pretty-printed JSON; `undefined` renders as a plain "pending" hint. */
function JsonCard({ title, value, isWide }: { title: string; value: unknown; isWide?: boolean }) {
  return (
    <Card className={isWide ? 'lg:col-span-2' : undefined}>
      <CardHeader accent>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs">
          {value === undefined ? 'pending' : JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

/**
 * Renders the progress field, which BullMQ allows to be a plain number
 * (treated as a percentage) or an arbitrary structured object.
 *
 * @param progress - The raw progress value from the job view.
 * @returns A progress bar for a number, or pretty-printed JSON otherwise.
 */
function ProgressCard({ progress }: { progress: unknown }) {
  if (typeof progress !== 'number') return <JsonCard title="Progress" value={progress} />
  const percent = Math.min(100, Math.max(0, progress))
  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${String(percent)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/** The one per-job option the admin API returns (`delay`), plus the module defaults for context. */
function ConfigurationCard({ delay }: { delay: number }) {
  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 font-mono text-xs text-white/70">
        <p>delay: {delay}ms</p>
        <p>module default attempts: {MODULE_DEFAULT_JOB_OPTIONS.attempts}</p>
        <p>
          module default backoff: {MODULE_DEFAULT_JOB_OPTIONS.backoff.type} @{' '}
          {MODULE_DEFAULT_JOB_OPTIONS.backoff.delay}ms
        </p>
      </CardContent>
    </Card>
  )
}

/** The job's title, breadcrumb, and non-final refresh indicator. */
function JobHeader({ queue, id, job }: { queue: string; id: string; job: JobView }) {
  return (
    <>
      <h1 className="mb-1 font-mono text-2xl font-bold">{job.name}</h1>
      <p className="mb-6 font-mono text-sm text-muted-foreground">
        {queue} / {id}
        {!looksFinal(job) ? ' (refreshing...)' : ''}
      </p>
    </>
  )
}

/** Job detail page: payload, options context, attempts timeline, progress, return value. */
export default function JobDetailPage() {
  const { queue, id } = useParams<{ queue: string; id: string }>()
  const { data: job, isPending } = useJob(queue, id)

  if (isPending || job === undefined) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full" />
      </AppShell>
    )
  }

  const status = job.failedReason !== undefined ? JOB_STATUS.FAILED : JOB_STATUS.ACTIVE

  return (
    <AppShell>
      <JobHeader queue={queue} id={id} job={job} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <JsonCard title="Payload" value={job.data} />
        <ConfigurationCard delay={job.delay} />
        <Card>
          <CardHeader accent>
            <CardTitle className="text-base">Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <AttemptsTimeline
              attemptsMade={job.attemptsMade}
              status={status}
              {...(job.failedReason !== undefined ? { failedReason: job.failedReason } : {})}
            />
          </CardContent>
        </Card>
        <ProgressCard progress={job.progress} />
        <JsonCard title="Return value" value={job.returnValue} isWide />
      </div>
    </AppShell>
  )
}
