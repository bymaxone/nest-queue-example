/**
 * @fileoverview 250px glass nav rail - the nine dashboard routes with an
 * orange active item. Desktop: sticky below the topbar. Mobile: a fixed
 * overlay toggled by the topbar hamburger.
 *
 * @layer components/layout/Sidebar
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav-items'

const NAV_ITEM_BASE =
  'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-all duration-150'
const NAV_ITEM_ACTIVE = 'border-l-brand-500 bg-brand-500/10 font-semibold text-brand-500'
const NAV_ITEM_INACTIVE = 'border-l-transparent text-white/55 hover:bg-white/5'
const ICON_BASE = 'h-4 w-4 shrink-0'
const ICON_ACTIVE = 'text-brand-500'
const ICON_INACTIVE = 'text-white/40'
const NAV_CLASSES = [
  'w-[250px] shrink-0 flex-col border-r border-white/8 bg-(--color-sidebar-bg)',
  'fixed left-0 top-16 z-100 h-[calc(100vh-64px)] overflow-y-auto',
  'lg:sticky lg:top-16 lg:h-[calc(100vh-64px)]',
] as const

/**
 * Returns whether a nav item is the active route for the given pathname.
 *
 * The root route (`/`) matches only exactly; every other route also matches its
 * nested children (e.g. `/queues` stays active on `/queues/email`).
 */
function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface SidebarProps {
  /** Controls mobile overlay visibility. */
  isOpen: boolean
  /** Closes the mobile overlay after a navigation. */
  onNavClick?: () => void
}

/** 250px glass nav rail - the nine dashboard routes, orange active item. */
export function Sidebar({ isOpen, onNavClick }: SidebarProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main navigation"
      className={cn(...NAV_CLASSES, isOpen ? 'flex' : 'hidden lg:flex')}
    >
      <div className="flex h-full flex-col px-4 py-6">
        <div className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isActiveRoute(item.href, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(onNavClick ? { onClick: onNavClick } : {})}
                aria-current={isActive ? 'page' : undefined}
                className={cn(NAV_ITEM_BASE, isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE)}
              >
                <Icon className={cn(ICON_BASE, isActive ? ICON_ACTIVE : ICON_INACTIVE)} />
                {item.label}
              </Link>
            )
          })}
        </div>
        <div className="mt-6 border-t border-white/8 pt-4">
          <span className="inline-flex items-center rounded-md border border-white/10 bg-white/4 px-2 py-1 font-mono text-xs text-white/55">
            queue-example
          </span>
        </div>
      </div>
    </nav>
  )
}
