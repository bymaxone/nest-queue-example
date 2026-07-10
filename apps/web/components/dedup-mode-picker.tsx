/**
 * @fileoverview `DedupModePicker` - a pill selector for the four BullMQ-native
 * deduplication strategies the reindex lab exposes. Each pill carries the
 * mode name and a one-line description of its exact `deduplication` option
 * shape (mirrors `apps/api/src/search/reindex.service.ts`), so the picker
 * doubles as documentation.
 * @layer components/dedup-mode-picker
 */

import { DEDUP_MODES, type DedupMode } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export interface DedupModePickerProps {
  /** The currently selected mode. */
  value: DedupMode
  /** Called with the newly selected mode. */
  onChange: (mode: DedupMode) => void
}

/** One-line description of each mode's exact BullMQ `deduplication` shape. */
const MODE_DESCRIPTIONS: Record<DedupMode, string> = {
  simple: 'Collapses repeats into the existing job until it starts (no TTL).',
  throttle: 'Collapses repeats into one job per 5s window (rate limiting).',
  debounce: 'Extends the window on every repeat; only the latest payload runs.',
  keepLast: 'Queues at most one job behind an already-active run.',
}

/**
 * Pill selector for the four deduplication strategies, each self-documenting
 * with its exact `deduplication` option shape.
 *
 * @param props - Picker props.
 * @param props.value - The currently selected mode.
 * @param props.onChange - Called with the newly selected mode.
 * @returns The rendered picker.
 */
export function DedupModePicker({ value, onChange }: DedupModePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Deduplication mode"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {DEDUP_MODES.map((mode) => {
        const selected = mode === value
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(mode)
            }}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors',
              selected
                ? 'border-brand-500/50 bg-brand-500/10'
                : 'border-(--glass-border) bg-(--glass-bg) hover:bg-(--glass-bg-hover)',
            )}
          >
            <span
              className={cn(
                'block font-mono text-sm font-semibold',
                selected ? 'text-brand-500' : 'text-foreground',
              )}
            >
              {mode}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {MODE_DESCRIPTIONS[mode]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
