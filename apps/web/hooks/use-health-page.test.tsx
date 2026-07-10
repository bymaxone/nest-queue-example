/**
 * @fileoverview Unit tests for the Health page's three data hooks.
 * @layer hooks/use-health-page.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useLiveness, useReadiness, useDiagnostics } from './use-health-page'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn() }))
import { apiGet } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useLiveness', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches GET /health/live', async () => {
    // Scenario: the liveness chip must target the exact liveness route.
    mockGet.mockResolvedValueOnce({ status: 'up' })
    const { result } = renderHook(() => useLiveness(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/health/live')
  })
})

describe('useReadiness', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches GET /health/ready and returns the active job count', async () => {
    // Scenario: the readiness chip must surface the aggregate active count.
    mockGet.mockResolvedValueOnce({ status: 'up', activeJobs: 3 })
    const { result } = renderHook(() => useReadiness(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/health/ready')
    expect(result.current.data?.activeJobs).toBe(3)
  })
})

describe('useDiagnostics', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches GET /admin/diagnostics', async () => {
    // Scenario: the diagnostics card must target the exact admin route.
    mockGet.mockResolvedValueOnce({
      mode: 'mode-b-owned',
      prefix: 'nqex',
      flowsEnabled: true,
      metricsEnabled: true,
      connection: {
        mode: 'mode-b-owned',
        style: 'url',
        queueRoleMaxRetries: 20,
        workerRoleMaxRetries: null,
      },
    })
    const { result } = renderHook(() => useDiagnostics(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/diagnostics')
  })
})
