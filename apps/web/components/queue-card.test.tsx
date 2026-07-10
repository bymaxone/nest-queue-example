/**
 * @fileoverview Unit tests for the queue overview card.
 * @layer components/queue-card.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { QueueMetrics } from '@bymax-one/nest-queue/shared'
import { QueueCard } from './queue-card'

const baseMetrics: QueueMetrics = {
  queue: 'email',
  counts: { waiting: 2, active: 1, completed: 10, failed: 0, delayed: 0, paused: 0 },
  collectedAt: '2026-07-09T00:00:00.000Z',
}

describe('QueueCard', () => {
  it('renders the queue name and the total job count', () => {
    // Scenario: the card's headline must sum every status into a total.
    render(<QueueCard metrics={baseMetrics} />)
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('13 jobs total')).toBeInTheDocument()
  })

  it('links to the per-queue detail route', () => {
    // Scenario: clicking a card must drill into /queues/[name].
    render(<QueueCard metrics={baseMetrics} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/queues/email')
  })

  it('shows a paused badge when the paused count is non-zero', () => {
    // Scenario: the paused count is the only signal available for "is this
    // queue administratively paused"; a non-zero count must surface the badge.
    render(<QueueCard metrics={{ ...baseMetrics, counts: { ...baseMetrics.counts, paused: 3 } }} />)
    expect(screen.getByText('paused')).toBeInTheDocument()
  })

  it('omits the paused badge when the paused count is zero', () => {
    // Scenario: the common case (no paused jobs) must not show a stray badge.
    render(<QueueCard metrics={baseMetrics} />)
    expect(screen.queryByText('paused')).not.toBeInTheDocument()
  })

  it('renders a status badge for every one of the six job statuses', () => {
    // Scenario: the card is a complete per-status snapshot, not a subset.
    render(<QueueCard metrics={baseMetrics} />)
    for (const label of ['Waiting', 'Active', 'Completed', 'Failed', 'Delayed', 'Paused']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
