/**
 * @fileoverview Unit tests for the sidebar navigation rail.
 * @layer components/layout/Sidebar.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const pathnameMock = vi.fn<() => string>()
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}))

import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('marks Overview active only on the exact root path', () => {
    // Scenario: root matches ONLY the exact '/'. A nested path must not
    // activate the root nav item.
    pathnameMock.mockReturnValue('/')
    render(<Sidebar isOpen={true} />)
    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps a sibling route inactive while a nested child route is current', () => {
    // Scenario: at /queues/email, the Queues item stays active (prefix match)
    // while unrelated items like Flows stay inactive.
    pathnameMock.mockReturnValue('/queues/email')
    render(<Sidebar isOpen={true} />)
    expect(screen.getByRole('link', { name: /queues/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /flows/i })).not.toHaveAttribute('aria-current')
  })

  it('toggles the open/hidden visibility classes from the isOpen prop', () => {
    // Scenario: on mobile the rail is hidden until the hamburger opens it.
    pathnameMock.mockReturnValue('/')
    const { rerender } = render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('navigation')).toHaveClass('hidden')
    rerender(<Sidebar isOpen={true} />)
    expect(screen.getByRole('navigation')).toHaveClass('flex')
  })

  it('calls onNavClick when a nav link is clicked (closes the mobile overlay)', async () => {
    // Scenario: tapping a link on mobile must close the overlay via the callback.
    pathnameMock.mockReturnValue('/')
    const onNavClick = vi.fn()
    render(<Sidebar isOpen={true} onNavClick={onNavClick} />)
    await userEvent.click(screen.getByRole('link', { name: /workers/i }))
    expect(onNavClick).toHaveBeenCalledTimes(1)
  })
})
