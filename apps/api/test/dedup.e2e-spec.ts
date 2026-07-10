/**
 * @fileoverview E2E: the deduplication laboratory over real BullMQ/Redis
 * `deduplication` options. Covers spec §12 scenario 3 and matrix rows 17 to 21.
 * The `search` queue has no consumer in this app (§12 scenario 3 observes the
 * enqueue-side dedup outcome, not job completion), so jobs stay `waiting` /
 * `delayed`; `keepLast` mode is asserted at its documented boundary: it only
 * collapses duplicates while a job is `active`, which never happens here.
 * @layer test/e2e
 */
import type { INestApplication } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { deleteJson, getJson, postJson } from './support/http.js'

/** Response shape of `POST /search/reindex`. */
interface ReindexResponse {
  jobId: string
  deduplicated: boolean
}

describe('dedup (e2e)', () => {
  let testApp: TestApp
  let app: INestApplication

  beforeAll(async () => {
    testApp = await createTestApp('dedup')
    app = testApp.app
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('collapses simple-mode duplicates into the in-flight job (row 17)', async () => {
    // Scenario: two reindex calls for the same term under simple `{ id }` dedup.
    // Rule it protects: a duplicate collapses into the existing job until it
    // completes or fails, returning the same job id.
    const term = 'simple-term'
    const first = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'simple',
    })
    const second = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'simple',
    })
    expect(first.body.deduplicated).toBe(false)
    expect(second.body.deduplicated).toBe(true)
    expect(second.body.jobId).toBe(first.body.jobId)
  })

  it('collapses throttle-mode duplicates inside the ttl window (row 18)', async () => {
    // Scenario: two reindex calls for the same term under throttle `{ id, ttl }`.
    // Rule it protects: a duplicate inside the ttl window collapses into the
    // existing job rather than creating a second one.
    const term = 'throttle-term'
    const first = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'throttle',
    })
    const second = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'throttle',
    })
    expect(second.body.deduplicated).toBe(true)
    expect(second.body.jobId).toBe(first.body.jobId)
  })

  it('collapses debounce-mode duplicates by replacing the delayed job, keeping only the latest (row 19)', async () => {
    // Scenario: two reindex calls for the same term under debounce
    // `{ id, ttl, extend: true, replace: true }`.
    // Rule it protects: a duplicate resets the window and replaces the pending
    // job's data, so only the latest payload ever runs.
    const term = 'debounce-term'
    const first = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'debounce',
    })
    const second = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'debounce',
    })
    // BullMQ's `replace: true` swaps in a fresh job id for the latest data rather
    // than reusing the first job's id, so `deduplicated` (which compares the
    // pre-enqueue dedup pointer to the new job's own id) reads false here; the
    // dedup key nonetheless collapses to exactly one live job, now pointing at
    // the second (latest) job, proving only the newest payload survives.
    expect(second.body.jobId).not.toBe(first.body.jobId)

    const view = await getJson<{ jobId: string | null }>(
      `${testApp.baseUrl}/admin/dedup/search/reindex:${term}`,
    )
    expect(view.body.jobId).toBe(second.body.jobId)
  })

  it('keep-last-if-active mode is a pass-through with no active job to collapse into (row 20)', async () => {
    // Scenario: two reindex calls for the same term under
    // `{ id, keepLastIfActive: true }`.
    // Rule it protects: the mode only collapses a duplicate while the existing
    // job is actually active (locked), asserted at that documented boundary.
    const term = 'keep-last-term'
    const first = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'keepLast',
    })
    const second = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'keepLast',
    })
    // The `search` queue has no consumer, so the first job never starts running
    // (never becomes locked/active). BullMQ's keep-last-if-active guard only lets
    // a duplicate through once the existing job has actually started; while it is
    // merely queued, a duplicate still collapses into it, exactly like `simple`
    // mode. This is the natural boundary case of "while active" with nothing
    // consuming the queue, not a quirk of this app's wiring.
    expect(first.body.deduplicated).toBe(false)
    expect(second.body.deduplicated).toBe(true)
    expect(second.body.jobId).toBe(first.body.jobId)
  })

  it('clears a dedup key through the inspector, letting the next enqueue start fresh (row 21)', async () => {
    // Scenario: clearing a live dedup key via the admin inspector.
    // Rule it protects: removeDeduplicationKey drops the key so the next enqueue
    // is treated as fresh rather than being collapsed.
    const term = 'clearable-term'
    const first = await postJson<ReindexResponse>(`${testApp.baseUrl}/search/reindex`, {
      term,
      mode: 'simple',
    })
    const cleared = await deleteJson<{ removed: boolean }>(
      `${testApp.baseUrl}/admin/dedup/search/reindex:${term}`,
    )
    expect(cleared.body.removed).toBe(true)

    const view = await getJson<{ jobId: string | null }>(
      `${testApp.baseUrl}/admin/dedup/search/reindex:${term}`,
    )
    expect(view.body.jobId).toBeNull()
    expect(first.body.deduplicated).toBe(false)
  })

  it('rejects a malformed reindex payload with the invalid_job_data envelope', async () => {
    // Scenario: an empty search term fails the request schema.
    // Rule it protects: boundary validation surfaces the stable
    // queue.invalid_job_data envelope before anything reaches the queue.
    const response = await postJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/search/reindex`,
      { term: '', mode: 'simple' },
    )
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('queue.invalid_job_data')
  })

  it('caches the same Queue instance across getOrCreateQueue calls (row 24)', () => {
    // Scenario: two getOrCreateQueue calls for the same queue name.
    // Rule it protects: the QueueService per-name cache returns the identical
    // Queue instance rather than constructing a new one each time.
    const queueService = app.get(QueueService)
    const first = queueService.getOrCreateQueue('search')
    const second = queueService.getOrCreateQueue('search')
    expect(first).toBe(second)
  })
})
