/**
 * @fileoverview Unit tests for the queue-detail jobs query and action mutations.
 * @layer hooks/use-queue-jobs.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { JOB_STATUS } from '@bymax-one/nest-queue/shared'
import { useQueueJobs, useQueueActions, queueJobsQueryKey } from './use-queue-jobs'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('queueJobsQueryKey', () => {
  it('builds a key scoped to queue, status, and page window', () => {
    // Scenario: distinct pages/status tabs must never share a cache entry.
    expect(queueJobsQueryKey('email', JOB_STATUS.WAITING, 0, 50)).toEqual([
      'admin',
      'queues',
      'email',
      'jobs',
      'waiting',
      0,
      50,
    ])
  })
})

describe('useQueueJobs', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('requests the status-filtered, paginated jobs endpoint', async () => {
    // Scenario: the query string must carry status + the page window.
    mockGet.mockResolvedValueOnce([])
    const { result } = renderHook(() => useQueueJobs('email', JOB_STATUS.COMPLETED, 0, 50), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/queues/email/jobs?status=completed&start=0&end=50')
  })
})

describe('useQueueActions', () => {
  const mockPost = vi.mocked(apiPost)

  beforeEach(() => mockPost.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('pauses a queue by posting to its pause route', async () => {
    // Scenario: the pause action delegates to the exact admin route.
    mockPost.mockResolvedValueOnce({ paused: true })
    const { result } = renderHook(() => useQueueActions('email'), { wrapper: wrapper() })
    result.current.pause.mutate()
    await waitFor(() => {
      expect(result.current.pause.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/admin/queues/email/pause')
  })

  it('resumes a queue by posting to its resume route', async () => {
    // Scenario: the resume action delegates to the exact admin route.
    mockPost.mockResolvedValueOnce({ resumed: true })
    const { result } = renderHook(() => useQueueActions('email'), { wrapper: wrapper() })
    result.current.resume.mutate()
    await waitFor(() => {
      expect(result.current.resume.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/admin/queues/email/resume')
  })

  it('cleans a queue with the selected status, returning removed ids', async () => {
    // Scenario: the clean action forwards the chosen status and surfaces the
    // removed job ids so the caller can toast them.
    mockPost.mockResolvedValueOnce({ removed: ['1', '2'] })
    const { result } = renderHook(() => useQueueActions('email'), { wrapper: wrapper() })
    result.current.clean.mutate('completed')
    await waitFor(() => {
      expect(result.current.clean.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/admin/queues/email/clean', { status: 'completed' })
    expect(result.current.clean.data).toEqual({ removed: ['1', '2'] })
  })
})
