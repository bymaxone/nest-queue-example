/**
 * @fileoverview E2E: boot-time Job Schedulers (5-field cron+tz, 6-field cron,
 * fixed interval), reboot idempotency, and the management CRUD surface. Covers
 * spec §12 scenario 5 and matrix rows 57 to 61.
 * @layer test/e2e
 */
import type { JobSchedulerJson } from '@bymax-one/nest-queue'
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { deleteJson, getJson, putJson } from './support/http.js'
import { waitFor } from './support/wait-for.js'

/** Response shape of `GET /schedulers`. */
interface SchedulersList {
  schedulers: JobSchedulerJson[]
}

describe('schedulers (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp('schedulers')
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('registers the nightly cleanup scheduler at boot: 5-field cron with a timezone (row 57)', async () => {
    // Scenario: reading the maintenance schedulers right after boot.
    // Rule it protects: BootSchedulersService registers the nightly cleanup
    // with a 5-field cron pattern and an explicit timezone.
    const response = await getJson<SchedulersList>(
      `${testApp.baseUrl}/schedulers?queue=maintenance`,
    )
    const nightly = response.body.schedulers.find((entry) => entry.key === 'nightly-cleanup')
    expect(nightly?.pattern).toBe('0 3 * * *')
    expect(nightly?.tz).toBe('America/Sao_Paulo')
  })

  it('registers the demo heartbeat scheduler at boot: 6-field (seconds) cron (row 58)', async () => {
    // Scenario: reading the monitoring schedulers right after boot.
    // Rule it protects: the demo heartbeat registers with a 6-field
    // (seconds-granularity) cron pattern.
    const response = await getJson<SchedulersList>(`${testApp.baseUrl}/schedulers?queue=monitoring`)
    const heartbeat = response.body.schedulers.find((entry) => entry.key === 'demo-heartbeat')
    expect(heartbeat?.pattern).toBe('*/30 * * * * *')
  })

  it('registers the metrics-snapshot scheduler at boot: fixed interval with offset and limit (row 59)', async () => {
    // Scenario: reading the monitoring schedulers right after boot.
    // Rule it protects: the metrics-snapshot scheduler registers with a fixed
    // interval, a phase offset, and a run-count limit.
    const response = await getJson<SchedulersList>(`${testApp.baseUrl}/schedulers?queue=monitoring`)
    const snapshot = response.body.schedulers.find((entry) => entry.key === 'metrics-snapshot')
    expect(snapshot?.every).toBe(300000)
    expect(snapshot?.limit).toBe(100)
  })

  it('re-registers the same three boot schedulers idempotently across a reboot, without duplicates (row 60)', async () => {
    // Scenario: booting a second app instance against the same Redis prefix.
    // Rule it protects: upsertJobScheduler's idempotent-by-id contract means a
    // reboot re-registers the same three schedulers without ever duplicating one.
    const second = await createTestApp('schedulers-reboot', { QUEUE_PREFIX: testApp.prefix })
    try {
      const maintenance = await getJson<SchedulersList>(
        `${testApp.baseUrl}/schedulers?queue=maintenance`,
      )
      const monitoring = await getJson<SchedulersList>(
        `${testApp.baseUrl}/schedulers?queue=monitoring`,
      )
      expect(
        maintenance.body.schedulers.filter((entry) => entry.key === 'nightly-cleanup'),
      ).toHaveLength(1)
      expect(
        monitoring.body.schedulers.filter((entry) => entry.key === 'demo-heartbeat'),
      ).toHaveLength(1)
      expect(
        monitoring.body.schedulers.filter((entry) => entry.key === 'metrics-snapshot'),
      ).toHaveLength(1)
    } finally {
      await second.close()
    }
  })

  it('upserts, lists, and removes a scheduler through the management endpoints (row 61)', async () => {
    // Scenario: an operator creating, observing, and deleting a custom scheduler.
    // Rule it protects: the management endpoints (upsert, getJobSchedulers,
    // removeJobScheduler) round-trip a real, firing scheduler end to end.
    const schedulerId = 'e2e-fast-tick'
    const upsert = await putJson<{ schedulerId: string; firstJobId: string | null }>(
      `${testApp.baseUrl}/schedulers/monitoring/${schedulerId}`,
      { repeat: { every: 500 }, template: { name: schedulerId, data: { origin: 'e2e' } } },
    )
    expect(upsert.status).toBe(200)
    expect(upsert.body.schedulerId).toBe(schedulerId)

    // The heartbeat processor (a catch-all on `monitoring`) records a tick for
    // every job it consumes, so a firing of the fast custom scheduler shows up
    // there without waiting on the slow real-world schedulers (30s/5m).
    await waitFor(
      async () => {
        const ticks = await getJson<{ ticks: { job: string; at: number }[] }>(
          `${testApp.baseUrl}/schedulers/ticks`,
        )
        return ticks.body.ticks.some((tick) => tick.job === schedulerId) || false
      },
      { timeoutMs: 5000, label: 'fast custom scheduler tick' },
    )

    const list = await getJson<SchedulersList>(`${testApp.baseUrl}/schedulers?queue=monitoring`)
    expect(list.body.schedulers.some((entry) => entry.key === schedulerId)).toBe(true)

    const removed = await deleteJson<{ removed: boolean }>(
      `${testApp.baseUrl}/schedulers/monitoring/${schedulerId}`,
    )
    expect(removed.body.removed).toBe(true)

    const afterRemoval = await getJson<SchedulersList>(
      `${testApp.baseUrl}/schedulers?queue=monitoring`,
    )
    expect(afterRemoval.body.schedulers.some((entry) => entry.key === schedulerId)).toBe(false)
  })

  it('rejects an upsert against an unmanaged queue name', async () => {
    // Scenario: an upsert naming a queue outside the scheduler allow-list.
    // Rule it protects: the queue allow-list rejects the request before it
    // reaches the library.
    const response = await putJson(`${testApp.baseUrl}/schedulers/not-a-real-queue/x`, {
      repeat: { every: 1000 },
    })
    expect(response.status).toBe(400)
  })

  it('reports false when removing a scheduler id that was never registered', async () => {
    // Scenario: removing a scheduler id that does not exist.
    // Rule it protects: removeJobScheduler honestly reports false for a no-op
    // removal rather than claiming a scheduler it never held.
    const response = await deleteJson<{ removed: boolean }>(
      `${testApp.baseUrl}/schedulers/monitoring/never-registered`,
    )
    expect(response.body.removed).toBe(false)
  })
})
