/**
 * @fileoverview Polls the API's `GET /health/ready` and maps it to the
 * `RedisStatusChip` props. The chip never talks to Redis directly; it only
 * reflects what the API reports, timing the round-trip client-side since the
 * probe itself does not return a latency figure.
 * @layer hooks/use-redis-status
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { HEALTH_POLL_INTERVAL_MS } from '@/lib/constants'
import type { RedisStatusChipProps } from '@/components/redis-status-chip'

/** Response shape of `GET /health/ready` on success. */
interface ReadinessResponse {
  status: 'up'
  activeJobs: number
}

/** Query key for the readiness probe. */
export const REDIS_STATUS_QUERY_KEY = ['health', 'ready'] as const

/**
 * Times a readiness probe and reports the round-trip in milliseconds.
 *
 * @returns The measured latency; rejects when the probe itself rejects.
 */
async function timedProbe(): Promise<number> {
  const startedAt = performance.now()
  await apiGet<ReadinessResponse>('/health/ready')
  return Math.round(performance.now() - startedAt)
}

/**
 * Polls readiness and maps the result to Redis status chip props.
 *
 * @returns Chip props reflecting the latest probe: `checking` while the first
 *   probe is in flight, `up` with latency on success, `down` on failure.
 */
export function useRedisStatus(): RedisStatusChipProps {
  const { data, isError, isPending } = useQuery({
    queryKey: REDIS_STATUS_QUERY_KEY,
    queryFn: timedProbe,
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    retry: false,
  })

  if (isPending) return { status: 'checking' }
  if (isError) return { status: 'down' }
  return { status: 'up', latencyMs: data }
}
