/**
 * @fileoverview Unit tests for the job attempts timeline.
 * @layer components/attempts-timeline.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JOB_STATUS } from '@bymax-one/nest-queue/shared'
import { AttemptsTimeline } from './attempts-timeline'

describe('AttemptsTimeline', () => {
  it('renders a no-attempts message when attemptsMade is zero', () => {
    // Scenario: a freshly-enqueued job has not attempted yet.
    render(<AttemptsTimeline attemptsMade={0} status={JOB_STATUS.WAITING} />)
    expect(screen.getByText('No attempts yet.')).toBeInTheDocument()
  })

  it('renders one marker per attempt', () => {
    // Scenario: three attempts must render exactly three numbered markers.
    render(<AttemptsTimeline attemptsMade={3} status={JOB_STATUS.ACTIVE} />)
    expect(screen.getByLabelText('Attempt 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Attempt 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Attempt 3')).toBeInTheDocument()
  })

  it('colors only the final marker red when the job is currently failed', () => {
    // Scenario: retries in progress must not look like final failures; only
    // the last marker on a truly failed job gets the red treatment.
    render(<AttemptsTimeline attemptsMade={2} status={JOB_STATUS.FAILED} failedReason="boom" />)
    expect(screen.getByLabelText('Attempt 1')).not.toHaveClass('bg-red-500/20')
    expect(screen.getByLabelText('Attempt 2 (failed)')).toHaveClass('bg-red-500/20')
  })

  it('shows the failure reason only when the job is failed', () => {
    // Scenario: a failedReason left over from a prior attempt must not show
    // once the job has since completed.
    const { rerender } = render(
      <AttemptsTimeline attemptsMade={2} status={JOB_STATUS.FAILED} failedReason="boom" />,
    )
    expect(screen.getByText('boom')).toBeInTheDocument()
    rerender(
      <AttemptsTimeline attemptsMade={2} status={JOB_STATUS.COMPLETED} failedReason="boom" />,
    )
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('grows the connecting gap between successive markers, capped at the maximum', () => {
    // Scenario: the visual backoff hint must widen with each retry, up to a cap.
    render(<AttemptsTimeline attemptsMade={10} status={JOB_STATUS.ACTIVE} />)
    const gaps = document.querySelectorAll('[aria-hidden="true"]')
    const widths = Array.from(gaps).map((gap) =>
      Number.parseInt((gap as HTMLElement).style.width, 10),
    )
    expect(widths[0]).toBeLessThan(widths[widths.length - 1] ?? 0)
    expect(Math.max(...widths)).toBeLessThanOrEqual(40)
  })
})
