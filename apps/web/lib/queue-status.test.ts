/**
 * @fileoverview Unit tests for the job-status severity mapping.
 * @layer lib/queue-status.test
 */
import { describe, it, expect } from 'vitest'
import { JOB_STATUS } from '@bymax-one/nest-queue/shared'
import {
  statusVisual,
  JOB_STATUS_VISUALS,
  ALL_JOB_STATUSES,
  paletteVisual,
  NEUTRAL_VISUAL,
} from './queue-status'

describe('statusVisual', () => {
  it('maps every one of the six statuses to a visual with a label and icon', () => {
    // Scenario: the palette must be total over JOB_STATUS; a missing entry
    // would render "undefined" in the UI.
    for (const status of Object.values(JOB_STATUS)) {
      const visual = statusVisual(status)
      expect(visual.label.length).toBeGreaterThan(0)
      expect(visual.icon).toBeDefined()
      expect(visual.className.length).toBeGreaterThan(0)
    }
  })

  it('marks only the active status as pulsing (in-flight work)', () => {
    // Scenario: the isPulsing treatment is reserved for genuinely in-progress
    // work; every other status must be static.
    expect(JOB_STATUS_VISUALS[JOB_STATUS.ACTIVE].isPulsing).toBe(true)
    expect(JOB_STATUS_VISUALS[JOB_STATUS.COMPLETED].isPulsing).toBeUndefined()
    expect(JOB_STATUS_VISUALS[JOB_STATUS.FAILED].isPulsing).toBeUndefined()
  })

  it('gives completed and failed visually distinct colors (green vs red)', () => {
    // Scenario: the two terminal statuses must never share a color class.
    expect(JOB_STATUS_VISUALS[JOB_STATUS.COMPLETED].className).toContain('green')
    expect(JOB_STATUS_VISUALS[JOB_STATUS.FAILED].className).toContain('red')
  })
})

describe('ALL_JOB_STATUSES', () => {
  it('lists all six BullMQ statuses', () => {
    // Scenario: tab strips iterate this list; it must never silently drop a status.
    expect(ALL_JOB_STATUSES).toHaveLength(6)
    expect(ALL_JOB_STATUSES).toEqual(expect.arrayContaining(Object.values(JOB_STATUS)))
  })
})

describe('paletteVisual', () => {
  it('matches a label that is one of the six job statuses', () => {
    // Scenario: the event feed and flow tree pass raw strings that are
    // sometimes exactly a JobStatus (e.g. 'completed', 'failed').
    expect(paletteVisual(JOB_STATUS.FAILED).className).toBe(
      JOB_STATUS_VISUALS[JOB_STATUS.FAILED].className,
    )
  })

  it('falls back to the neutral visual for a non-status label', () => {
    // Scenario: 'waiting-children' (a flow-node state) and 'progress' (an
    // event kind) are not JOB_STATUS values; both must degrade gracefully.
    expect(paletteVisual('waiting-children').className).toBe(NEUTRAL_VISUAL.className)
    expect(paletteVisual('progress').icon).toBe(NEUTRAL_VISUAL.icon)
  })

  it('preserves the original label text on the returned visual', () => {
    // Scenario: callers render the input label as-is, not a canonicalized one.
    expect(paletteVisual('waiting-children').label).toBe('waiting-children')
  })
})
