/**
 * @fileoverview Unit tests for the topbar brand + status chip + hamburger.
 * @layer components/layout/Topbar.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Topbar } from './Topbar'

describe('Topbar', () => {
  it('renders the wordmark', () => {
    // Scenario: the brand wordmark identifies this app among the sibling examples.
    render(<Topbar />)
    expect(screen.getByText('nest-queue-example')).toBeInTheDocument()
  })

  it('defaults the Redis chip to the checking state when no status is given', () => {
    // Scenario: before AppShell's hook resolves a first value, the chip must
    // still render a safe default rather than crashing on undefined props.
    render(<Topbar />)
    expect(screen.getByRole('status')).toHaveTextContent('redis checking')
  })

  it('renders the given Redis status', () => {
    // Scenario: AppShell threads the live probe result through.
    render(<Topbar redisStatus={{ status: 'up', latencyMs: 3 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('redis ready · 3ms')
  })

  it('calls onMenuOpen when the hamburger button is pressed', async () => {
    // Scenario: the mobile hamburger opens the sidebar overlay via the callback.
    const onMenuOpen = vi.fn()
    render(<Topbar onMenuOpen={onMenuOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(onMenuOpen).toHaveBeenCalledTimes(1)
  })

  it('renders an optional right slot', () => {
    // Scenario: pages may inject an extra control (reserved for future use).
    render(<Topbar right={<span>extra</span>} />)
    expect(screen.getByText('extra')).toBeInTheDocument()
  })
})
