/**
 * @fileoverview Data layer for the schedulers page: list, upsert, and remove
 * Job Schedulers on the two managed queues.
 * @layer hooks/use-schedulers
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JobSchedulerRepeatOptions } from '@bymax-one/nest-queue/shared'
import { apiDelete, apiGet, apiPut } from '@/lib/api-client'
import type { JobSchedulerJson, SchedulerQueue, SchedulerUpserted } from '@/lib/api-types'

/** Query key for one managed queue's scheduler list. */
export function schedulersQueryKey(queue: SchedulerQueue): readonly unknown[] {
  return ['schedulers', queue] as const
}

/**
 * Lists the schedulers registered on a managed queue.
 *
 * @param queue - The managed queue to list schedulers for.
 * @returns The TanStack Query result carrying the scheduler list.
 */
export function useSchedulers(queue: SchedulerQueue) {
  return useQuery({
    queryKey: schedulersQueryKey(queue),
    queryFn: () => apiGet<{ schedulers: JobSchedulerJson[] }>(`/schedulers?queue=${queue}`),
  })
}

/** Body accepted by the upsert mutation. */
export interface UpsertSchedulerInput {
  queue: SchedulerQueue
  id: string
  repeat: JobSchedulerRepeatOptions
}

/**
 * Upserts and removes schedulers, invalidating the affected queue's list on success.
 *
 * @returns The upsert and remove mutations.
 */
export function useSchedulerActions() {
  const queryClient = useQueryClient()

  const upsert = useMutation({
    mutationFn: ({ queue, id, repeat }: UpsertSchedulerInput) =>
      apiPut<SchedulerUpserted>(`/schedulers/${queue}/${id}`, { repeat }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: schedulersQueryKey(variables.queue) })
    },
  })

  const remove = useMutation({
    mutationFn: ({ queue, id }: { queue: SchedulerQueue; id: string }) =>
      apiDelete<{ removed: boolean }>(`/schedulers/${queue}/${id}`),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: schedulersQueryKey(variables.queue) })
    },
  })

  return { upsert, remove }
}
