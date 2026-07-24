/**
 * @fileoverview Data layer for the playground page: the demo-domain
 * enqueue-facing mutations the api exposes (orders, onboarding, campaigns,
 * search reindex). There is no generic "enqueue anything" endpoint (spec §11
 * lists only these domain routes), so the playground is a set of small
 * laboratories over them rather than one universal form.
 * @layer hooks/use-playground
 */
'use client'

import { useMutation } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'
import type {
  CampaignResult,
  DedupKeyCleared,
  DedupKeyView,
  DedupMode,
  OnboardingResult,
  PlacedOrder,
  ReindexResult,
  ReportRequested,
  StallRequested,
} from '@/lib/api-types'

/** Body accepted by `POST /orders`. */
export interface PlaceOrderInput {
  to: string
  total: number
  vip: boolean
}

/**
 * Builds the dedup-inspector path for a reindex term. The key mirrors the
 * api's `dedupId` (`reindex:<term>`); the colon is legal in a dedup key, so
 * the whole key is URI-encoded into a single path segment.
 *
 * @param term - The search term whose dedup key is inspected.
 * @returns The admin dedup path for the term's key.
 */
export function dedupKeyPath(term: string): string {
  return `/admin/dedup/search/${encodeURIComponent(`reindex:${term}`)}`
}

/** Mutations backing the playground's demo-domain laboratories. */
export function usePlayground() {
  const placeOrder = useMutation({
    mutationFn: (input: PlaceOrderInput) => apiPost<PlacedOrder>('/orders', input),
  })
  const remindOrder = useMutation({
    mutationFn: (orderId: string) => apiPost<PlacedOrder>(`/orders/${orderId}/remind`),
  })
  const onboard = useMutation({
    mutationFn: (userId: string) => apiPost<OnboardingResult>(`/onboarding/${userId}`),
  })
  const sendCampaign = useMutation({
    mutationFn: (count: number) => apiPost<CampaignResult>('/campaigns/receipts', { count }),
  })
  const reindex = useMutation({
    mutationFn: (input: { term: string; mode: DedupMode }) =>
      apiPost<ReindexResult>('/search/reindex', input),
  })
  const viewDedupKey = useMutation({
    mutationFn: (term: string) => apiGet<DedupKeyView>(dedupKeyPath(term)),
  })
  const clearDedupKey = useMutation({
    mutationFn: (term: string) => apiDelete<DedupKeyCleared>(dedupKeyPath(term)),
  })
  const generateReport = useMutation({
    mutationFn: () => apiPost<ReportRequested>('/reports'),
  })
  const stallDemo = useMutation({
    mutationFn: () => apiPost<StallRequested>('/demos/stall'),
  })

  return {
    placeOrder,
    remindOrder,
    onboard,
    sendCampaign,
    reindex,
    viewDedupKey,
    clearDedupKey,
    generateReport,
    stallDemo,
  }
}
