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
import { apiPost } from '@/lib/api-client'
import type {
  CampaignResult,
  DedupMode,
  OnboardingResult,
  PlacedOrder,
  ReindexResult,
} from '@/lib/api-types'

/** Body accepted by `POST /orders`. */
export interface PlaceOrderInput {
  to: string
  total: number
  vip: boolean
}

/** Mutations backing the playground's demo-domain laboratories. */
export function usePlayground() {
  const placeOrder = useMutation({
    mutationFn: (input: PlaceOrderInput) => apiPost<PlacedOrder>('/orders', input),
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

  return { placeOrder, onboard, sendCampaign, reindex }
}
