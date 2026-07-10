/**
 * @fileoverview E2E: the Server-Sent Events feed bridging worker-local and global
 * queue events. Covers matrix rows 44, 45 (the `@OnWorkerEvent` / `@OnQueueEvent`
 * contrast) over a real SSE connection (no mocked `EventSource`).
 * @layer test/e2e
 */
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { getJson, postJson } from './support/http.js'
import { collectSseEvents } from './support/sse.js'
import { waitFor } from './support/wait-for.js'

/** A recorded feed entry, mirroring `FeedEntry`. */
interface FeedEntry {
  source: 'worker' | 'global'
  queue: string
  event: string
  jobId: string | undefined
  data?: unknown
  returnvalue?: unknown
  resolvedData?: unknown
}

describe('events (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp('events')
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('bridges worker-local completed events (with the full redacted Job payload) onto the feed (row 44)', async () => {
    // Scenario: a receipt email job completes on the email worker.
    // Rule it protects: the worker-local @OnWorkerEvent('completed') listener
    // bridges the full redacted Job payload onto the feed.
    await postJson(`${testApp.baseUrl}/orders`, { to: 'events@b.co', total: 3, vip: false })
    const entry = await waitFor(
      async () => {
        const recent = await getJson<FeedEntry[]>(`${testApp.baseUrl}/events/recent`)
        return (
          recent.body.find(
            (candidate) =>
              candidate.source === 'worker' &&
              candidate.queue === 'email' &&
              candidate.event === 'completed',
          ) ?? false
        )
      },
      { timeoutMs: 5000, label: 'worker-local completed feed entry' },
    )
    expect(entry.data).toBeDefined()
  })

  it('bridges global completed events (serialized, resolved via the getJob fallback) onto the feed (row 45)', async () => {
    // Scenario: the order-created webhook job completes after its retries.
    // Rule it protects: the global @OnQueueEvent('completed') listener bridges
    // the serialized payload plus a resolved-via-getJob payload onto the feed.
    await postJson(`${testApp.baseUrl}/orders`, { to: 'global-events@b.co', total: 3, vip: false })
    // The webhook retry theater takes a few seconds (two injected failures with
    // exponential backoff before success), so this waits for the eventual global
    // `completed` entry rather than the near-instant `active` one.
    const entry = await waitFor(
      async () => {
        const recent = await getJson<FeedEntry[]>(`${testApp.baseUrl}/events/recent`)
        return (
          recent.body.find(
            (candidate) =>
              candidate.source === 'global' &&
              candidate.queue === 'webhooks' &&
              candidate.event === 'completed',
          ) ?? false
        )
      },
      { timeoutMs: 20000, label: 'global completed feed entry' },
    )
    expect(entry.jobId).toEqual(expect.any(String))
    expect(entry.resolvedData).toBeDefined()
  })

  it('streams replayed and live entries over a real SSE connection', async () => {
    // Scenario: subscribing to GET /events/stream with existing history.
    // Rule it protects: a new subscriber replays recent entries then receives
    // live pushes over a real SSE connection, not a mocked EventSource.
    // Seed at least one entry before subscribing so the replay window (last 20)
    // is guaranteed non-empty, then trigger one more so a live push follows.
    await postJson(`${testApp.baseUrl}/orders`, { to: 'sse-seed@b.co', total: 1, vip: false })
    const streamPromise = collectSseEvents(`${testApp.baseUrl}/events/stream`, 2, 10000)
    await postJson(`${testApp.baseUrl}/orders`, { to: 'sse-live@b.co', total: 1, vip: false })
    const events = await streamPromise
    expect(events).toHaveLength(2)
    for (const event of events) {
      expect(event.source === 'worker' || event.source === 'global').toBe(true)
    }
  })
})
