/**
 * @fileoverview Unit tests for the aggregate metrics polling hook.
 * @layer hooks/use-metrics.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMetrics, useInvalidateMetrics, METRICS_QUERY_KEY } from './use-metrics'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('METRICS_QUERY_KEY', () => {
  it('is ["admin", "metrics"]', () => {
    expect(METRICS_QUERY_KEY).toEqual(['admin', 'metrics'])
  })
})

describe('useMetrics', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => {
    mockGet.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches /admin/metrics and returns the snapshot array', async () => {
    // Scenario: the Overview page renders one card per entry returned here.
    const snapshot = [
      {
        queue: 'email',
        counts: { waiting: 1, active: 0, completed: 5, failed: 0, delayed: 0, paused: 0 },
        collectedAt: '2026-07-09T00:00:00.000Z',
      },
    ]
    mockGet.mockResolvedValueOnce(snapshot)
    const { result } = renderHook(() => useMetrics(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/metrics')
    expect(result.current.data).toEqual(snapshot)
  })

  it('reflects an error state when the request rejects', async () => {
    // Scenario: the API is briefly unreachable; the page must be able to show
    // an error state instead of hanging on a spinner forever.
    mockGet.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useMetrics(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

describe('useInvalidateMetrics', () => {
  const mockPost = vi.mocked(apiPost)

  beforeEach(() => {
    mockPost.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears the whole cache with an empty body when no queue is given', async () => {
    // Scenario: the Health page's Invalidate button drops every cache entry.
    mockPost.mockResolvedValueOnce({ all: true, queue: null })
    const { result } = renderHook(() => useInvalidateMetrics(), { wrapper: wrapper() })
    result.current.mutate(undefined)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/admin/metrics/invalidate', {})
  })

  it('scopes the invalidation to one queue when a name is passed', async () => {
    // Scenario: a queue-scoped drop must forward the name in the body.
    mockPost.mockResolvedValueOnce({ all: false, queue: 'email' })
    const { result } = renderHook(() => useInvalidateMetrics(), { wrapper: wrapper() })
    result.current.mutate('email')
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/admin/metrics/invalidate', { queue: 'email' })
  })
})
