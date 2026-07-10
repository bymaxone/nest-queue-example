/**
 * @fileoverview E2E: the three module registration paths the api's own
 * `forRootAsync` + `useFactory` wiring does not exercise: `forRoot` (sync),
 * `useClass`, and `useExisting`; plus the `@Processor` decorator's duplicate
 * guard. Covers spec §7 matrix rows 2, 3, 46. Each spec builds its own tiny Nest
 * module directly against the library (isolated Redis prefix), rather than the
 * full `AppModule`, so the main app's wiring stays out of scope.
 * @layer test/e2e
 */
import { randomUUID } from 'node:crypto'
import { Test } from '@nestjs/testing'
import { BymaxQueueModule, Process, Processor, QueueService } from '@bymax-one/nest-queue'
import type { BymaxQueueModuleOptions } from '@bymax-one/nest-queue'
import { e2eRedisUrl } from './support/test-app.js'
import { OptionsFactoryModule, QueueOptionsFactory } from './support/options-factory.module.js'

/** Build fresh, per-spec module options so no two specs collide on Redis keys. */
function optionsFor(prefix: string): BymaxQueueModuleOptions {
  return {
    connection: { url: e2eRedisUrl() },
    prefix: `e2e-registration-${prefix}-${randomUUID().slice(0, 8)}`,
  }
}

/** Two colliding processors so the duplicate-processor guard has something to catch. */
const DUPLICATE_QUEUE = 'e2e-duplicate-queue'

@Processor(DUPLICATE_QUEUE)
class FirstProcessor {
  @Process()
  handle(): void {
    /* never invoked; the guard fires before any job is dispatched */
  }
}

@Processor(DUPLICATE_QUEUE)
class SecondProcessor {
  @Process()
  handle(): void {
    /* never invoked; the guard fires before any job is dispatched */
  }
}

describe('registration (e2e)', () => {
  it('registers synchronously via forRoot and proves the service works end to end (row 2)', async () => {
    // Scenario: BymaxQueueModule.forRoot with static, synchronous options.
    // Rule it protects: the sync registration path boots a fully working module,
    // proven by a real enqueue/getJob roundtrip.
    const moduleRef = await Test.createTestingModule({
      imports: [BymaxQueueModule.forRoot(optionsFor('forroot'))],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()
    try {
      const queueService = app.get(QueueService)
      const job = await queueService.enqueue('smoke', 'ping', { hello: 'world' })
      expect(job.id).toEqual(expect.any(String))
      const fetched = await queueService.getJob('smoke', job.id ?? '')
      expect(fetched?.id).toBe(job.id)
    } finally {
      await app.close()
    }
  })

  it('registers asynchronously via useClass, instantiating the factory internally (row 3)', async () => {
    // Scenario: BymaxQueueModule.forRootAsync with useClass.
    // Rule it protects: the module instantiates the factory class itself (no
    // pre-existing provider needed) and the resulting service works end to end.
    const moduleRef = await Test.createTestingModule({
      imports: [BymaxQueueModule.forRootAsync({ useClass: QueueOptionsFactory })],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()
    try {
      const queueService = app.get(QueueService)
      const job = await queueService.enqueue('smoke', 'ping', { via: 'useClass' })
      expect(job.id).toEqual(expect.any(String))
    } finally {
      await app.close()
    }
  })

  it('registers asynchronously via useExisting, reusing an already-provided factory (row 3)', async () => {
    // Scenario: BymaxQueueModule.forRootAsync with useExisting.
    // Rule it protects: the module reuses an already-provided factory instance
    // from an imported module instead of constructing a new one.
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxQueueModule.forRootAsync({
          imports: [OptionsFactoryModule],
          useExisting: QueueOptionsFactory,
        }),
      ],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()
    try {
      const queueService = app.get(QueueService)
      const job = await queueService.enqueue('smoke', 'ping', { via: 'useExisting' })
      expect(job.id).toEqual(expect.any(String))
    } finally {
      await app.close()
    }
  })

  it('rejects a second @Processor targeting an already-registered queue (row 46)', async () => {
    // Scenario: two classes each decorated @Processor on the same queue name.
    // Rule it protects: processor discovery guards uniqueness at bootstrap,
    // failing the whole app with queue.duplicate_processor.
    const moduleRef = await Test.createTestingModule({
      imports: [BymaxQueueModule.forRoot(optionsFor('duplicate'))],
      providers: [FirstProcessor, SecondProcessor],
    }).compile()
    const app = moduleRef.createNestApplication()
    await expect(app.init()).rejects.toMatchObject({
      response: { error: { code: 'queue.duplicate_processor' } },
    })
    await app.close()
  })
})
