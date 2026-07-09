/**
 * @fileoverview Job-name and mode constants for the `search` queue family.
 * @layer app/search
 */

/** Job name for a search index rebuild. */
export const REINDEX_JOB = 'reindex'

/**
 * The four BullMQ-native deduplication strategies the reindex lab exposes. The
 * single source of truth for both the {@link DedupMode} union and the request
 * schema, so a mode added here is validated and typed in one place.
 */
export const DEDUP_MODES = ['simple', 'throttle', 'debounce', 'keepLast'] as const

/** A deduplication strategy accepted by the reindex lab. */
export type DedupMode = (typeof DEDUP_MODES)[number]
