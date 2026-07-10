/**
 * @fileoverview Flows (`/flows`) - launches the fulfillment flow under one of
 * the four failure-propagation variants and renders its live tree, polling
 * at 1s while any node is non-final.
 * @layer app/flows/page
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { FlowTree } from '@/components/flow-tree'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useFlowTree, useLaunchFlow } from '@/hooks/use-flows'
import type { FulfillmentVariant } from '@/lib/api-types'

/** The four failure-propagation variants, with a short label for the selector. */
const VARIANTS: readonly { value: FulfillmentVariant; label: string }[] = [
  { value: 'default', label: 'Default (happy path)' },
  { value: 'stuck', label: 'Stuck (BullMQ default pitfall)' },
  { value: 'failParent', label: 'Fail parent on child failure' },
  { value: 'ignoreDependency', label: 'Ignore dependency failure' },
]

/** Radio pill group for the failure-propagation variant. */
function VariantPicker({
  value,
  onChange,
}: {
  value: FulfillmentVariant
  onChange: (v: FulfillmentVariant) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Flow variant"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {VARIANTS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => {
            onChange(option.value)
          }}
          className={
            value === option.value
              ? 'rounded-xl border border-brand-500/50 bg-brand-500/10 p-3 text-left text-sm'
              : 'rounded-xl border border-(--glass-border) bg-(--glass-bg) p-3 text-left text-sm hover:bg-(--glass-bg-hover)'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The launch form: order id, variant picker, the stuck-variant callout, and the submit button. */
function LaunchFlowCard({ onLaunched }: { onLaunched: (rootId: string | undefined) => void }) {
  const [orderId, setOrderId] = useState('order-1')
  const [variant, setVariant] = useState<FulfillmentVariant>('default')
  const launch = useLaunchFlow()

  function submit(): void {
    launch.mutate(
      { orderId, variant },
      {
        onSuccess: (result) => {
          onLaunched(result.rootId)
          toast.success(`Flow launched (root ${result.rootId ?? 'unknown'})`)
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader accent>
        <CardTitle className="text-base">Launch a fulfillment flow</CardTitle>
        <CardDescription>
          POST /flows/fulfillment - three children fan out under one root.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="flow-order">Order id</Label>
          <Input
            id="flow-order"
            value={orderId}
            onChange={(event) => {
              setOrderId(event.target.value)
            }}
          />
        </div>
        <VariantPicker value={variant} onChange={setVariant} />
        {variant === 'stuck' ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            By design: without failParentOnFailure, a failed child leaves the root in
            waiting-children forever. This is the documented BullMQ default, not a bug.
          </p>
        ) : null}
        <Button onClick={submit} disabled={launch.isPending}>
          Launch flow
        </Button>
      </CardContent>
    </Card>
  )
}

/** The live tree for the last-launched flow, polling while non-final. */
function LiveTreeCard({ rootId }: { rootId: string | undefined }) {
  const { data: tree, isPending } = useFlowTree(rootId)

  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Live tree</CardTitle>
      </CardHeader>
      <CardContent>
        {rootId === undefined ? (
          <p className="text-sm text-muted-foreground">Launch a flow to see its tree here.</p>
        ) : isPending || tree === undefined ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <FlowTree node={tree} />
        )}
      </CardContent>
    </Card>
  )
}

/** Flows page: variant launcher plus the live tree for the last-launched flow. */
export default function FlowsPage() {
  const [rootId, setRootId] = useState<string>()

  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Flows</h1>
      <LaunchFlowCard onLaunched={setRootId} />
      <LiveTreeCard rootId={rootId} />
    </AppShell>
  )
}
