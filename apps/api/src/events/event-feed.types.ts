/**
 * @fileoverview Shapes for the queue-event feed bridged to Server-Sent Events.
 * A feed entry is discriminated by `source` so the UI can badge worker-local
 * entries (full `Job` fields) differently from global entries (serialized
 * fields), making the two event levels visibly distinct.
 * @layer app/events
 */

/**
 * Where a feed entry originated: a worker-local `@OnWorkerEvent` listener (full
 * `Job` available) or a global `@OnQueueEvent` listener (serialized payload).
 */
export type FeedSource = 'worker' | 'global'

/**
 * A single feed entry. Situational fields are present only when the source
 * provides them: worker entries carry `data`/`returnvalue`/`attemptsMade`, while
 * global entries carry the serialized `returnvalue` string and, when the job was
 * still resolvable, `resolvedData` from the `getJob` fallback.
 */
export interface FeedEntry {
  /** Origin of the entry (worker-local vs global). */
  source: FeedSource
  /** Queue the event belongs to. */
  queue: string
  /** Event name, e.g. `completed`, `failed`, `progress`, `active`. */
  event: string
  /** Job id when known (a global `failed` before the worker fetched the job may lack one). */
  jobId: string | undefined
  /** ISO 8601 timestamp of when the entry was recorded. */
  at: string
  /** Redacted job payload (worker source). */
  data?: unknown
  /** Handler return value: the actual value (worker) or the serialized string (global). */
  returnvalue?: unknown
  /** Latest reported progress (worker `progress` events). */
  progress?: unknown
  /** Attempts made so far (worker source). */
  attemptsMade?: number
  /** Failure reason for `failed` events. */
  failedReason?: string
  /** Redacted payload resolved via the `getJob` fallback (global source). */
  resolvedData?: unknown
}
