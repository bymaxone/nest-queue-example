/**
 * @fileoverview Data layer for the flows page: launching a fulfillment flow
 * under a chosen failure-propagation variant, and polling its live tree at
 * 1s while any node is still non-final.
 * @layer hooks/use-flows
 */
'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { FlowLaunched, FlowTreeNode, FulfillmentVariant } from '@/lib/api-types'

/** Poll interval (ms) for the flow tree while any node is still in-flight. */
const FLOW_TREE_POLL_INTERVAL_MS = 1_000

/** BullMQ job states treated as terminal for the flow tree's finality check. */
const TERMINAL_STATES = new Set(['completed', 'failed'])

/**
 * Whether every node in a flow tree has reached a terminal BullMQ state.
 *
 * @param node - The tree (or subtree) to inspect.
 * @returns `true` once the whole subtree is final.
 */
export function isTreeFinal(node: FlowTreeNode): boolean {
  return TERMINAL_STATES.has(node.status) && node.children.every(isTreeFinal)
}

/**
 * Launches a fulfillment flow for an order under the chosen variant.
 *
 * @returns The launch mutation.
 */
export function useLaunchFlow() {
  return useMutation({
    mutationFn: (input: { orderId: string; variant: FulfillmentVariant }) =>
      apiPost<FlowLaunched>('/flows/fulfillment', input),
  })
}

/**
 * Builds the tree-read path for a root id, guarding against an undefined id
 * reaching `fetch` as the literal string `"undefined"`. The query that calls
 * this is disabled whenever `rootId` is undefined, so the guard only ever
 * fires if that invariant is ever broken.
 *
 * @param rootId - The root job id, expected defined whenever this runs.
 * @returns The tree-read path.
 * @throws {Error} When called without a root id.
 */
export function treePath(rootId: string | undefined): string {
  if (rootId === undefined) throw new Error('treePath called without a rootId')
  return `/flows/${rootId}/tree`
}

/**
 * Polls the live tree for a launched flow while it looks non-final.
 *
 * @param rootId - The root job id returned when the flow was launched, or
 *   `undefined` before anything has been launched yet.
 * @returns The TanStack Query result carrying the tree, disabled until a
 *   `rootId` exists.
 */
export function useFlowTree(rootId: string | undefined) {
  return useQuery({
    queryKey: ['flows', rootId, 'tree'],
    queryFn: () => apiGet<FlowTreeNode>(treePath(rootId)),
    enabled: rootId !== undefined,
    refetchInterval: (query) => {
      const tree = query.state.data
      return tree === undefined || !isTreeFinal(tree) ? FLOW_TREE_POLL_INTERVAL_MS : false
    },
  })
}
