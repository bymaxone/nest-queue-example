/**
 * @fileoverview App chrome - fixed topbar + sticky sidebar + the page content
 * well. Owns the mobile sidebar open/close state and the live Redis status
 * chip (polled once here so every page shares one probe).
 *
 * @layer components/layout/AppShell
 */

'use client'

import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { useRedisStatus } from '@/hooks/use-redis-status'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  /** Page content rendered inside the centered content well. */
  children: ReactNode
  /** Widen the content well to `max-w-7xl` on wide pages. */
  wide?: boolean
}

/** App chrome - fixed topbar + sticky sidebar + the page content well. */
export function AppShell({ children, wide = false }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const redisStatus = useRedisStatus()
  return (
    <>
      <Topbar
        onMenuOpen={() => {
          setIsOpen(true)
        }}
        redisStatus={redisStatus}
      />
      <div className="flex pt-16">
        <Sidebar
          isOpen={isOpen}
          onNavClick={() => {
            setIsOpen(false)
          }}
        />
        {isOpen ? (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => {
              setIsOpen(false)
            }}
            className="fixed bottom-0 left-0 right-0 top-16 z-90 bg-black/50 lg:hidden"
          />
        ) : null}
        <main className="min-w-0 flex-1 px-6 py-8">
          <div className={cn('mx-auto', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div>
        </main>
      </div>
    </>
  )
}
