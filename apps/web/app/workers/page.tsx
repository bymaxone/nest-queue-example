/**
 * @fileoverview Workers (`/workers`) - three sections: the static processor
 * inventory (a local constant mirroring the api's registered processors),
 * dynamic tenant workers (register/notify/remove), and the sandboxed invoice
 * render trigger with a live event-loop-lag readout.
 * @layer app/workers/page
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  useLagProbe,
  useRenderInvoice,
  useTenantActions,
  useTenantWorkers,
} from '@/hooks/use-workers'
import type { TenantTier, TenantWorkerView } from '@/lib/api-types'

/** How long to keep the lag readout polling after a render settles. */
const LAG_READOUT_WINDOW_MS = 3_000

/**
 * The api's fixed (non-dynamic) processors, mirroring the queue/job names
 * declared across `apps/api/src/**\/*.constants.ts`. Documentation only: this
 * inventory has no bearing on which processors actually run.
 */
const STATIC_PROCESSORS: readonly { queue: string; job: string; note: string }[] = [
  { queue: 'email', job: 'send-receipt / send-welcome', note: 'per-queue override: attempts=5' },
  { queue: 'search', job: 'reindex', note: 'the deduplication lab' },
  { queue: 'audit', job: 'entry', note: 'boot-time smoke journey' },
  { queue: 'webhooks', job: 'order-created', note: 'retry theater (WEBHOOK_FAILURES)' },
  { queue: 'reports', job: 'generate', note: 'progress + lock-duration tuning' },
  { queue: 'demos', job: 'stall', note: 'stalled-job recovery demo' },
  { queue: 'fulfillment', job: 'ship-order, render-invoice', note: 'flow root + invoice branch' },
  { queue: 'stock', job: 'reserve-stock', note: 'flow child' },
  { queue: 'payments', job: 'charge-payment', note: 'flow child (failure-injection node)' },
  { queue: 'invoices-data', job: 'fetch-lines, fetch-customer', note: 'flow grandchildren' },
  { queue: 'invoices', job: 'render', note: 'sandboxed (child process or worker thread)' },
  { queue: 'maintenance', job: 'cleanup', note: 'nightly boot scheduler' },
  { queue: 'monitoring', job: 'heartbeat, metrics-snapshot', note: 'boot schedulers' },
]

