/**
 * @fileoverview Unit tests for the runtime constants mirrored alongside the
 * API DTO type shapes (the interfaces themselves are compile-time only and
 * need no test).
 * @layer lib/api-types.test
 */
import { describe, it, expect } from 'vitest'
import { CLEAN_STATUSES, DEDUP_MODES, KNOWN_QUEUES, SCHEDULER_QUEUES } from './api-types'

describe('CLEAN_STATUSES', () => {
  it('mirrors the six statuses BullMQ clean accepts', () => {
    // Scenario: the clean-status select in the queue detail page must offer
    // exactly the statuses the API's clean action accepts.
    expect(CLEAN_STATUSES).toEqual(['completed', 'failed', 'delayed', 'wait', 'active', 'paused'])
  })
})

describe('DEDUP_MODES', () => {
  it('mirrors the four BullMQ-native deduplication strategies', () => {
    // Scenario: the DedupModePicker must offer exactly the modes the reindex
    // lab accepts.
    expect(DEDUP_MODES).toEqual(['simple', 'throttle', 'debounce', 'keepLast'])
  })
})

describe('KNOWN_QUEUES', () => {
  it('mirrors every boot-registered queue the admin surface manages', () => {
    // Scenario: the playground and queue pickers must offer exactly the
    // queues the API allow-lists (dynamic tenant queues stay excluded).
    expect(KNOWN_QUEUES).toEqual([
      'email',
      'search',
      'audit',
      'webhooks',
      'reports',
      'demos',
      'maintenance',
      'monitoring',
      'fulfillment',
      'stock',
      'payments',
      'invoices-data',
      'invoices',
    ])
  })
})

describe('SCHEDULER_QUEUES', () => {
  it('mirrors the two queues the scheduler surface manages', () => {
    // Scenario: the schedulers page must offer only the queues that actually
    // carry boot schedulers.
    expect(SCHEDULER_QUEUES).toEqual(['maintenance', 'monitoring'])
  })
})
