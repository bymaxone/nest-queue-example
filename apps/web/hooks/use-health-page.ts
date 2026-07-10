/**
 * @fileoverview Data layer for the Health page: liveness, readiness, and the
 * connection diagnostics snapshot. Kept separate from `use-redis-status.ts`
 * (which maps the same readiness probe into topbar chip props); this hook
 * exposes the full response for a dedicated health surface.
 * @layer hooks/use-health-page
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { DiagnosticsSnapshot, ReadinessStatus } from '@/lib/api-types'
import { HEALTH_POLL_INTERVAL_MS } from '@/lib/constants'

/** Polls `GET /health/live`. */
export function useLiveness() {
  return useQuery({
    queryKey: ['health', 'live'],
    queryFn: () => apiGet<{ status: 'up' }>('/health/live'),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    retry: false,
  })
}

/** Polls `GET /health/ready`, carrying the aggregate active job count on success. */
export function useReadiness() {
  return useQuery({
    queryKey: ['health', 'ready', 'full'],
    queryFn: () => apiGet<ReadinessStatus>('/health/ready'),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    retry: false,
  })
}

/** Reads `GET /admin/diagnostics`: resolved mode, feature flags, and retry policy. */
export function useDiagnostics() {
  return useQuery({
    queryKey: ['admin', 'diagnostics'],
    queryFn: () => apiGet<DiagnosticsSnapshot>('/admin/diagnostics'),
  })
}
