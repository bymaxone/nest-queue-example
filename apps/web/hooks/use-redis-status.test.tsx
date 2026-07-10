/**
 * @fileoverview Unit tests for the Redis readiness polling hook.
 * @layer hooks/use-redis-status.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRedisStatus, REDIS_STATUS_QUERY_KEY } from './use-redis-status'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
}))

import { apiGet } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('REDIS_STATUS_QUERY_KEY', () => {
  it('is ["health", "ready"]', () => {
    expect(REDIS_STATUS_QUERY_KEY).toEqual(['health', 'ready'])
  })
})

describe('useRedisStatus', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => {
    mockGet.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in the checking state before the first probe resolves', () => {
    // Scenario: the very first render, before any network round-trip settles.
    mockGet.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useRedisStatus(), { wrapper: wrapper() })
    expect(result.current.status).toBe('checking')
  })

  it('reports up with a non-negative latency on a successful probe', async () => {
    // Scenario: /health/ready resolves; the chip must show up + a measured latency.
    mockGet.mockResolvedValueOnce({ status: 'up', activeJobs: 0 })
    const { result } = renderHook(() => useRedisStatus(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.status).toBe('up')
    })
    expect(result.current.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports down when the probe rejects', async () => {
    // Scenario: /health/ready returns 503; the chip must read down, never crash.
    mockGet.mockRejectedValueOnce(new Error('service unavailable'))
    const { result } = renderHook(() => useRedisStatus(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.status).toBe('down')
    })
    expect(result.current.latencyMs).toBeUndefined()
  })
})
