/**
 * @fileoverview Polls one job's detail (`GET /admin/jobs/:queue/:id`) while it
 * is in-flight. Finality is read from the DTO's `finishedOn` timestamp, which
 * BullMQ sets when a job completes or fails, so polling stops even for handlers
 * that return void on success (where `returnValue` stays undefined).
 * @layer hooks/use-job
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { JobView } from '@/lib/api-types'
import { METRICS_POLL_INTERVAL_MS } from '@/lib/constants'

/**
 * Whether a job view is terminal: BullMQ records `finishedOn` when a job
 * completes or fails, so it is reliable even for handlers that return void on
 * success (where `returnValue` stays undefined).
 *
 * @param job - The job view to inspect.
 * @returns `true` when the job has finished, `false` while it is still in-flight.
 */
export function looksFinal(job: JobView): boolean {
  return job.finishedOn !== undefined
}

/**
 * Fetches and polls one job's detail while it looks non-final.
 *
 * @param queue - The queue the job belongs to.
 * @param id - The job id.
 * @returns The TanStack Query result carrying the job view.
 */
export function useJob(queue: string, id: string) {
  return useQuery({
    queryKey: ['admin', 'jobs', queue, id],
    queryFn: () => apiGet<JobView>(`/admin/jobs/${queue}/${id}`),
    refetchInterval: (query) => {
      const job = query.state.data
      return job === undefined || !looksFinal(job) ? METRICS_POLL_INTERVAL_MS : false
    },
  })
}
