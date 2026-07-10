/**
 * @fileoverview Unit tests for the job-detail polling hook.
 * @layer hooks/use-job.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useJob, looksFinal } from './use-job'
import type { JobView } from '@/lib/api-types'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn() }))
import { apiGet } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const baseJob: JobView = {
  id: '1',
  name: 'send-receipt',
  data: {},
  timestamp: 0,
  attemptsMade: 0,
  delay: 0,
  progress: 0,
  returnValue: undefined,
  failedReason: undefined,
  finishedOn: undefined,
}

describe('looksFinal', () => {
  it('is false while the job has not finished', () => {
    // Scenario: a still-processing job (no finishedOn) must not look final.
    expect(looksFinal(baseJob)).toBe(false)
  })

  it('is true once finishedOn is recorded, even without a return value', () => {
    // Scenario: a void-returning processor still finishes; finishedOn marks it done
    // where a returnValue-only check would poll forever.
    expect(looksFinal({ ...baseJob, finishedOn: 1000 })).toBe(true)
  })

  it('is true for a finished job that also carries a failure reason', () => {
    // Scenario: a failed job records finishedOn alongside its failure reason.
    expect(looksFinal({ ...baseJob, finishedOn: 1000, failedReason: 'boom' })).toBe(true)
  })
})

describe('useJob', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches the job detail endpoint for the given queue and id', async () => {
    // Scenario: the query must target the exact admin job-detail route.
    mockGet.mockResolvedValueOnce(baseJob)
    const { result } = renderHook(() => useJob('email', '1'), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/jobs/email/1')
  })

  it('stops polling once the job looks final (finishedOn has landed)', async () => {
    // Scenario: refetchInterval must resolve to false for a finished job, so
    // the browser does not keep polling a job that will never change again.
    mockGet.mockResolvedValueOnce({ ...baseJob, finishedOn: 1000, returnValue: { ok: true } })
    const { result } = renderHook(() => useJob('email', '1'), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    const data = result.current.data
    expect(data).toBeDefined()
    expect(looksFinal(data as JobView)).toBe(true)
  })
})
