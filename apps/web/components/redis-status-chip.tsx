/**
 * @fileoverview Redis status chip - a presentational, accessible status pill
 * for the topbar. Reflects the API's `/health/ready` probe (never connects to
 * Redis directly from the browser). Status is always carried by color, an
 * icon, AND text together, never color alone.
 *
 * @layer components/redis-status-chip
 */

import { Circle, CircleOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The three states the chip can render. */
export type RedisStatus = 'checking' | 'up' | 'down'

export interface RedisStatusChipProps {
  /** Current readiness state, sourced from the API's health probe. */
  status: RedisStatus
  /** Round-trip latency in milliseconds, shown only when known and up. */
  latencyMs?: number
}

/** Text label per status, always rendered alongside the color and icon. */
const STATUS_LABEL: Record<RedisStatus, string> = {
  checking: 'checking',
  up: 'ready',
  down: 'down',
}

/** Text color class per status. */
const STATUS_COLOR: Record<RedisStatus, string> = {
  checking: 'text-white/40',
  up: 'text-green-400',
  down: 'text-red-400',
}

/**
 * Renders the status icon for a given readiness state.
 *
 * @param status - Current readiness state.
 * @returns The icon element for the chip.
 */
function StatusIcon({ status }: { status: RedisStatus }) {
  if (status === 'checking') return <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
  if (status === 'down') return <CircleOff className="h-3 w-3" aria-hidden="true" />
  return <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
}

/**
 * Accessible Redis readiness chip: color + icon + text together.
 *
 * @param props - Chip props.
 * @param props.status - Current readiness state.
 * @param props.latencyMs - Optional round-trip latency, shown when ready.
 * @returns The rendered chip.
 */
export function RedisStatusChip({ status, latencyMs }: RedisStatusChipProps) {
  const label =
    status === 'up' && latencyMs !== undefined
      ? `redis ${STATUS_LABEL[status]} · ${String(latencyMs)}ms`
      : `redis ${STATUS_LABEL[status]}`

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-(--glass-border) bg-(--glass-bg) px-3 py-1 font-mono text-xs',
        STATUS_COLOR[status],
      )}
    >
      <StatusIcon status={status} />
      <span>{label}</span>
    </div>
  )
}
