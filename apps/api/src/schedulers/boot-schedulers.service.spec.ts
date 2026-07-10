/**
 * Unit tests for BootSchedulersService.
 *
 * Layer: unit.
 * Goal: bootstrap registers exactly the three schedulers with their documented
 * schedules and templates, and a reboot re-registers the same ids (idempotent),
 * never generating a per-boot duplicate.
 * Mocks: QueueService.upsertJobScheduler (spy).
 */
import { jest } from '@jest/globals'
import type { QueueService } from '@bymax-one/nest-queue'
import { BootSchedulersService } from './boot-schedulers.service.js'

/** Build the service over a spied upsertJobScheduler that records every call. */
function build(): { service: BootSchedulersService; upsert: jest.Mock } {
  const upsert = jest.fn<QueueService['upsertJobScheduler']>().mockResolvedValue(undefined)
  const service = new BootSchedulersService({
    upsertJobScheduler: upsert,
  } as unknown as QueueService)
  return { service, upsert: upsert as unknown as jest.Mock }
}

describe('BootSchedulersService (unit)', () => {
  it('registers the three schedulers with their documented schedules on bootstrap', async () => {
    /*
     * Scenario: application bootstrap.
     * Rule it protects: the nightly cron (5-field + tz), the heartbeat cron
     * (6-field seconds), and the metrics interval (every + offset + limit) are
     * each upserted with their template (rows 57 to 59).
     */
    const { service, upsert } = build()

    await service.onApplicationBootstrap()

    expect(upsert).toHaveBeenCalledWith(
      'maintenance',
      'nightly-cleanup',
      { pattern: '0 3 * * *', tz: 'America/Sao_Paulo' },
      { name: 'cleanup', data: { mode: 'soft' } },
    )
    expect(upsert).toHaveBeenCalledWith(
      'monitoring',
      'demo-heartbeat',
      { pattern: '*/30 * * * * *' },
      { name: 'heartbeat', data: { service: 'api' } },
    )
    expect(upsert).toHaveBeenCalledWith(
      'monitoring',
      'metrics-snapshot',
      { every: 300_000, offset: 15_000, limit: 100 },
      { name: 'metrics-snapshot', data: { scope: 'all' } },
    )
    expect(upsert).toHaveBeenCalledTimes(3)
  })

  it('re-registers the same three scheduler ids on a reboot without new ids', async () => {
    /*
     * Regression for duplicate schedulers.
     * Rule it protects: upsertJobScheduler is idempotent by id, so a second boot
     * targets the identical (queue, id) pairs and never mints a per-boot id
     * (row 60).
     */
    const { service, upsert } = build()

    await service.onApplicationBootstrap()
    await service.onApplicationBootstrap()

    const pairs = upsert.mock.calls.map((call) => `${String(call[0])}/${String(call[1])}`)
    expect(pairs).toEqual([
      'maintenance/nightly-cleanup',
      'monitoring/demo-heartbeat',
      'monitoring/metrics-snapshot',
      'maintenance/nightly-cleanup',
      'monitoring/demo-heartbeat',
      'monitoring/metrics-snapshot',
    ])
  })
})
