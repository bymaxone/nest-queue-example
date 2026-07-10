/**
 * @fileoverview Maps `JOB_STATUS` (and the event-feed source) to the design
 * system's accessible severity palette: every status carries a color, an
 * icon, AND a text label together, never color alone (spec §14).
 * @layer lib/queue-status
 */
import { JOB_STATUS, type JobStatus } from '@bymax-one/nest-queue/shared'
import {
  Activity,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Timer,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react'

/** Visual treatment for one job status: label, icon, and badge classes. */
export interface StatusVisual {
  /** Human-readable label, always rendered next to the icon and color. */
  label: string
  /** Icon component reinforcing the status without relying on color alone. */
  icon: LucideIcon
  /** Tailwind classes for the badge border/background/text. */
  className: string
  /** Whether the icon should carry a pulsing animation (in-flight work). */
  isPulsing?: boolean
}

/** Severity visuals per BullMQ job status, matching the design system §14 mapping. */
export const JOB_STATUS_VISUALS: Record<JobStatus, StatusVisual> = {
  [JOB_STATUS.WAITING]: {
    label: 'Waiting',
    icon: Clock,
    className: 'border-white/15 bg-white/5 text-white/60',
  },
  [JOB_STATUS.ACTIVE]: {
    label: 'Active',
    icon: Loader2,
    className: 'border-brand-500/40 bg-brand-500/10 text-brand-500',
    isPulsing: true,
  },
  [JOB_STATUS.COMPLETED]: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'border-green-500/30 bg-green-500/10 text-green-400',
  },
  [JOB_STATUS.FAILED]: {
    label: 'Failed',
    icon: XCircle,
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
  [JOB_STATUS.DELAYED]: {
    label: 'Delayed',
    icon: Timer,
    className: 'border-blue-400/30 bg-blue-400/10 text-blue-400',
  },
  [JOB_STATUS.PAUSED]: {
    label: 'Paused',
    icon: PauseCircle,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
}

/**
 * Look up the severity visual for a job status.
 *
 * @param status - The BullMQ job status.
 * @returns The label, icon, and classes for that status.
 */
export function statusVisual(status: JobStatus): StatusVisual {
  return JOB_STATUS_VISUALS[status]
}

/** Ordered list of every job status, for tab strips and legends. */
export const ALL_JOB_STATUSES: readonly JobStatus[] = Object.values(JOB_STATUS)

/**
 * Neutral fallback visual for labels that are not one of the six job
 * statuses (e.g. the SSE feed's `progress`, or BullMQ's `waiting-children`
 * flow-node state).
 */
export const NEUTRAL_VISUAL: StatusVisual = {
  label: 'Unknown',
  icon: Activity,
  className: 'border-white/15 bg-white/5 text-white/60',
}

/**
 * Look up the severity visual for an arbitrary label, falling back to a
 * neutral treatment when it is not one of the six job statuses. Shared by
 * every surface that renders a label that is USUALLY, but not always, a
 * `JobStatus` (the event feed, the flow tree).
 *
 * @param label - The label to look up (an event kind or a raw job state).
 * @returns The matching visual, or {@link NEUTRAL_VISUAL} when no status matches.
 */
export function paletteVisual(label: string): StatusVisual {
  const match = Object.entries(JOB_STATUS_VISUALS).find(([status]) => status === label)
  return match !== undefined ? { ...match[1], label } : { ...NEUTRAL_VISUAL, label }
}
