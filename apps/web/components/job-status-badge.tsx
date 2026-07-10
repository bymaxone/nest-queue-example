/**
 * @fileoverview `JobStatusBadge` - the shared, accessible status pill for a
 * single BullMQ job status. Renders the design system's severity mapping
 * (color + icon + text together, spec §14) via `lib/queue-status.ts`.
 * @layer components/job-status-badge
 */

import type { JobStatus } from '@bymax-one/nest-queue/shared'
import { statusVisual } from '@/lib/queue-status'
import { cn } from '@/lib/utils'

export interface JobStatusBadgeProps {
  /** The job status to render. */
  status: JobStatus
  /** Additional classes merged onto the badge. */
  className?: string
}

/**
 * Accessible job-status pill: icon + color + text label together.
 *
 * @param props - Badge props.
 * @param props.status - The job status to render.
 * @param props.className - Additional classes merged onto the badge.
 * @returns The rendered status pill.
 */
export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const visual = statusVisual(status)
  const Icon = visual.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold',
        visual.className,
        className,
      )}
    >
      <Icon className={cn('h-3 w-3', visual.isPulsing && 'animate-isPulsing')} aria-hidden="true" />
      {visual.label}
    </span>
  )
}
