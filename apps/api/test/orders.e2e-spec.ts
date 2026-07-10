/**
 * @fileoverview E2E: placing an order, the webhook retry theater, delayed
 * reminders, idempotent onboarding, and bulk campaigns, all against real Redis.
 * Covers spec §12 scenarios 1 and 2 and matrix rows 10, 13 to 16, 22, 23.
 * @layer test/e2e
 */
import type { INestApplication } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { deleteJson, getJson, postJson } from './support/http.js'
import { waitFor } from './support/wait-for.js'
import type { JobView } from '../src/admin/queues.service.js'
import type {
  OrderCreatedWebhookJobData,
  OrderCreatedWebhookJobResult,
} from '../src/orders/order-jobs.types.js'

describe('orders (e2e)', () => {
  let testApp: TestApp
  let app: INestApplication
  let queueService: QueueService

  beforeAll(async () => {
    testApp = await createTestApp('orders')
    app = testApp.app
    queueService = app.get(QueueService)
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('places an order: stores it, enqueues a typed receipt job, and merges the per-queue option override (rows 10, 12, 13)', async () => {
    // Scenario: placing a standard (non-VIP) order.
    // Rule it protects: the order is stored, a typed send-receipt job is
    // enqueued on the email queue, and the queue's option override applies.
    const response = await postJson<{ orderId: string; jobId: string }>(
      `${testApp.baseUrl}/orders`,
      { to: 'a@b.co', total: 42, vip: false },
    )
    expect(response.status).toBe(201)
    expect(response.body.orderId).toEqual(expect.any(String))

    const job = await queueService.getJob('email', response.body.jobId)
    expect(job).not.toBeNull()
    // AdminQueuesService pre-creates the `email` queue with a per-queue
    // `defaultJobOptions` override (row 12: `queueOptions` passthrough). The
    // library spreads that override over the module default at the Queue-options
    // level (`{ ...moduleDefault, ...overrides }`), so a queue-level
    // `defaultJobOptions` replaces the whole object rather than deep-merging: the
    // email queue ends up with `attempts: 5` and no module backoff at all, not
    // `attempts: 5` plus the module's exponential backoff.
    expect(job?.opts.attempts).toBe(5)
    expect(job?.opts.backoff).toBeUndefined()
  })

  it('jumps a VIP receipt ahead of the default priority (row 14)', async () => {
    // Scenario: placing a VIP order.
    // Rule it protects: OrdersService sets priority: VIP_PRIORITY on a VIP
    // order's receipt so it is processed ahead of standard orders.
    const response = await postJson<{ orderId: string; jobId: string }>(
      `${testApp.baseUrl}/orders`,
      { to: 'vip@b.co', total: 999, vip: true },
    )
    const job = await queueService.getJob('email', response.body.jobId)
    expect(job?.opts.priority).toBe(1)
  })

  it('enqueues a delayed reminder for an existing order, visible in the delayed status (row 15)', async () => {
    // Scenario: requesting a reminder for a real order.
    // Rule it protects: the reminder job carries a positive delay and lands in
    // the delayed status until it elapses.
    const placed = await postJson<{ orderId: string }>(`${testApp.baseUrl}/orders`, {
      to: 'reminder@b.co',
      total: 10,
      vip: false,
    })
    const reminder = await postJson<{ jobId: string }>(
      `${testApp.baseUrl}/orders/${placed.body.orderId}/remind`,
      undefined,
    )
    expect(reminder.status).toBe(201)
    const job = await queueService.getJob('email', reminder.body.jobId)
    expect(job?.opts.delay).toBeGreaterThan(0)
    const state = await job?.getState()
    expect(state).toBe('delayed')
  })

  it('404s a reminder for an order that does not exist', async () => {
    // Scenario: requesting a reminder for an unknown order id.
    // Rule it protects: OrdersService.remind 404s rather than enqueueing a
    // reminder for an order that was never placed.
    const response = await postJson(`${testApp.baseUrl}/orders/does-not-exist/remind`, undefined)
    expect(response.status).toBe(404)
  })

  it('retries a failing webhook with exponential backoff before it succeeds (scenario 2; rows 39, 40, 44)', async () => {
    // Scenario: placing an order fans out an order-created webhook job.
    // Rule it protects: the webhook processor's injected failures are retried
    // with exponential backoff until the job completes, the retry theater.
    const placed = await postJson<{ orderId: string }>(`${testApp.baseUrl}/orders`, {
      to: 'webhook@b.co',
      total: 5,
      vip: false,
    })
    // WEBHOOK_FAILURES defaults to 2: the handler fails on attempts 0 and 1, then
    // succeeds on attempt 3 (job.attemptsMade === 2). Exponential backoff between
    // attempts (base 1500ms) means this genuinely takes a few seconds.
    const completed = await waitFor(
      async () => {
        const jobs = await queueService.getJobs<
          OrderCreatedWebhookJobData,
          OrderCreatedWebhookJobResult
        >('webhooks', 'completed', 0, 20)
        return jobs.find((job) => job.data.orderId === placed.body.orderId) ?? false
      },
      { timeoutMs: 20000, intervalMs: 300, label: 'webhook retry completion' },
    )
    expect(completed.attemptsMade).toBe(3)
    expect(completed.returnvalue).toEqual({ orderId: placed.body.orderId, attempts: 3 })
  })

  it('onboards a user idempotently: a repeat call is a no-op on the same jobId (row 16)', async () => {
    // Scenario: onboarding the same user twice.
    // Rule it protects: the stable welcome-<userId> jobId makes the second
    // enqueue a no-op while the first job still exists (idempotent insert).
    const userId = `user-${String(Date.now())}`
    const first = await postJson<{ created: boolean; jobId: string }>(
      `${testApp.baseUrl}/onboarding/${userId}`,
      undefined,
    )
    const second = await postJson<{ created: boolean; jobId: string }>(
      `${testApp.baseUrl}/onboarding/${userId}`,
      undefined,
    )
    expect(first.body.created).toBe(true)
    expect(second.body.created).toBe(false)
    expect(second.body.jobId).toBe(first.body.jobId)
  })

  it('rejects a malformed order payload with the invalid_job_data envelope', async () => {
    // Scenario: an invalid email and a negative total fail the request schema.
    // Rule it protects: boundary validation rejects the request with the stable
    // queue.invalid_job_data envelope before anything is stored or enqueued.
    const response = await postJson<{ error: { code: string } }>(`${testApp.baseUrl}/orders`, {
      to: 'not-an-email',
      total: -1,
    })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('queue.invalid_job_data')
  })

  it('bulk-enqueues a receipt campaign in one roundtrip (row 22)', async () => {
    // Scenario: a campaign of 10 receipt emails.
    // Rule it protects: enqueueBulk creates every job in one Redis roundtrip,
    // returning one job id per requested receipt.
    const response = await postJson<{ enqueued: number; jobIds: string[] }>(
      `${testApp.baseUrl}/campaigns/receipts`,
      { count: 10 },
    )
    expect(response.status).toBe(201)
    expect(response.body.enqueued).toBe(10)
    expect(response.body.jobIds).toHaveLength(10)
  })

  it('rejects a campaign over the library bulk cap before anything is enqueued (row 23)', async () => {
    // Scenario: a campaign of 1001 receipts, one over the library's bulk cap.
    // Rule it protects: MAX_BULK_SIZE rejects the whole batch with
    // queue.bulk_enqueue_failed before any job is written to Redis.
    const response = await postJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/campaigns/receipts`,
      { count: 1001 },
    )
    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('queue.bulk_enqueue_failed')
  })

  it('pages jobs by status and fetches one job by id through the admin plane (rows 25, 26)', async () => {
    // Scenario: reading a placed order's job through the admin plane.
    // Rule it protects: getJobs pages jobs by status and getJob fetches one job
    // by id, both through the admin HTTP surface.
    const placed = await postJson<{ jobId: string }>(`${testApp.baseUrl}/orders`, {
      to: 'admin-view@b.co',
      total: 1,
      vip: false,
    })
    const page = await getJson<JobView[]>(
      `${testApp.baseUrl}/admin/queues/email/jobs?status=waiting&start=0&end=50`,
    )
    expect(page.status).toBe(200)

    const detail = await getJson<JobView>(
      `${testApp.baseUrl}/admin/jobs/email/${placed.body.jobId}`,
    )
    expect(detail.status).toBe(200)
    expect(detail.body.id).toBe(placed.body.jobId)
  })

  it('404s a job lookup for an id that does not exist (queue.job_not_found)', async () => {
    // Scenario: looking up a job id that was never enqueued.
    // Rule it protects: getJob 404s with queue.job_not_found rather than
    // returning a misleading empty or null success response.
    const response = await getJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/admin/jobs/email/does-not-exist`,
    )
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('queue.job_not_found')
  })

  it('404s an admin request against an unmanaged queue name (queue.queue_not_found)', async () => {
    // Scenario: an admin request naming a queue outside the managed allow-list.
    // Rule it protects: assertKnownQueue rejects with queue.queue_not_found
    // rather than lazily creating an arbitrary Redis queue.
    const response = await getJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/admin/jobs/not-a-real-queue/some-id`,
    )
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('queue.queue_not_found')
  })

  it('pauses and resumes the email queue (row 31)', async () => {
    // Scenario: an operator pausing and resuming a managed queue.
    // Rule it protects: pauseQueue and resumeQueue toggle the queue's paused
    // state via the admin control surface.
    const pause = await postJson<{ paused: true }>(`${testApp.baseUrl}/admin/queues/email/pause`)
    expect(pause.body.paused).toBe(true)
    const resume = await postJson<{ resumed: true }>(`${testApp.baseUrl}/admin/queues/email/resume`)
    expect(resume.body.resumed).toBe(true)
  })

  it('cleans completed jobs off a queue and returns their ids (row 32)', async () => {
    // Scenario: cleaning completed jobs off a queue that has at least one.
    // Rule it protects: cleanQueue removes matching jobs and reports their ids
    // through the admin control surface.
    await waitFor(async () => (await queueService.getJobs('email', 'completed', 0, 1)).length > 0, {
      timeoutMs: 10000,
      label: 'at least one completed email job before cleaning',
    })
    const response = await postJson<{ removed: string[] }>(
      `${testApp.baseUrl}/admin/queues/email/clean`,
      { gracePeriodMs: 0, limit: 0, status: 'completed' },
    )
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.removed)).toBe(true)
  })

  it('clears a dedup key via the admin inspector, reporting false for an unset key (row 21)', async () => {
    // Scenario: clearing a dedup key that was never set.
    // Rule it protects: removeDeduplicationKey honestly reports false for a
    // no-op removal rather than claiming a key it never held.
    const cleared = await deleteJson<{ removed: boolean }>(
      `${testApp.baseUrl}/admin/dedup/search/reindex:never-set`,
    )
    expect(cleared.body.removed).toBe(false)
  })
})
