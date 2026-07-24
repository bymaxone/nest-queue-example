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
import { useFlowTrace, useFlowTree, useLaunchFlow, useLaunchFlowBulk } from '@/hooks/use-flows'
import type { FulfillmentVariant } from '@/lib/api-types'

/** Order-id prefix the payments processor treats as a deterministic failure. */
const ORDER_FAILURE_PREFIX = 'fail-'

/** How many orders the bulk-launch demo fans out in one `addBulk` roundtrip. */
const BULK_DEMO_ORDER_COUNT = 3

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

/**
 * Callout shown while a failure variant is selected but the order id would
 * never trigger the injected failure (the payments node only throws for
 * `fail-`-prefixed order ids).
 */
function FailurePrefixHint({ orderId, variant }: { orderId: string; variant: FulfillmentVariant }) {
  const needsPrefix =
    (variant === 'failParent' || variant === 'ignoreDependency' || variant === 'stuck') &&
    !orderId.startsWith(ORDER_FAILURE_PREFIX)
  if (!needsPrefix) return null
  return (
    <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-300">
      The charge-payment node only fails for order ids starting with{' '}
      <code className="font-mono">{ORDER_FAILURE_PREFIX}</code>. Use e.g.{' '}
      <code className="font-mono">fail-order-1</code> to see this variant propagate.
    </p>
  )
}

/** Documents the deliberate BullMQ pitfall the `stuck` variant demonstrates. */
function StuckVariantCallout({ variant }: { variant: FulfillmentVariant }) {
  if (variant !== 'stuck') return null
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
      By design: without failParentOnFailure, a failed child leaves the root in waiting-children
      forever. This is the documented BullMQ default, not a bug.
    </p>
  )
}

/** Launches several derived orders (`<id>-1..n`) in one `addBulk` roundtrip. */
function BulkLaunchButton({
  orderId,
  variant,
  onLaunched,
}: {
  orderId: string
  variant: FulfillmentVariant
  onLaunched: (rootId: string | undefined) => void
}) {
  const launchBulk = useLaunchFlowBulk()

  function submitBulk(): void {
    const orderIds = Array.from(
      { length: BULK_DEMO_ORDER_COUNT },
      (_, index) => `${orderId}-${String(index + 1)}`,
    )
    launchBulk.mutate(
      { orderIds, variant },
      {
        onSuccess: (result) => {
          onLaunched(result.roots[0]?.rootId)
          toast.success(`Launched ${String(result.roots.length)} flows via addBulk`, {
            description: 'The live tree follows the first root.',
          })
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Button variant="outline" onClick={submitBulk} disabled={launchBulk.isPending}>
      Launch {BULK_DEMO_ORDER_COUNT} via addBulk
    </Button>
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
        <StuckVariantCallout variant={variant} />
        <FailurePrefixHint orderId={orderId} variant={variant} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={launch.isPending}>
            Launch flow
          </Button>
          <BulkLaunchButton orderId={orderId} variant={variant} onLaunched={onLaunched} />
        </div>
      </CardContent>
    </Card>
  )
}

/** On-demand view of the api's in-memory execution trace, oldest first. */
function ExecutionTraceCard() {
  const { data, refetch, isFetching } = useFlowTrace()

  return (
    <Card className="mt-6">
      <CardHeader accent className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Execution trace</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void refetch()
          }}
          disabled={isFetching}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {data === undefined || data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No executions recorded yet - launch a flow, then refresh to see children run before
            their parents.
          </p>
        ) : (
          <ol className="space-y-1 font-mono text-xs text-white/70">
            {data.entries.map((entry, index) => (
              <li key={`${entry.node}-${String(entry.at)}-${String(index)}`}>
                {new Date(entry.at).toLocaleTimeString()} - {entry.node}
              </li>
            ))}
          </ol>
        )}
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
      <ExecutionTraceCard />
    </AppShell>
  )
}
