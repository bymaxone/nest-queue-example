/**
 * @fileoverview Data layer for the error explorer: the catalog read and the
 * trigger mutation. A trigger call is EXPECTED to reject for a reproducible
 * code (the library's `QueueException` renders as a non-2xx response), so
 * the page reads the thrown `ApiError` as the envelope to display rather
 * than treating it as a failure to recover from.
 * @layer hooks/use-errors
 */
'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { CatalogEntry } from '@/lib/api-types'

/** Reads `GET /errors/catalog`. */
export function useErrorCatalog() {
  return useQuery({
    queryKey: ['errors', 'catalog'],
    queryFn: () => apiGet<CatalogEntry[]>('/errors/catalog'),
  })
}

/**
 * Triggers a reproducible catalog code. The mutation function itself always
 * throws for a reproducible code (a 4xx/5xx `ApiError`); callers read the
 * error in `onError`, not `onSuccess`.
 *
 * @returns The trigger mutation.
 */
export function useTriggerError() {
  return useMutation({
    mutationFn: (code: string) => apiPost<never>(`/errors/trigger/${code}`),
  })
}
