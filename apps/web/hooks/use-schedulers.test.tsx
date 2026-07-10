/**
 * @fileoverview Unit tests for the schedulers data layer.
 * @layer hooks/use-schedulers.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSchedulers, useSchedulerActions, schedulersQueryKey } from './use-schedulers'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn() }))
import { apiDelete, apiGet, apiPut } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('schedulersQueryKey', () => {
  it('scopes the key to the managed queue', () => {
    // Scenario: maintenance and monitoring must never share a cache entry.
    expect(schedulersQueryKey('maintenance')).toEqual(['schedulers', 'maintenance'])
  })
})

describe('useSchedulers', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('lists schedulers for the given managed queue', async () => {
    // Scenario: the page must request exactly the selected queue's schedulers.
    mockGet.mockResolvedValueOnce({ schedulers: [] })
    const { result } = renderHook(() => useSchedulers('monitoring'), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/schedulers?queue=monitoring')
  })
})

describe('useSchedulerActions', () => {
  const mockPut = vi.mocked(apiPut)
  const mockDelete = vi.mocked(apiDelete)

  beforeEach(() => {
    mockPut.mockReset()
    mockDelete.mockReset()
  })
  afterEach(() => vi.clearAllMocks())

  it('upserts a scheduler with the given repeat options', async () => {
    // Scenario: the upsert form forwards queue/id/repeat to the PUT route.
    mockPut.mockResolvedValueOnce({ schedulerId: 'nightly', firstJobId: 'j1' })
    const { result } = renderHook(() => useSchedulerActions(), { wrapper: wrapper() })
    result.current.upsert.mutate({
      queue: 'maintenance',
      id: 'nightly',
      repeat: { pattern: '0 3 * * *' },
    })
    await waitFor(() => {
      expect(result.current.upsert.isSuccess).toBe(true)
    })
    expect(mockPut).toHaveBeenCalledWith('/schedulers/maintenance/nightly', {
      repeat: { pattern: '0 3 * * *' },
    })
  })

  it('removes a scheduler by queue and id', async () => {
    // Scenario: the delete action targets the exact scheduler.
    mockDelete.mockResolvedValueOnce({ removed: true })
    const { result } = renderHook(() => useSchedulerActions(), { wrapper: wrapper() })
    result.current.remove.mutate({ queue: 'monitoring', id: 'demo-heartbeat' })
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true)
    })
    expect(mockDelete).toHaveBeenCalledWith('/schedulers/monitoring/demo-heartbeat')
  })
})
