/**
 * @fileoverview Sonner toast wrapper - the shared glass toast standard used
 * across the Bymax reference apps (matches nest-auth-example / nest-logger-example).
 *
 * The surface is a blurred glass card driven by the design tokens
 * (`--glass-card-bg`, `--glass-border`, `--foreground`, `--font-mono`); each
 * toast type carries a colored left accent so success/error/info/warning read
 * at a glance. The Toaster is placed once in the root layout; individual toasts
 * are triggered via `toast()` from the `sonner` package.
 *
 * @layer components/ui/sonner
 */

'use client'

import type { ComponentProps } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

export type ToasterProps = ComponentProps<typeof SonnerToaster>

/**
 * App-wide toast container styled for the dark design system.
 *
 * Place this once inside RootLayout, after the main content.
 *
 * @param props - Forwarded to the underlying Sonner `Toaster`. Override
 *   `position` or `theme` to change per-use defaults.
 */
function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--glass-card-bg)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'hsl(var(--foreground))',
          fontFamily: 'var(--font-mono)',
          borderRadius: '12px',
        },
        classNames: {
          success: 'border-l-4 border-l-green-500',
          error: 'border-l-4 border-l-red-500',
          info: 'border-l-4 border-l-blue-400',
          warning: 'border-l-4 border-l-amber-500',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
