/**
 * @fileoverview Unit tests for the error-envelope pretty-printer.
 * @layer components/envelope-viewer.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnvelopeViewer } from './envelope-viewer'

describe('EnvelopeViewer', () => {
  it('renders the status chip, code, and message', () => {
    // Scenario: the three fields every envelope carries must always render.
    render(<EnvelopeViewer code="queue.job_not_found" message="Job not found" httpStatus={404} />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('queue.job_not_found')).toBeInTheDocument()
    expect(screen.getByText('Job not found')).toBeInTheDocument()
  })

  it('renders formatted details when present', () => {
    // Scenario: some codes (e.g. job_not_found) carry structured details.
    render(
      <EnvelopeViewer
        code="queue.job_not_found"
        message="Job not found"
        httpStatus={404}
        details={{ queue: 'email', jobId: '1' }}
      />,
    )
    expect(screen.getByText(/"queue": "email"/)).toBeInTheDocument()
  })

  it('omits the details block when details is undefined', () => {
    // Scenario: many codes carry no details at all.
    render(<EnvelopeViewer code="queue.job_not_found" message="Job not found" httpStatus={404} />)
    expect(document.querySelector('pre')).not.toBeInTheDocument()
  })

  it('omits the details block when details is explicitly null', () => {
    // Scenario: the API may send `details: null` rather than omitting the key.
    render(
      <EnvelopeViewer
        code="queue.job_not_found"
        message="Job not found"
        httpStatus={404}
        details={null}
      />,
    )
    expect(document.querySelector('pre')).not.toBeInTheDocument()
  })
})
