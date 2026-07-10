/**
 * @fileoverview Schedulers (`/schedulers`) - lists the Job Schedulers on the
 * two managed queues, an upsert form (pattern-or-every toggle), and delete
 * with confirm. A validation failure (`queue.invalid_repeat_options`) renders
 * the API envelope inline rather than only as a toast.
 * @layer app/schedulers/page
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSchedulerActions, useSchedulers } from '@/hooks/use-schedulers'
import { SCHEDULER_QUEUES, type JobSchedulerJson, type SchedulerQueue } from '@/lib/api-types'

/** Renders a scheduler's next-run time, or a dash while none is scheduled. */
function nextRunLabel(next: number | undefined): string {
  return next === undefined ? '-' : new Date(next).toLocaleString()
}

/** One scheduler row: schedule summary, timezone, next run, and a delete button. */
function SchedulerRow({
  scheduler,
  onDelete,
}: {
  scheduler: JobSchedulerJson
  onDelete: (id: string) => void
}) {
  const id = scheduler.id ?? scheduler.key
  return (
    <TableRow>
      <TableCell className="font-mono">{id}</TableCell>
      <TableCell className="font-mono">
        {scheduler.pattern ?? `every ${String(scheduler.every)}ms`}
      </TableCell>
      <TableCell className="font-mono">{scheduler.tz ?? '-'}</TableCell>
      <TableCell className="font-mono">{nextRunLabel(scheduler.next)}</TableCell>
      <TableCell>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onDelete(id)
          }}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  )
}

/** The registered-schedulers table for the currently selected queue. */
function SchedulersTable({ queue }: { queue: SchedulerQueue }) {
  const { data, isPending } = useSchedulers(queue)
  const { remove } = useSchedulerActions()

  function removeScheduler(id: string): void {
    remove.mutate(
      { queue, id },
      {
        onSuccess: () => toast.success(`Scheduler ${id} removed`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader accent>
        <CardTitle className="text-base">Registered schedulers</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending || (data?.schedulers.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {isPending ? 'Loading...' : 'No schedulers on this queue.'}
                </TableCell>
              </TableRow>
            ) : (
              data?.schedulers.map((scheduler) => (
                <SchedulerRow
                  key={scheduler.id ?? scheduler.key}
                  scheduler={scheduler}
                  onDelete={removeScheduler}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** The pattern (cron) or every (ms) input, toggled by the checkbox above it. */
function ScheduleFields({
  isEveryMode,
  onToggleEvery,
  pattern,
  onPattern,
  every,
  onEvery,
}: {
  isEveryMode: boolean
  onToggleEvery: (value: boolean) => void
  pattern: string
  onPattern: (value: string) => void
  every: number
  onEvery: (value: number) => void
}) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEveryMode}
          onChange={(event) => {
            onToggleEvery(event.target.checked)
          }}
        />
        Use a fixed interval instead of a cron pattern
      </label>
      {isEveryMode ? (
        <div>
          <Label htmlFor="scheduler-every">Every (ms)</Label>
          <Input
            id="scheduler-every"
            type="number"
            value={every}
            onChange={(event) => {
              onEvery(Number(event.target.value))
            }}
          />
        </div>
      ) : (
        <div>
          <Label htmlFor="scheduler-pattern">Cron pattern</Label>
          <Input
            id="scheduler-pattern"
            value={pattern}
            onChange={(event) => {
              onPattern(event.target.value)
            }}
          />
        </div>
      )}
    </>
  )
}

/** Inline validation-error surface, rendered only once a save has failed. */
function InlineFormError({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs text-red-400">
      {message}
    </p>
  )
}

/** State and submit logic for the upsert form, kept separate from its markup. */
function useUpsertScheduler(queue: SchedulerQueue) {
  const [id, setId] = useState('nightly-cleanup')
  const [isEveryMode, setIsEveryMode] = useState(false)
  const [pattern, setPattern] = useState('0 3 * * *')
  const [every, setEvery] = useState(60_000)
  const [formError, setFormError] = useState<string>()
  const { upsert } = useSchedulerActions()

  function submit(): void {
    setFormError(undefined)
    upsert.mutate(
      { queue, id, repeat: isEveryMode ? { every } : { pattern } },
      {
        onSuccess: () => toast.success(`Scheduler ${id} saved`),
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : 'Could not save scheduler'
          setFormError(message)
          toast.error(message)
        },
      },
    )
  }

  return {
    id,
    setId,
    isEveryMode,
    setIsEveryMode,
    pattern,
    setPattern,
    every,
    setEvery,
    formError,
    submit,
    upsert,
  }
}

/** The pattern-or-every upsert form, with the inline validation-error surface. */
function UpsertSchedulerForm({ queue }: { queue: SchedulerQueue }) {
  const form = useUpsertScheduler(queue)

  return (
    <Card className="mt-4">
      <CardHeader accent>
        <CardTitle className="text-base">Upsert a scheduler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="scheduler-id">Scheduler id</Label>
          <Input
            id="scheduler-id"
            value={form.id}
            onChange={(event) => {
              form.setId(event.target.value)
            }}
          />
        </div>
        <ScheduleFields
          isEveryMode={form.isEveryMode}
          onToggleEvery={form.setIsEveryMode}
          pattern={form.pattern}
          onPattern={form.setPattern}
          every={form.every}
          onEvery={form.setEvery}
        />
        <InlineFormError message={form.formError} />
        <Button onClick={form.submit} disabled={form.upsert.isPending}>
          Save scheduler
        </Button>
      </CardContent>
    </Card>
  )
}

/** Schedulers page: per-queue list, upsert form, and delete-with-confirm. */
export default function SchedulersPage() {
  const [queue, setQueue] = useState<SchedulerQueue>('maintenance')

  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Schedulers</h1>

      <Tabs
        value={queue}
        onValueChange={(value) => {
          setQueue(value as SchedulerQueue)
        }}
      >
        <TabsList>
          {SCHEDULER_QUEUES.map((option) => (
            <TabsTrigger key={option} value={option}>
              {option}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SchedulersTable queue={queue} />
      <UpsertSchedulerForm queue={queue} />
    </AppShell>
  )
}
