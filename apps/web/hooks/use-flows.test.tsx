/**
 * @fileoverview Unit tests for the flows data layer: launch mutation, tree
 * polling query, and the finality check.
 * @layer hooks/use-flows.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useLaunchFlow, useFlowTree, isTreeFinal, treePath } from './use-flows'
import type { FlowTreeNode } from '@/lib/api-types'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const leaf: FlowTreeNode = {
  id: 'c1',
  name: 'reserve-stock',
  queue: 'stock',
  status: 'completed',
  children: [],
}

describe('isTreeFinal', () => {
  it('is true when the node and every child are terminal', () => {
    // Scenario: a fully-settled tree must report final.
    expect(
      isTreeFinal({
        id: 'r',
        name: 'ship-order',
        queue: 'fulfillment',
        status: 'completed',
        children: [leaf],
      }),
    ).toBe(true)
  })

  it('is false when the root is still waiting on children', () => {
    // Scenario: the documented 'stuck' variant leaves the root in waiting-children forever.
    expect(
      isTreeFinal({
        id: 'r',
        name: 'ship-order',
        queue: 'fulfillment',
        status: 'waiting-children',
        children: [leaf],
      }),
    ).toBe(false)
  })

  it('is false when any child is still non-terminal', () => {
    // Scenario: the root may already be final-looking while a child still runs.
    const activeChild: FlowTreeNode = { ...leaf, status: 'active' }
    expect(
      isTreeFinal({
        id: 'r',
        name: 'ship-order',
        queue: 'fulfillment',
        status: 'completed',
        children: [activeChild],
      }),
    ).toBe(false)
  })
})

describe('treePath', () => {
  it('builds the tree-read path for a defined root id', () => {
    // Scenario: the common case used by useFlowTree once a flow is launched.
    expect(treePath('r1')).toBe('/flows/r1/tree')
  })

  it('throws rather than building a path from an undefined root id', () => {
    // Scenario: guards against the literal string "undefined" ever reaching fetch.
    expect(() => treePath(undefined)).toThrow('treePath called without a rootId')
  })
})

describe('useLaunchFlow', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('posts the order id and variant to /flows/fulfillment', async () => {
    // Scenario: launching must forward both fields to the launcher route.
    mockPost.mockResolvedValueOnce({ rootId: 'r1', orderId: 'o1', variant: 'default' })
    const { result } = renderHook(() => useLaunchFlow(), { wrapper: wrapper() })
    result.current.mutate({ orderId: 'o1', variant: 'default' })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/flows/fulfillment', {
      orderId: 'o1',
      variant: 'default',
    })
  })
})

describe('useFlowTree', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('stays disabled until a rootId is provided', () => {
    // Scenario: before a flow is launched, no tree request should fire at all.
    renderHook(() => useFlowTree(undefined), { wrapper: wrapper() })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches the tree once a rootId is provided', async () => {
    // Scenario: after launching, the tree query targets the returned root id.
    mockGet.mockResolvedValueOnce(leaf)
    const { result } = renderHook(() => useFlowTree('r1'), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/flows/r1/tree')
  })
})
