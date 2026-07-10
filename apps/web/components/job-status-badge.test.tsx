/**
 * @fileoverview Unit tests for the job status badge.
 * @layer components/job-status-badge.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JOB_STATUS } from '@bymax-one/nest-queue/shared'
import { JobStatusBadge } from './job-status-badge'

describe('JobStatusBadge', () => {
  it('renders the label text for every status, never color alone', () => {
    // Scenario: every one of the six statuses must be readable as text, not
    // just a colored dot, for accessibility.
    for (const status of Object.values(JOB_STATUS)) {
      const { unmount } = render(<JobStatusBadge status={status} />)
      expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument()
      unmount()
    }
  })

  it('pulses the icon only for the active status', () => {
    // Scenario: only genuinely in-flight work gets the pulsing treatment.
    render(<JobStatusBadge status={JOB_STATUS.ACTIVE} />)
    const icon = document.querySelector('svg')
    expect(icon).toHaveClass('animate-isPulsing')
  })

  it('does not isPulsing the icon for a terminal status', () => {
    // Scenario: completed jobs are done; no pulsing animation should linger.
    render(<JobStatusBadge status={JOB_STATUS.COMPLETED} />)
    const icon = document.querySelector('svg')
    expect(icon).not.toHaveClass('animate-isPulsing')
  })

  it('merges an additional className onto the badge', () => {
    // Scenario: callers can add layout classes (e.g. margin) without losing
    // the base severity classes.
    render(<JobStatusBadge status={JOB_STATUS.WAITING} className="ml-2" />)
    expect(screen.getByText(/waiting/i)).toHaveClass('ml-2')
  })
})
