/**
 * @fileoverview Root client provider boundary. Holds the two cross-cutting
 * providers the dashboard needs: TanStack Query (server-state cache and
 * polling) and the Sonner toast portal for action feedback.
 *
 * @layer app/providers
 */

'use client'

import { type ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'

/** Default query stale-time in milliseconds. */
const DEFAULT_STALE_TIME_MS = 2_000

interface ProvidersProps {
  /** Page or nested layout content rendered inside the provider tree. */
  children: ReactNode
}

/**
 * Root client provider - TanStack Query cache and the Sonner toast portal.
 *
 * @param props - Provider props.
 * @param props.children - The subtree to wrap.
 * @returns The provider tree enclosing `children` plus the toast portal.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: DEFAULT_STALE_TIME_MS, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme="dark" position="bottom-right" closeButton />
    </QueryClientProvider>
  )
}
