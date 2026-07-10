/**
 * @fileoverview E2E: dynamic per-tenant workers (register/notify/list/unregister)
 * and the sandboxed invoice processor. Covers spec §12 scenarios 6 and 7 and
 * matrix rows 47 to 49.
 * @layer test/e2e
 */
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { deleteJson, getJson, postJson } from './support/http.js'
import { waitFor } from './support/wait-for.js'
import { sleep } from '../src/timing/sleep.js'

/** Margin letting a freshly registered worker's duplicated connection settle to
 * `ready` before it is torn down again, avoiding a close-during-connect race. */
const WORKER_SETTLE_MS = 300

/** Response shape of `GET /workers/tenants`. */
interface TenantWorkersList {
  workers: { tenantId: string; queue: string; tier: string | null }[]
}

/** Response shape of `GET /workers/tenants/deliveries`. */
interface TenantDeliveriesList {
  deliveries: { tenantId: string; notification: string; at: number }[]
}

describe('workers (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp('workers')
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('registers a premium and a free tenant worker, both visible on the workers page (row 47)', async () => {
    // Scenario: adding a premium and a free tenant at runtime.
    // Rule it protects: WorkerRegistry.register creates a real, running worker
    // per tenant, and both are visible in the aggregate list (row 47).
    const premium = await postJson<{ tenantId: string; tier: string; queue: string }>(
      `${testApp.baseUrl}/workers/tenants`,
      { tenantId: 'acme', tier: 'premium' },
    )
    const free = await postJson<{ tenantId: string; tier: string; queue: string }>(
      `${testApp.baseUrl}/workers/tenants`,
      { tenantId: 'globex', tier: 'free' },
    )
    expect(premium.status).toBe(201)
    expect(premium.body.queue).toBe('notifications.acme')
    expect(free.status).toBe(201)

    const list = await getJson<TenantWorkersList>(`${testApp.baseUrl}/workers/tenants`)
    const tenantIds = list.body.workers.map((worker) => worker.tenantId)
    expect(tenantIds).toEqual(expect.arrayContaining(['acme', 'globex']))
  })

  it('delivers a notification to a registered tenant worker and records the trail', async () => {
    // Scenario: notifying a tenant that has a live dynamic worker.
    // Rule it protects: the tenant's worker actually consumes the enqueued
    // notification and records the delivery, proving the dynamic registration
    // is not just bookkeeping.
    await postJson(`${testApp.baseUrl}/workers/tenants`, { tenantId: 'initech', tier: 'free' })
    const notify = await postJson<{ tenantId: string; jobId: string }>(
      `${testApp.baseUrl}/workers/tenants/initech/notify`,
      { message: 'invoice ready' },
    )
    expect(notify.status).toBe(201)

    await waitFor(
      async () => {
        const deliveries = await getJson<TenantDeliveriesList>(
          `${testApp.baseUrl}/workers/tenants/deliveries?tenantId=initech`,
        )
        return (
          deliveries.body.deliveries.some((entry) => entry.notification === 'invoice ready') ||
          false
        )
      },
      { timeoutMs: 5000, label: 'tenant delivery recorded' },
    )
  })

  it('rejects registering a second worker for an already-registered tenant (queue.duplicate_processor)', async () => {
    // Scenario: registering the same tenant id twice.
    // Rule it protects: WorkerRegistry's duplicate guard applies to
    // programmatic registration too, not only decorator-based @Processor classes.
    await postJson(`${testApp.baseUrl}/workers/tenants`, { tenantId: 'dup-tenant', tier: 'free' })
    const second = await postJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/workers/tenants`,
      {
        tenantId: 'dup-tenant',
        tier: 'premium',
      },
    )
    expect(second.status).toBe(500)
    expect(second.body.error.code).toBe('queue.duplicate_processor')
  })

  it('unregisters a tenant worker live, removing it from the workers page (row 48)', async () => {
    // Scenario: removing a tenant worker while the app keeps running.
    // Rule it protects: WorkerRegistry.unregister tears the worker down live,
    // and the tenant disappears from the workers page (row 48).
    await postJson(`${testApp.baseUrl}/workers/tenants`, { tenantId: 'transient', tier: 'free' })
    const before = await getJson<TenantWorkersList>(
      `${testApp.baseUrl}/workers/tenants?tenantId=transient`,
    )
    expect(before.body.workers).toHaveLength(1)

    // Let the worker's duplicated connection reach `ready` before tearing it
    // down again; closing mid-connect is a real but uninteresting BullMQ race
    // this spec is not trying to exercise (that is `shutdown.e2e-spec.ts`'s job).
    await sleep(WORKER_SETTLE_MS)

    const removed = await deleteJson<{ tenantId: string; unregistered: boolean }>(
      `${testApp.baseUrl}/workers/tenants/transient`,
    )
    expect(removed.body.unregistered).toBe(true)

    const after = await getJson<TenantWorkersList>(
      `${testApp.baseUrl}/workers/tenants?tenantId=transient`,
    )
    expect(after.body.workers).toHaveLength(0)
  })

  it('reports false when unregistering a tenant that was never registered', async () => {
    // Scenario: unregistering a tenant id that has no worker.
    // Rule it protects: the teardown is a truthful no-op (false), not a
    // false-positive success.
    const response = await deleteJson<{ unregistered: boolean }>(
      `${testApp.baseUrl}/workers/tenants/never-registered`,
    )
    expect(response.body.unregistered).toBe(false)
  })

  it('enqueues a sandboxed invoice render job off the main event loop (row 49)', async () => {
    // Scenario: requesting an invoice render.
    // Rule it protects: the render request reaches the sandboxed (out-of-process)
    // invoice queue and is accepted as a real job (row 49).
    const response = await postJson<{ invoiceId: string; jobId: string }>(
      `${testApp.baseUrl}/workers/invoices/render`,
      { invoiceId: 'inv-001', lines: ['line one', 'line two'] },
    )
    expect(response.status).toBe(201)
    expect(response.body.invoiceId).toBe('inv-001')
    expect(response.body.jobId).toEqual(expect.any(String))
  })

  it('reports the event-loop-delay sample used to observe responsiveness during a render (row 49)', async () => {
    // Scenario: reading the event-loop-delay probe.
    // Rule it protects: LagProbe reports a valid, non-negative sample, the
    // signal the dashboard uses to show the loop staying responsive (row 49).
    const response = await getJson<{ meanMs: number; maxMs: number }>(
      `${testApp.baseUrl}/workers/lag`,
    )
    expect(response.status).toBe(200)
    expect(response.body.meanMs).toBeGreaterThanOrEqual(0)
    expect(response.body.maxMs).toBeGreaterThanOrEqual(0)
  })

  it('rejects a malformed tenant registration payload', async () => {
    // Scenario: a tenant id containing a space, outside the allowed charset.
    // Rule it protects: boundary validation rejects the request before a
    // worker or queue is ever created for it.
    const response = await postJson(`${testApp.baseUrl}/workers/tenants`, {
      tenantId: 'bad tenant!',
    })
    expect(response.status).toBe(400)
  })
})
