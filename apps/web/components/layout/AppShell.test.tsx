/**
 * @fileoverview Unit tests for the app chrome (topbar + sidebar + content well).
 * @layer components/layout/AppShell.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/hooks/use-redis-status', () => ({
  useRedisStatus: () => ({ status: 'up', latencyMs: 4 }),
}))

import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders children inside the content well', () => {
    // Scenario: page content must reach the DOM through the shell.
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    )
    expect(screen.getByText('page content')).toBeInTheDocument()
  })

  it('widens the content well to max-w-7xl when wide is set', () => {
    // Scenario: chart-heavy pages (e.g. the flow tree) opt into a wider well.
    render(
      <AppShell wide>
        <p>wide content</p>
      </AppShell>,
    )
    expect(screen.getByText('wide content').parentElement).toHaveClass('max-w-7xl')
  })

  it('opens the mobile sidebar overlay from the topbar hamburger and closes it on backdrop click', async () => {
    // Scenario: the hamburger toggles isOpen; clicking the backdrop closes it again.
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const backdrop = screen.getByRole('button', { name: /close navigation menu/i })
    expect(backdrop).toBeInTheDocument()
    await userEvent.click(backdrop)
    expect(screen.queryByRole('button', { name: /close navigation menu/i })).not.toBeInTheDocument()
  })

  it('closes the mobile overlay when a sidebar nav link is clicked', async () => {
    // Scenario: tapping a nav link on mobile must also close the overlay,
    // exercising the Sidebar's onNavClick wiring distinct from the backdrop.
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    await userEvent.click(screen.getByRole('link', { name: /workers/i }))
    expect(screen.queryByRole('button', { name: /close navigation menu/i })).not.toBeInTheDocument()
  })

  it('threads the live Redis status into the topbar chip', () => {
    // Scenario: the shell wires useRedisStatus into the Topbar's chip.
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('redis ready · 4ms')
  })
})
