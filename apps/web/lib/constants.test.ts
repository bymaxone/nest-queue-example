/**
 * @fileoverview Unit tests for the browser-side constants module.
 * @layer lib/constants.test
 */
import { describe, it, expect } from 'vitest'
import { API_BASE_URL, METRICS_POLL_INTERVAL_MS, HEALTH_POLL_INTERVAL_MS } from './constants'

describe('constants', () => {
  it('falls back to the local API origin when NEXT_PUBLIC_API_URL is unset', () => {
    // Scenario: a dev checkout with no .env.local still boots against the
    // documented default API port (3080), never a hardcoded production URL.
    expect(API_BASE_URL).toBe('http://localhost:3080')
  })

  it('aligns the metrics poll interval with the API metrics cache TTL', () => {
    // Scenario: polling faster than the cache TTL would just re-read the same
    // cached snapshot; 3s matches the API's documented cache window.
    expect(METRICS_POLL_INTERVAL_MS).toBe(3_000)
  })

  it('exposes a positive health poll interval', () => {
    // Scenario: guards against an accidental 0/negative interval that would
    // hammer the health endpoint.
    expect(HEALTH_POLL_INTERVAL_MS).toBeGreaterThan(0)
  })
})
