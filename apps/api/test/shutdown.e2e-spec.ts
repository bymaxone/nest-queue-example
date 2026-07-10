/**
 * @fileoverview E2E: the graceful-shutdown protocol: a normal drain that lets an
 * in-flight job finish, and the overrun path that force-closes a worker past its
 * `drainTimeoutMs` budget. Covers spec §12 scenario 8 and matrix rows 63, 64.
 * Each spec wires a small dedicated module directly against the library (an
 * isolated Redis prefix) rather than the full `AppModule`, so the shutdown
 * timing under test is never entangled with the app's other processors.
 * @layer test/e2e
 */
import { randomUUID } from 'node:crypto'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { jest } from '@jest/globals'
import { Queue } from 'bullmq'
import { BymaxQueueModule, Process, Processor, QueueService } from '@bymax-one/nest-queue'
import { e2eRedisUrl } from './support/test-app.js'
import { sleep } from '../src/timing/sleep.js'
import { waitFor } from './support/wait-for.js'

/** How long the slow handler sleeps before resolving. */
const HANDLER_SLEEP_MS = 1500

/** A worker whose handler sleeps long enough to still be active at shutdown time. */
@Processor('shutdown-drain-queue')
class SlowProcessor {
  @Process()
  async handle(): Promise<{ done: true }> {
    await sleep(HANDLER_SLEEP_MS)
    return { done: true }
  }
}

/**
 * Build an isolated module + app around the library, wire a slow worker, and
 * enqueue one job on it, waiting until the job is actually being processed.
 *
 * @param drainTimeoutMs - The shutdown drain budget to configure.
 */
async function bootWithActiveJob(drainTimeoutMs: number) {
  const prefix = `e2e-shutdown-${randomUUID().slice(0, 8)}`
  const moduleRef = await Test.createTestingModule({
    imports: [
      BymaxQueueModule.forRoot({
        connection: { url: e2eRedisUrl() },
        prefix,
        shutdown: { drainTimeoutMs },
      }),
    ],
    providers: [SlowProcessor],
  }).compile()
  const app = moduleRef.createNestApplication()
  app.enableShutdownHooks()
  await app.init()

  const queueService = app.get(QueueService)
  const job = await queueService.enqueue('shutdown-drain-queue', 'work', {})
  await waitFor(async () => (await job.getState()) === 'active' || false, {
    timeoutMs: 5000,
    label: 'job became active before shutdown',
  })

  const verifyQueue = new Queue('shutdown-drain-queue', {
    connection: { url: e2eRedisUrl() },
    prefix,
  })
  return { app, job, verifyQueue }
}

describe('shutdown (e2e)', () => {
  it('drains an in-flight job to completion within a generous budget (row 63)', async () => {
    // Scenario: SIGTERM-equivalent shutdown (app.close()) with a slow job
    // active and a drain budget comfortably larger than its runtime.
    // Rule it protects: the graceful shutdown protocol waits for the in-flight
    // job to finish before closing, so it completes rather than being stalled.
    const { app, job, verifyQueue } = await bootWithActiveJob(10000)
    try {
      await app.close()
      const finished = await verifyQueue.getJob(job.id ?? '')
      const state = await finished?.getState()
      expect(state).toBe('completed')
    } finally {
      await verifyQueue.close()
    }
  }, 15000)

  it('force-closes a worker that exceeds a tight drainTimeoutMs and logs shutdown_timeout_exceeded (row 64)', async () => {
    // Scenario: shutdown with a slow job active and a drainTimeoutMs far
    // shorter than its runtime.
    // Rule it protects: the drain budget is enforced: the worker is
    // force-closed and the overrun is logged with queue.shutdown_timeout_exceeded.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { app, verifyQueue } = await bootWithActiveJob(50)
    try {
      await app.close()
      const warnedOverrun = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('queue.shutdown_timeout_exceeded'),
      )
      expect(warnedOverrun).toBe(true)
    } finally {
      warnSpy.mockRestore()
      await verifyQueue.close()
    }
  }, 15000)
})
