/**
 * @fileoverview Queue-detail data layer: a paginated jobs read per status
 * (`GET /admin/queues/:name/jobs`) and the pause/resume/clean action
 * mutations, each invalidating the metrics and jobs caches on success so the
 * next poll reflects the change immediately.
 * @layer hooks/use-queue-jobs
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JobStatus } from '@bymax-one/nest-queue/shared'
import { apiGet, apiPost } from '@/lib/api-client'
import type { CleanStatus, JobView } from '@/lib/api-types'
import { METRICS_POLL_INTERVAL_MS } from '@/lib/constants'
import { METRICS_QUERY_KEY } from './use-metrics'

/** Builds the query key for one queue/status/page combination. */
export function queueJobsQueryKey(
  queue: string,
  status: JobStatus,
  start: number,
  end: number,
): readonly unknown[] {
  return ['admin', 'queues', queue, 'jobs', status, start, end] as const
}

/**
 * Pages jobs in a status for a queue.
 *
 * @param queue - The queue name.
 * @param status - The status tab currently selected.
 * @param start - Page start index (inclusive).
 * @param end - Page end index (inclusive).
 * @returns The TanStack Query result carrying the current page of jobs.
 */
export function useQueueJobs(queue: string, status: JobStatus, start: number, end: number) {
  return useQuery({
    queryKey: queueJobsQueryKey(queue, status, start, end),
    queryFn: () =>
      apiGet<JobView[]>(
        `/admin/queues/${queue}/jobs?status=${status}&start=${String(start)}&end=${String(end)}`,
      ),
    refetchInterval: METRICS_POLL_INTERVAL_MS,
  })
}

/**
 * Pause/resume/clean mutations for one queue. Every mutation invalidates the
 * metrics and this queue's jobs queries on success, so counts and tables
 * reflect the action on the next poll instead of waiting a full cycle.
 *
 * @param queue - The queue name the actions target.
 * @returns The three mutations, ready to `.mutate()`.
 */
export function useQueueActions(queue: string) {
  const queryClient = useQueryClient()

  /** Invalidates the metrics cache and every jobs page for this queue. */
  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: METRICS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'queues', queue, 'jobs'] })
  }

  const pause = useMutation({
    mutationFn: () => apiPost<{ paused: true }>(`/admin/queues/${queue}/pause`),
    onSuccess: invalidate,
  })
  const resume = useMutation({
    mutationFn: () => apiPost<{ resumed: true }>(`/admin/queues/${queue}/resume`),
    onSuccess: invalidate,
  })
  const clean = useMutation({
    mutationFn: (status: CleanStatus) =>
      apiPost<{ removed: string[] }>(`/admin/queues/${queue}/clean`, { status }),
    onSuccess: invalidate,
  })

  return { pause, resume, clean }
}