/** Static processor inventory table. */
function StaticProcessorsCard() {
  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Static processors</CardTitle>
        <CardDescription>Fixed queues and jobs registered at boot.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead>Job(s)</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATIC_PROCESSORS.map((processor) => (
              <TableRow key={processor.queue}>
                <TableCell className="font-mono">{processor.queue}</TableCell>
                <TableCell className="font-mono">{processor.job}</TableCell>
                <TableCell className="text-muted-foreground">{processor.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/**
 * Tenant id input, tier picker, and the register button. The mutation's
 * `onSuccess` invalidates the shared tenants query (see `useTenantActions`),
 * so `TenantsTable` refreshes automatically without any local wiring here.
 */
function TenantRegisterForm() {
  const { register } = useTenantActions()
  const [tenantId, setTenantId] = useState('acme')
  const [tier, setTier] = useState<TenantTier>('premium')

  function addTenant(): void {
    register.mutate(
      { tenantId, tier },
      {
        onSuccess: () => toast.success(`Registered ${tenantId} (${tier})`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="tenant-id">Tenant id</Label>
        <Input
          id="tenant-id"
          value={tenantId}
          onChange={(event) => {
            setTenantId(event.target.value)
          }}
        />
      </div>
      <div className="flex gap-1">
        {(['premium', 'free'] as const).map((option) => (
          <Button
            key={option}
            variant={tier === option ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTier(option)
            }}
          >
            {option}
          </Button>
        ))}
      </div>
      <Button onClick={addTenant} disabled={register.isPending}>
        Register
      </Button>
    </div>
  )
}

/** One tenant row: identity, queue, tier, and its notify/remove actions. */
function TenantRow({ worker, message }: { worker: TenantWorkerView; message: string }) {
  const { notify, remove } = useTenantActions()

  function notifyTenant(): void {
    notify.mutate(
      { tenantId: worker.tenantId, message },
      {
        onSuccess: () => toast.success(`Notified ${worker.tenantId}`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function removeTenant(): void {
    remove.mutate(worker.tenantId, {
      onSuccess: () => toast.success(`Removed ${worker.tenantId}`),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <TableRow>
      <TableCell className="font-mono">{worker.tenantId}</TableCell>
      <TableCell className="font-mono">{worker.queue}</TableCell>
      <TableCell className="font-mono">{worker.tier ?? 'unknown'}</TableCell>
      <TableCell className="flex gap-2">
        <Button size="sm" variant="outline" onClick={notifyTenant}>
          Notify
        </Button>
        <Button size="sm" variant="destructive" onClick={removeTenant}>
          Remove
        </Button>
      </TableCell>
    </TableRow>
  )
}

/** The registered-tenants table, with per-row notify and remove actions. */
function TenantsTable({ message }: { message: string }) {
  const { data, isPending } = useTenantWorkers()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Queue</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending || (data?.workers.length ?? 0) === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              {isPending ? 'Loading...' : 'No tenant workers registered.'}
            </TableCell>
          </TableRow>
        ) : (
          data?.workers.map((worker) => (
            <TenantRow key={worker.tenantId} worker={worker} message={message} />
          ))
        )}
      </TableBody>
    </Table>
  )
}

/** Dynamic tenant workers: register, notify, and remove live. */
function TenantWorkersCard() {
  const [message, setMessage] = useState('hello from the dashboard')

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Tenant workers</CardTitle>
        <CardDescription>
          Register, notify, and remove per-tenant notification workers live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TenantRegisterForm />
        <div>
          <Label htmlFor="tenant-message">Notification message</Label>
          <Input
            id="tenant-message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value)
            }}
          />
        </div>
        <TenantsTable message={message} />
      </CardContent>
    </Card>
  )
}

/** Sandboxed invoice render trigger, with a live event-loop-lag readout. */
function InvoiceLagCard() {
  const render = useRenderInvoice()
  const [invoiceId, setInvoiceId] = useState('invoice-1')
  const [isRendering, setIsRendering] = useState(false)
  const { data: lag } = useLagProbe(isRendering)

  function trigger(): void {
    setIsRendering(true)
    render.mutate(
      { invoiceId, lines: ['Line item A', 'Line item B', 'Line item C'] },
      {
        onSuccess: (result) => toast.success(`Render enqueued (${result.jobId ?? 'unknown'})`),
        onError: (error) => toast.error(error.message),
        onSettled: () =>
          setTimeout(() => {
            setIsRendering(false)
          }, LAG_READOUT_WINDOW_MS),
      },
    )
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Sandboxed invoice render</CardTitle>
        <CardDescription>
          POST /workers/invoices/render - watch the event loop stay responsive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="invoice-id">Invoice id</Label>
          <Input
            id="invoice-id"
            value={invoiceId}
            onChange={(event) => {
              setInvoiceId(event.target.value)
            }}
          />
        </div>
        <Button onClick={trigger} disabled={render.isPending}>
          Render invoice
        </Button>
        <p className="font-mono text-xs text-muted-foreground">
          event-loop lag: mean {lag?.meanMs.toFixed(2) ?? '-'}ms, max {lag?.maxMs.toFixed(2) ?? '-'}
          ms
        </p>
      </CardContent>
    </Card>
  )
}

/** Workers page: static inventory, dynamic tenant workers, sandboxed invoice trigger. */
export default function WorkersPage() {
  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Workers</h1>
      <div className="space-y-4">
        <StaticProcessorsCard />
        <TenantWorkersCard />
        <InvoiceLagCard />
      </div>
    </AppShell>
  )
}
