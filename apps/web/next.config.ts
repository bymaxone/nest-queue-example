/**
 * @fileoverview Next.js 16 configuration. The local @bymax-one/nest-queue
 * file: dependency needs no transpile config (the shared subpath is pure
 * TypeScript/JS). Emits baseline HTTP security headers on every route,
 * including a Content-Security-Policy whose connect-src is derived from the
 * configured API origin so the browser only talks to the intended backend.
 * @layer next.config
 */
import type { NextConfig } from 'next'

/** API origin the browser is allowed to call; falls back to the dev endpoint. */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3080'

// React's development mode reconstructs call stacks via eval(); it never
// calls eval() in production, so 'unsafe-eval' is scoped to dev only and the
// production CSP stays strict.
const SCRIPT_SRC =
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'"

/** Content-Security-Policy directives, one per line, joined at build time. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `connect-src 'self' ${API_ORIGIN}`,
  // Next.js injects inline bootstrap scripts and styles; 'unsafe-inline' is
  // required until a nonce pipeline is wired. Acceptable for this reference app.
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Baseline security headers applied to every response. */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
]

const nextConfig: NextConfig = {
  /**
   * Applies the baseline security headers to all routes.
   *
   * @returns The header rule set consumed by Next.js.
   */
  headers() {
    return Promise.resolve([{ source: '/(.*)', headers: SECURITY_HEADERS }])
  },
}

export default nextConfig
