/**
 * @fileoverview Polls the cached queue metrics surface (`GET /admin/metrics`)
 * on the same 3s cadence as the API's metrics cache TTL, so every read after
 * the first either hits a fresh cache entry or triggers the API to refresh it.
 * @layer hooks/use-metrics
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueueMetrics } from '@bymax-one/nest-queue/shared'
import { apiGet, apiPost } from '@/lib/api-client'
import type { InvalidateResult } from '@/lib/api-types'
import { METRICS_POLL_INTERVAL_MS } from '@/lib/constants'

/** Query key for the aggregate metrics read. */
export const METRICS_QUERY_KEY = ['admin', 'metrics'] as const

/**
 * Polls `GET /admin/metrics` for a snapshot of every managed queue.
 *
 * @returns The TanStack Query result carrying the metrics array.
 */
export function useMetrics() {
  return useQuery({
    queryKey: METRICS_QUERY_KEY,
    queryFn: () => apiGet<QueueMetrics[]>('/admin/metrics'),
    refetchInterval: METRICS_POLL_INTERVAL_MS,
  })
}

/**
 * Forces the API's metrics cache to drop (whole cache, or one queue when a
 * name is passed), then refetches the aggregate read so the UI shows the
 * freshly collected counts.
 *
 * @returns The invalidate mutation.
 */
export function useInvalidateMetrics() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (queue?: string) =>
      apiPost<InvalidateResult>('/admin/metrics/invalidate', queue === undefined ? {} : { queue }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: METRICS_QUERY_KEY }),
  })
}
