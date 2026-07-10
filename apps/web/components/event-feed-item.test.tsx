/**
 * @fileoverview Unit tests for the live-feed row component.
 * @layer components/event-feed-item.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { FeedEntry } from '@/lib/api-types'
import { EventFeedItem } from './event-feed-item'

const baseEntry: FeedEntry = {
  source: 'worker',
  queue: 'email',
  event: 'completed',
  jobId: '42',
  at: '2026-07-09T12:00:00.000Z',
}

describe('EventFeedItem', () => {
  it('renders the event kind, queue, and job id', () => {
    // Scenario: an operator scanning the feed must see kind + queue + id at a glance.
    render(<EventFeedItem entry={baseEntry} />)
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('#42')).toBeInTheDocument()
  })

  it('badges a worker-source entry distinctly from a global-source entry', () => {
    // Scenario: worker vs global entries must be visually distinguishable.
    const { rerender } = render(<EventFeedItem entry={baseEntry} />)
    expect(screen.getByText('worker')).toHaveClass('text-brand-500')
    rerender(<EventFeedItem entry={{ ...baseEntry, source: 'global' }} />)
    expect(screen.getByText('global')).toHaveClass('text-white/50')
  })

  it('omits the job id badge when the entry has no job id', () => {
    // Scenario: some global entries (e.g. an early failed before the worker
    // fetched the job) may lack a job id entirely.
    render(<EventFeedItem entry={{ ...baseEntry, jobId: undefined }} />)
    expect(screen.queryByText('#42')).not.toBeInTheDocument()
  })

  it('falls back to a neutral badge for a non-status event kind', () => {
    // Scenario: 'progress' and 'drained' are not JOB_STATUS values; they must
    // still render without crashing, using the neutral fallback treatment.
    render(<EventFeedItem entry={{ ...baseEntry, event: 'progress' }} />)
    expect(screen.getByText('progress')).toHaveClass('text-white/60')
  })

  it('uses the matching job-status palette for a status-shaped event kind', () => {
    // Scenario: 'failed' matches JOB_STATUS.FAILED and must use its red treatment.
    render(<EventFeedItem entry={{ ...baseEntry, event: 'failed' }} />)
    expect(screen.getByText('failed')).toHaveClass('text-red-400')
  })
})
