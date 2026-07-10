/**
 * @fileoverview Unit tests for the error-explorer data layer.
 * @layer hooks/use-errors.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useErrorCatalog, useTriggerError } from './use-errors'
import { ApiError } from '@/lib/api-client'

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client')
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn() }
})
import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useErrorCatalog', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches GET /errors/catalog', async () => {
    // Scenario: the explorer table must target the exact catalog route.
    mockGet.mockResolvedValueOnce([])
    const { result } = renderHook(() => useErrorCatalog(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/errors/catalog')
  })
})

describe('useTriggerError', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('posts to the trigger route for the given code', async () => {
    // Scenario: the trigger button must target /errors/trigger/:code exactly.
    mockPost.mockRejectedValueOnce(
      new ApiError('queue.job_not_found', 'Job not found', 404, { queue: 'email' }),
    )
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    result.current.mutate('queue.job_not_found')
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/errors/trigger/queue.job_not_found')
    expect(result.current.error).toBeInstanceOf(ApiError)
  })
})
