/**
 * @fileoverview `AttemptsTimeline` - visualizes a job's `attemptsMade` as a
 * row of numbered markers with growing gaps between them, hinting at the
 * module's exponential backoff (each retry waits longer than the last). The
 * final marker is colored red when the job's current status is `failed`.
 * @layer components/attempts-timeline
 */

import { JOB_STATUS, type JobStatus } from '@bymax-one/nest-queue/shared'
import { cn } from '@/lib/utils'

export interface AttemptsTimelineProps {
  /** How many attempts have been made so far. */
  attemptsMade: number
  /** The job's current status, used to color the final marker. */
  status: JobStatus
  /** The latest failure reason, shown below the timeline when the job failed. */
  failedReason?: string
}

/** Base gap (px) before the growth per attempt, and the cap on that growth. */
const BASE_GAP_PX = 8
const GAP_STEP_PX = 6
const MAX_GAP_PX = 40

/**
 * Compute the connecting-line width for one attempt index, growing with the
 * index (capped) to hint at exponential backoff without needing real timing data.
 *
 * @param index - Zero-based attempt index.
 * @returns The gap width in pixels.
 */
function gapWidth(index: number): number {
  return Math.min(BASE_GAP_PX + index * GAP_STEP_PX, MAX_GAP_PX)
}

/**
 * Numbered attempt markers with backoff-hinting spacing; the last marker
 * turns red when the job is currently failed.
 *
 * @param props - Timeline props.
 * @param props.attemptsMade - How many attempts have been made so far.
 * @param props.status - The job's current status.
 * @param props.failedReason - The latest failure reason, when present.
 * @returns The rendered timeline.
 */
export function AttemptsTimeline({ attemptsMade, status, failedReason }: AttemptsTimelineProps) {
  if (attemptsMade === 0) {
    return <p className="text-sm text-muted-foreground">No attempts yet.</p>
  }

  const attempts = Array.from({ length: attemptsMade }, (_, index) => index + 1)

  return (
    <div>
      <ol className="flex flex-wrap items-center">
        {attempts.map((attempt, index) => {
          const isLast = attempt === attemptsMade
          const failed = isLast && status === JOB_STATUS.FAILED
          return (
            <li key={attempt} className="flex items-center">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs',
                  failed ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-500',
                )}
                aria-label={`Attempt ${String(attempt)}${failed ? ' (failed)' : ''}`}
              >
                {attempt}
              </span>
              {index < attempts.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="h-px bg-white/15"
                  style={{ width: `${String(gapWidth(index))}px` }}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
      {status === JOB_STATUS.FAILED && failedReason !== undefined ? (
        <p className="mt-2 font-mono text-xs text-red-400">{failedReason}</p>
      ) : null}
    </div>
  )
}
