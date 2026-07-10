/**
 * @fileoverview Playground (`/playground`) - the enqueue laboratory: four
 * small forms over the demo domain's actual enqueue-facing routes (orders,
 * onboarding, campaigns, search reindex). See `hooks/use-playground.ts` for
 * why this is four focused labs rather than one generic form.
 * @layer app/playground/page
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { DedupModePicker } from '@/components/dedup-mode-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlayground } from '@/hooks/use-playground'
import type { DedupMode } from '@/lib/api-types'

/** Default oversized campaign count, comfortably above the library's 1000-job bulk cap. */
const OVERSIZED_CAMPAIGN_COUNT = 1100

/** Order-placement lab: to/total/vip mapped straight onto POST /orders. */
function OrderLab() {
  const { placeOrder } = usePlayground()
  const [to, setTo] = useState('customer@example.com')
  const [total, setTotal] = useState(42)
  const [vip, setVip] = useState(false)

  function submit(): void {
    placeOrder.mutate(
      { to, total, vip },
      {
        onSuccess: (result) =>
          toast.success(`Order ${result.orderId} placed`, {
            description: `receipt job ${result.jobId ?? 'unknown'}`,
          }),
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
        <div>
          <Label htmlFor="order-to">Email</Label>
          <Input
            id="order-to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
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
              setTotal(Number(event.target.value))
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vip}
            onChange={(event) => {
              setVip(event.target.checked)
            }}
          />
          VIP (higher priority receipt)
        </label>
        <Button onClick={submit} disabled={placeOrder.isPending}>
          Place order
        </Button>
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
      onError: (error) => toast.error(error.message),
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
        <div className="flex gap-2">
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
      </CardContent>
    </Card>
  )
}

/** Playground page: four small enqueue laboratories over the demo domain. */
export default function PlaygroundPage() {
  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Playground</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrderLab />
        <OnboardingLab />
        <CampaignLab />
        <ReindexLab />
      </div>
    </AppShell>
  )
}
