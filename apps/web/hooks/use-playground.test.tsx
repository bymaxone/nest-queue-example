/**
 * @fileoverview Unit tests for the playground's demo-domain mutations.
 * @layer hooks/use-playground.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePlayground } from './use-playground'

vi.mock('@/lib/api-client', () => ({ apiPost: vi.fn() }))
import { apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('usePlayground', () => {
  const mockPost = vi.mocked(apiPost)

  beforeEach(() => mockPost.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('places an order against POST /orders', async () => {
    // Scenario: the order lab must forward to/total/vip untouched.
    mockPost.mockResolvedValueOnce({ orderId: 'o1', jobId: 'j1' })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.placeOrder.mutate({ to: 'a@b.c', total: 10, vip: true })
    await waitFor(() => {
      expect(result.current.placeOrder.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/orders', { to: 'a@b.c', total: 10, vip: true })
  })

  it('onboards a user against POST /onboarding/:userId', async () => {
    // Scenario: the idempotent onboarding lab targets the user-scoped route.
    mockPost.mockResolvedValueOnce({ created: true, jobId: 'welcome-u1' })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.onboard.mutate('u1')
    await waitFor(() => {
      expect(result.current.onboard.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/onboarding/u1')
  })

  it('sends a receipt campaign against POST /campaigns/receipts', async () => {
    // Scenario: the bulk lab forwards the requested count, including an
    // oversized one that will trigger the bulk_enqueue_failed guard.
    mockPost.mockResolvedValueOnce({ enqueued: 5, jobIds: ['1', '2', '3', '4', '5'] })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.sendCampaign.mutate(5)
    await waitFor(() => {
      expect(result.current.sendCampaign.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/campaigns/receipts', { count: 5 })
  })

  it('reindexes a term against POST /search/reindex with the chosen mode', async () => {
    // Scenario: the dedup lab forwards term + mode for the reindex endpoint.
    mockPost.mockResolvedValueOnce({ jobId: 'r1', deduplicated: false })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.reindex.mutate({ term: 'shoes', mode: 'throttle' })
    await waitFor(() => {
      expect(result.current.reindex.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/search/reindex', { term: 'shoes', mode: 'throttle' })
  })
})
