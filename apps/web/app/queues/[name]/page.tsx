/**
 * @fileoverview Queue detail (`/queues/[name]`) - a status-tabbed, paginated
 * jobs table with pause/resume/clean actions. Clean is destructive (it
 * removes jobs), so it sits behind a confirm dialog; every action toasts its
 * outcome, including the removed job ids from a clean.
 * @layer app/queues/[name]/page
 */

'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { JOB_STATUS, type JobStatus } from '@bymax-one/nest-queue/shared'
import { AppShell } from '@/components/layout/AppShell'
import { JobStatusBadge } from '@/components/job-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQueueActions, useQueueJobs } from '@/hooks/use-queue-jobs'
import { ALL_JOB_STATUSES } from '@/lib/queue-status'
import { CLEAN_STATUSES, type CleanStatus, type JobView } from '@/lib/api-types'

/** Jobs listed per page. */
const PAGE_SIZE = 20

/** Pause/resume/clean mutations, as returned by {@link useQueueActions}. */
type QueueActions = ReturnType<typeof useQueueActions>

/** Toasts a mutation's outcome: a success message, or the error message on failure. */
function toastOutcome(onSuccess: string): {
  onSuccess: () => void
  onError: (error: Error) => void
} {
  return {
    onSuccess: () => toast.success(onSuccess),
    onError: (error) => toast.error(error.message),
  }
}

/** Destructive clean action behind a confirm dialog with a status picker. */
function CleanDialog({ name, clean }: { name: string; clean: QueueActions['clean'] }) {
  const [cleanStatus, setCleanStatus] = useState<CleanStatus>('completed')
  const [open, setOpen] = useState(false)

  function runClean(): void {
    clean.mutate(cleanStatus, {
      onSuccess: (result) => {
        setOpen(false)
        toast.success(`Removed ${String(result.removed.length)} job(s)`, {
          description: result.removed.join(', ') || 'none matched',
        })
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Clean
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clean {name}</DialogTitle>
          <DialogDescription>
            Permanently removes jobs in the selected status. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={cleanStatus}
          onValueChange={(value) => {
            setCleanStatus(value as CleanStatus)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLEAN_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="destructive" onClick={runClean} disabled={clean.isPending}>
            Confirm clean
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pause/resume buttons plus the destructive clean action. */
function QueueActionsBar({ name, pause, resume, clean }: { name: string } & QueueActions) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          pause.mutate(undefined, toastOutcome(`Paused ${name}`))
        }}
      >
        Pause
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          resume.mutate(undefined, toastOutcome(`Resumed ${name}`))
        }}
      >
        Resume
      </Button>
      <CleanDialog name={name} clean={clean} />
    </div>
  )
}

/**
 * Renders the jobs table body for a page, or an empty-state row. Each job id
 * links into the job detail page (`/jobs/[queue]/[id]`).
 *
 * @param queue - The queue the jobs belong to.
 * @param jobs - The current page of jobs.
 * @returns The table rows.
 */
function JobRows({ queue, jobs }: { queue: string; jobs: JobView[] }) {
  if (jobs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-center text-muted-foreground">
          No jobs in this status.
        </TableCell>
      </TableRow>
    )
  }
  return (
    <>
      {jobs.map((job) => (
        <TableRow key={job.id}>
          <TableCell className="font-mono">
            {job.id === undefined ? (
              '-'
            ) : (
              <Link
                href={`/jobs/${queue}/${job.id}`}
                className="text-brand-400 underline-offset-4 hover:underline"
              >
                {job.id}
              </Link>
            )}
          </TableCell>
          <TableCell>{job.name}</TableCell>
          <TableCell className="font-mono">{new Date(job.timestamp).toLocaleString()}</TableCell>
          <TableCell className="font-mono">{job.attemptsMade}</TableCell>
        </TableRow>
      ))}
    </>
  )
}

/** Status tabs strip; a separate component so the parent stays under the size budget. */
function StatusTabs({
  value,
  onChange,
}: {
  value: JobStatus
  onChange: (status: JobStatus) => void
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        onChange(next as JobStatus)
      }}
    >
      <TabsList>
        {ALL_JOB_STATUSES.map((tabStatus) => (
          <TabsTrigger key={tabStatus} value={tabStatus}>
            <JobStatusBadge status={tabStatus} />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** Prev/next controls for the jobs table. */
function PaginationBar({
  page,
  hasNext,
  onPrevious,
  onNext,
}: {
  page: number
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onPrevious} disabled={page === 0}>
        Previous
      </Button>
      <span className="font-mono text-xs text-muted-foreground">page {page + 1}</span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
        Next
      </Button>
    </div>
  )
}

/** Status tabs, the paginated jobs table, and the pagination controls, self-contained. */
function JobsPanel({ name }: { name: string }) {
  const [status, setStatus] = useState<JobStatus>(JOB_STATUS.WAITING)
  const [page, setPage] = useState(0)

  const start = page * PAGE_SIZE
  const end = start + PAGE_SIZE - 1
  const { data: jobs, isPending, error } = useQueueJobs(name, status, start, end)

  return (
    <>
      <StatusTabs
        value={status}
        onChange={(next) => {
          setStatus(next)
          setPage(0)
        }}
      />

      <Card className="mt-4">
        <CardContent className="p-0">
          {error !== null ? (
            <p className="p-6 text-sm text-red-400">Failed to load jobs: {error.message}</p>
          ) : isPending ? (
            <Skeleton className="m-6 h-40 w-auto" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <JobRows queue={name} jobs={jobs} />
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar
        page={page}
        hasNext={(jobs ?? []).length >= PAGE_SIZE}
        onPrevious={() => {
          setPage((p) => Math.max(0, p - 1))
        }}
        onNext={() => {
          setPage((p) => p + 1)
        }}
      />
    </>
  )
}

/** Queue detail page: status tabs, a paginated jobs table, and queue actions. */
export default function QueueDetailPage() {
  const { name } = useParams<{ name: string }>()
  const actions = useQueueActions(name)

  return (
    <AppShell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold">{name}</h1>
        <QueueActionsBar name={name} {...actions} />
      </div>
      <JobsPanel name={name} />
    </AppShell>
  )
}
