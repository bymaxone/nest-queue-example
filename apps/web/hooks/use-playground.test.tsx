/**
 * @fileoverview Unit tests for the playground's demo-domain mutations.
 * @layer hooks/use-playground.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { dedupKeyPath, usePlayground } from './use-playground'

vi.mock('@/lib/api-client', () => ({ apiPost: vi.fn(), apiGet: vi.fn(), apiDelete: vi.fn() }))
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'

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

  it('schedules a reminder against POST /orders/:id/remind', async () => {
    // Scenario: the delayed-reminder action targets the placed order's id.
    mockPost.mockResolvedValueOnce({ orderId: 'o1', jobId: 'remind-1' })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.remindOrder.mutate('o1')
    await waitFor(() => {
      expect(result.current.remindOrder.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/orders/o1/remind')
  })

  it('requests a progress report against POST /reports', async () => {
    // Scenario: the report lab enqueues the progress-reporting generate job.
    mockPost.mockResolvedValueOnce({ reportId: 'rep-1', jobId: 'j9' })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.generateReport.mutate()
    await waitFor(() => {
      expect(result.current.generateReport.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/reports')
  })

  it('enqueues the stall demo against POST /demos/stall', async () => {
    // Scenario: the stalled-recovery lab enqueues the deliberately stalling job.
    mockPost.mockResolvedValueOnce({ demoId: 'd1', jobId: 'j10' })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.stallDemo.mutate()
    await waitFor(() => {
      expect(result.current.stallDemo.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/demos/stall')
  })

  it('inspects and clears a dedup key via the admin dedup surface', async () => {
    // Scenario: both inspector actions target the URI-encoded reindex:<term>
    // key on the search queue, mirroring the api's dedupId shape.
    vi.mocked(apiGet).mockResolvedValueOnce({ jobId: 'j1' })
    vi.mocked(apiDelete).mockResolvedValueOnce({ removed: true })
    const { result } = renderHook(() => usePlayground(), { wrapper: wrapper() })
    result.current.viewDedupKey.mutate('shoes')
    result.current.clearDedupKey.mutate('shoes')
    await waitFor(() => {
      expect(result.current.viewDedupKey.isSuccess).toBe(true)
      expect(result.current.clearDedupKey.isSuccess).toBe(true)
    })
    expect(apiGet).toHaveBeenCalledWith('/admin/dedup/search/reindex%3Ashoes')
    expect(apiDelete).toHaveBeenCalledWith('/admin/dedup/search/reindex%3Ashoes')
  })

  it('URI-encodes the dedup key so the colon survives as one path segment', () => {
    // Scenario: dedup keys legally contain colons; the path must encode them.
    expect(dedupKeyPath('running shoes')).toBe('/admin/dedup/search/reindex%3Arunning%20shoes')
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
