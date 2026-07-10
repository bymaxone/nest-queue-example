/**
 * @fileoverview Unit tests for the Workers page data layer.
 * @layer hooks/use-workers.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useTenantWorkers,
  useTenantDeliveries,
  useTenantActions,
  useRenderInvoice,
  useLagProbe,
} from './use-workers'

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }))
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useTenantWorkers', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('lists registered tenant workers', async () => {
    // Scenario: the workers table must target the exact tenants route.
    mockGet.mockResolvedValueOnce({ workers: [] })
    const { result } = renderHook(() => useTenantWorkers(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/workers/tenants')
  })
})

describe('useTenantDeliveries', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('reads the delivery trail', async () => {
    // Scenario: the deliveries panel must target the exact deliveries route.
    mockGet.mockResolvedValueOnce({ deliveries: [] })
    const { result } = renderHook(() => useTenantDeliveries(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/workers/tenants/deliveries')
  })
})

describe('useTenantActions', () => {
  const mockPost = vi.mocked(apiPost)
  const mockDelete = vi.mocked(apiDelete)

  beforeEach(() => {
    mockPost.mockReset()
    mockDelete.mockReset()
  })
  afterEach(() => vi.clearAllMocks())

  it('registers a tenant worker at the given tier', async () => {
    // Scenario: the create-premium-tenant journey posts tenantId + tier.
    mockPost.mockResolvedValueOnce({ tenantId: 't1', tier: 'premium', queue: 'notifications.t1' })
    const { result } = renderHook(() => useTenantActions(), { wrapper: wrapper() })
    result.current.register.mutate({ tenantId: 't1', tier: 'premium' })
    await waitFor(() => {
      expect(result.current.register.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/workers/tenants', { tenantId: 't1', tier: 'premium' })
  })

  it('notifies a tenant with a message', async () => {
    // Scenario: sending a notification targets the tenant-scoped notify route.
    mockPost.mockResolvedValueOnce({ tenantId: 't1', jobId: 'j1' })
    const { result } = renderHook(() => useTenantActions(), { wrapper: wrapper() })
    result.current.notify.mutate({ tenantId: 't1', message: 'hello' })
    await waitFor(() => {
      expect(result.current.notify.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/workers/tenants/t1/notify', { message: 'hello' })
  })

  it('removes a tenant worker', async () => {
    // Scenario: the "remove one live" journey deletes by tenant id.
    mockDelete.mockResolvedValueOnce({ tenantId: 't1', unregistered: true })
    const { result } = renderHook(() => useTenantActions(), { wrapper: wrapper() })
    result.current.remove.mutate('t1')
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true)
    })
    expect(mockDelete).toHaveBeenCalledWith('/workers/tenants/t1')
  })
})

describe('useRenderInvoice', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('posts the invoice id and lines to the render route', async () => {
    // Scenario: the CPU-offload demo enqueues a sandboxed render.
    mockPost.mockResolvedValueOnce({ invoiceId: 'inv-1', jobId: 'j1' })
    const { result } = renderHook(() => useRenderInvoice(), { wrapper: wrapper() })
    result.current.mutate({ invoiceId: 'inv-1', lines: ['a', 'b'] })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockPost).toHaveBeenCalledWith('/workers/invoices/render', {
      invoiceId: 'inv-1',
      lines: ['a', 'b'],
    })
  })
})

describe('useLagProbe', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('does not fetch when disabled', () => {
    // Scenario: the lag readout should not poll before a render is triggered.
    renderHook(() => useLagProbe(false), { wrapper: wrapper() })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches the lag sample when enabled', async () => {
    // Scenario: once enabled, the readout targets the exact lag route.
    mockGet.mockResolvedValueOnce({ meanMs: 1, maxMs: 3 })
    const { result } = renderHook(() => useLagProbe(true), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockGet).toHaveBeenCalledWith('/workers/lag')
  })
})
