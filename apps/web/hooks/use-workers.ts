/**
 * @fileoverview Data layer for the Workers page: the dynamic per-tenant
 * worker CRUD + delivery trail, the sandboxed invoice render trigger, and the
 * event-loop-lag readout.
 * @layer hooks/use-workers
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'
import type {
  LagSample,
  RenderRequested,
  TenantDelivery,
  TenantRegistered,
  TenantTier,
  TenantWorkerView,
} from '@/lib/api-types'

/** Query key for the tenant worker list. */
const TENANTS_QUERY_KEY = ['workers', 'tenants'] as const
/** Query key for the tenant delivery trail. */
const DELIVERIES_QUERY_KEY = ['workers', 'tenants', 'deliveries'] as const
/** Poll interval (ms) for the event-loop-lag readout; fast enough to visualize a render in progress. */
const LAG_POLL_INTERVAL_MS = 500

/** Lists every registered tenant worker. */
export function useTenantWorkers() {
  return useQuery({
    queryKey: TENANTS_QUERY_KEY,
    queryFn: () => apiGet<{ workers: TenantWorkerView[] }>('/workers/tenants'),
  })
}

/** Reads the recorded tenant notification deliveries, oldest first. */
export function useTenantDeliveries() {
  return useQuery({
    queryKey: DELIVERIES_QUERY_KEY,
    queryFn: () => apiGet<{ deliveries: TenantDelivery[] }>('/workers/tenants/deliveries'),
  })
}

/**
 * Register, notify, and remove tenant workers, invalidating the tenant list
 * and delivery trail on any change.
 *
 * @returns The three tenant-worker mutations.
 */
export function useTenantActions() {
  const queryClient = useQueryClient()

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: TENANTS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
  }

  const register = useMutation({
    mutationFn: (input: { tenantId: string; tier: TenantTier }) =>
      apiPost<TenantRegistered>('/workers/tenants', input),
    onSuccess: invalidate,
  })
  const notify = useMutation({
    mutationFn: ({ tenantId, message }: { tenantId: string; message: string }) =>
      apiPost<{ tenantId: string; jobId: string | undefined }>(
        `/workers/tenants/${tenantId}/notify`,
        {
          message,
        },
      ),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (tenantId: string) =>
      apiDelete<{ tenantId: string; unregistered: boolean }>(`/workers/tenants/${tenantId}`),
    onSuccess: invalidate,
  })

  return { register, notify, remove }
}

/** Enqueues a sandboxed invoice render. */
export function useRenderInvoice() {
  return useMutation({
    mutationFn: (input: { invoiceId: string; lines: string[] }) =>
      apiPost<RenderRequested>('/workers/invoices/render', input),
  })
}

/** Polls the event-loop-lag readout while an invoice render is likely in flight. */
export function useLagProbe(isEnabled: boolean) {
  return useQuery({
    queryKey: ['workers', 'lag'],
    queryFn: () => apiGet<LagSample>('/workers/lag'),
    enabled: isEnabled,
    refetchInterval: isEnabled ? LAG_POLL_INTERVAL_MS : false,
  })
}
