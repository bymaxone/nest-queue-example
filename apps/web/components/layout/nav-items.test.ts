/**
 * @fileoverview Unit tests for the sidebar navigation table.
 * @layer components/layout/nav-items.test
 */
import { describe, it, expect } from 'vitest'
import { NAV_ITEMS } from './nav-items'

describe('NAV_ITEMS', () => {
  it('lists exactly the nine documented dashboard routes', () => {
    // Scenario: spec §13.2 names nine sidebar entries; the rail must carry all
    // nine, no more, no less, so every feature stays reachable from the nav.
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/',
      '/queues',
      '/flows',
      '/schedulers',
      '/workers',
      '/playground',
      '/events',
      '/errors',
      '/health',
    ])
  })

  it('gives every item a non-empty label and an icon component', () => {
    // Scenario: guards against a partially-filled entry slipping through
    // (e.g. an icon import typo resolving to undefined).
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeDefined()
    }
  })
})
