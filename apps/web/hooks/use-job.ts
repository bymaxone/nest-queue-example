/**
 * @fileoverview Polls one job's detail (`GET /admin/jobs/:queue/:id`) while it
 * looks non-final. The job-detail DTO carries no explicit status field, so
 * finality is approximated as "has a return value or a failure reason
 * recorded yet" - the closest signal the endpoint actually exposes.
 * @layer hooks/use-job
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { JobView } from '@/lib/api-types'
import { METRICS_POLL_INTERVAL_MS } from '@/lib/constants'

/**
 * Whether a job view looks terminal: it has recorded a return value (completed)
 * or a failure reason (failed at least once).
 *
 * @param job - The job view to inspect.
 * @returns `true` when the job looks done, `false` while it still looks in-flight.
 */
export function looksFinal(job: JobView): boolean {
  return job.returnValue !== undefined || job.failedReason !== undefined
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
