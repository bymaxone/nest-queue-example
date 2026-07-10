/**
 * @fileoverview Unit tests for the Redis status chip.
 * @layer components/redis-status-chip.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RedisStatusChip } from './redis-status-chip'

describe('RedisStatusChip', () => {
  it('renders the checking state with a text label (never color alone)', () => {
    // Scenario: before the first probe resolves, the chip must still announce
    // its state in text for screen readers, not just via color.
    render(<RedisStatusChip status="checking" />)
    expect(screen.getByRole('status')).toHaveTextContent('redis checking')
  })

  it('renders the up state with latency when provided', () => {
    // Scenario: a successful /health/ready probe reports latency; the chip
    // surfaces it so an operator can see Redis responsiveness at a glance.
    render(<RedisStatusChip status="up" latencyMs={12} />)
    expect(screen.getByRole('status')).toHaveTextContent('redis ready · 12ms')
  })

  it('renders the up state without latency when it is not provided', () => {
    // Scenario: latency is optional; omitting it must not print "undefined".
    render(<RedisStatusChip status="up" />)
    expect(screen.getByRole('status')).toHaveTextContent('redis ready')
    expect(screen.getByRole('status').textContent).not.toContain('undefined')
  })

  it('renders the down state distinctly from up/checking', () => {
    // Scenario: a failed readiness probe must read as clearly different from
    // the other two states (text content, not just color).
    render(<RedisStatusChip status="down" />)
    expect(screen.getByRole('status')).toHaveTextContent('redis down')
  })
})
