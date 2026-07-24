/**
 * @fileoverview Playground (`/playground`) - the enqueue laboratory: small
 * forms over the demo domain's actual enqueue-facing routes (orders and
 * delayed reminders, onboarding, campaigns, search reindex with a dedup-key
 * inspector, progress reports, stalled-job recovery). See
 * `hooks/use-playground.ts` for why this is focused labs rather than one
 * generic form.
 * @layer app/playground/page
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { DedupModePicker } from '@/components/dedup-mode-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlayground } from '@/hooks/use-playground'
import { ApiError } from '@/lib/api-client'
import type { DedupMode } from '@/lib/api-types'

/** Default oversized campaign count, comfortably above the library's 1000-job bulk cap. */
const OVERSIZED_CAMPAIGN_COUNT = 1100

/** The order lab's editable fields: recipient email, total, and the VIP flag. */
function OrderFields({
  to,
  total,
  vip,
  onTo,
  onTotal,
  onVip,
}: {
  to: string
  total: number
  vip: boolean
  onTo: (value: string) => void
  onTotal: (value: number) => void
  onVip: (value: boolean) => void
}) {
  return (
    <>
      <div>
        <Label htmlFor="order-to">Email</Label>
        <Input
          id="order-to"
          value={to}
          onChange={(event) => {
            onTo(event.target.value)
          }}
        />
      </div>
      <div>
        <Label htmlFor="order-total">Total</Label>
        <Input
          id="order-total"
          type="number"
          value={total}
          onChange={(event) => {
            onTotal(Number(event.target.value))
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={vip}
          onChange={(event) => {
            onVip(event.target.checked)
          }}
        />
        VIP (higher priority receipt)
      </label>
    </>
  )
}

/** Delayed-reminder action for the last placed order (POST /orders/:id/remind). */
function OrderReminderButton({ lastOrderId }: { lastOrderId: string | undefined }) {
  const { remindOrder } = usePlayground()

  function remind(): void {
    if (lastOrderId === undefined) return
    remindOrder.mutate(lastOrderId, {
      onSuccess: (result) =>
        toast.success(`Reminder scheduled (delayed job ${result.jobId ?? 'unknown'})`, {
          description: 'Watch it move from delayed to completed on the email queue.',
        }),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Button
      variant="outline"
      onClick={remind}
      disabled={lastOrderId === undefined || remindOrder.isPending}
    >
      Send reminder (delayed)
    </Button>
  )
}

/** Order-placement lab: to/total/vip mapped straight onto POST /orders. */
function OrderLab() {
  const { placeOrder } = usePlayground()
  const [to, setTo] = useState('customer@example.com')
  const [total, setTotal] = useState(42)
  const [vip, setVip] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<string>()

  function submit(): void {
    placeOrder.mutate(
      { to, total, vip },
      {
        onSuccess: (result) => {
          setLastOrderId(result.orderId)
          toast.success(`Order ${result.orderId} placed`, {
            description: `receipt job ${result.jobId ?? 'unknown'}`,
          })
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Place an order</CardTitle>
        <CardDescription>
          POST /orders - fans out a receipt email and a fulfillment flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <OrderFields
          to={to}
          total={total}
          vip={vip}
          onTo={setTo}
          onTotal={setTotal}
          onVip={setVip}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={placeOrder.isPending}>
            Place order
          </Button>
          <OrderReminderButton lastOrderId={lastOrderId} />
        </div>
      </CardContent>
    </Card>
  )
}

/** Idempotent-onboarding lab: repeat clicks with the same user id are a no-op. */
function OnboardingLab() {
  const { onboard } = usePlayground()
  const [userId, setUserId] = useState('user-1')

  function submit(): void {
    onboard.mutate(userId, {
      onSuccess: (result) =>
        toast.success(
          result.created ? `Welcome job created (${result.jobId})` : 'Already onboarded',
          {
            description: result.jobId,
          },
        ),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Onboard a user</CardTitle>
        <CardDescription>POST /onboarding/:userId - idempotent by a stable job id.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="onboard-user">User id</Label>
          <Input
            id="onboard-user"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value)
            }}
          />
        </div>
        <Button onClick={submit} disabled={onboard.isPending}>
          Onboard
        </Button>
      </CardContent>
    </Card>
  )
}

/** Bulk-campaign lab: the same count field can reproduce the bulk-limit demo. */
function CampaignLab() {
  const { sendCampaign } = usePlayground()
  const [count, setCount] = useState(5)

  function submit(): void {
    sendCampaign.mutate(count, {
      onSuccess: (result) => toast.success(`Enqueued ${String(result.enqueued)} receipt jobs`),
      onError: (error) =>
        toast.error(error.message, {
          description:
            error instanceof ApiError && error.details != null
              ? JSON.stringify(error.details)
              : undefined,
        }),
    })
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Bulk receipt campaign</CardTitle>
        <CardDescription>
          POST /campaigns/receipts - try {OVERSIZED_CAMPAIGN_COUNT} to see the bulk-limit guard
          fire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="campaign-count">Count</Label>
          <Input
            id="campaign-count"
            type="number"
            value={count}
            onChange={(event) => {
              setCount(Number(event.target.value))
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={sendCampaign.isPending}>
            Send campaign
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCount(OVERSIZED_CAMPAIGN_COUNT)
            }}
          >
            Fill oversized demo count
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Inspect/clear buttons over the admin dedup surface for one reindex term. */
function DedupKeyInspector({ term }: { term: string }) {
  const { viewDedupKey, clearDedupKey } = usePlayground()

  function inspect(): void {
    viewDedupKey.mutate(term, {
      onSuccess: (result) =>
        toast.info(
          result.jobId === null
            ? `No dedup key registered for "${term}"`
            : `Dedup key for "${term}" points at job ${result.jobId}`,
        ),
      onError: (error) => toast.error(error.message),
    })
  }

  function clear(): void {
    clearDedupKey.mutate(term, {
      onSuccess: (result) =>
        toast.success(result.removed ? `Dedup key for "${term}" cleared` : 'No key to clear'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={inspect} disabled={viewDedupKey.isPending}>
        Inspect dedup key
      </Button>
      <Button variant="outline" onClick={clear} disabled={clearDedupKey.isPending}>
        Clear dedup key
      </Button>
    </div>
  )
}

/** Deduplication lab: the same term repeated under each mode compares job counts. */
function ReindexLab() {
  const { reindex } = usePlayground()
  const [term, setTerm] = useState('shoes')
  const [mode, setMode] = useState<DedupMode>('simple')

  function submit(): void {
    reindex.mutate(
      { term, mode },
      {
        onSuccess: (result) =>
          toast.success(
            result.deduplicated ? 'Deduplicated into an existing job' : 'New job enqueued',
            {
              description: result.jobId,
            },
          ),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Search reindex (dedup lab)</CardTitle>
        <CardDescription>
          POST /search/reindex - fire the same term repeatedly under each mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="reindex-term">Term</Label>
          <Input
            id="reindex-term"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value)
            }}
          />
        </div>
        <DedupModePicker value={mode} onChange={setMode} />
        <Button onClick={submit} disabled={reindex.isPending}>
          Reindex
        </Button>
        <DedupKeyInspector term={term} />
      </CardContent>
    </Card>
  )
}

/** Progress-report lab: enqueues a job that reports progress while it runs. */
function ReportLab() {
  const { generateReport } = usePlayground()
  const [lastJobId, setLastJobId] = useState<string>()

  function submit(): void {
    generateReport.mutate(undefined, {
      onSuccess: (result) => {
        setLastJobId(result.jobId)
        toast.success(`Report ${result.reportId} requested`, {
          description: `job ${result.jobId ?? 'unknown'}`,
        })
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Report with progress</CardTitle>
        <CardDescription>
          POST /reports - the generate job reports progress while it runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={submit} disabled={generateReport.isPending}>
          Generate report
        </Button>
        {lastJobId !== undefined ? (
          <p className="text-sm text-muted-foreground">
            Watch its progress on{' '}
            <Link
              href={`/jobs/reports/${encodeURIComponent(lastJobId)}`}
              className="text-brand-400 underline-offset-4 hover:underline"
            >
              the job page
            </Link>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Stalled-recovery lab: enqueues the deliberately stalling demo job. */
function StallLab() {
  const { stallDemo } = usePlayground()
  const [lastJobId, setLastJobId] = useState<string>()

  function submit(): void {
    stallDemo.mutate(undefined, {
      onSuccess: (result) => {
        setLastJobId(result.jobId)
        toast.success(`Stall demo ${result.demoId} enqueued`, {
          description: `job ${result.jobId ?? 'unknown'} - it stalls once, then recovers`,
        })
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Stalled-job recovery</CardTitle>
        <CardDescription>
          POST /demos/stall - the job stalls on purpose, then a worker reclaims it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={submit} disabled={stallDemo.isPending}>
          Enqueue stall demo
        </Button>
        {lastJobId !== undefined ? (
          <p className="text-sm text-muted-foreground">
            Follow the recovery on{' '}
            <Link
              href={`/jobs/demos/${encodeURIComponent(lastJobId)}`}
              className="text-brand-400 underline-offset-4 hover:underline"
            >
              the job page
            </Link>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Playground page: six small enqueue laboratories over the demo domain. */
export default function PlaygroundPage() {
  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Playground</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrderLab />
        <OnboardingLab />
        <CampaignLab />
        <ReindexLab />
        <ReportLab />
        <StallLab />
      </div>
    </AppShell>
  )
}
