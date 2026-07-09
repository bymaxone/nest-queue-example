/**
 * Unit tests for AuditProcessor.
 *
 * Layer: unit.
 * Goal: the handler records the job payload with an ISO timestamp, and the
 * deliberately unconfigured `concurrency` trips the library's warn-and-fallback
 * path (the discovery service warns and defaults to DEFAULT_WORKER_CONCURRENCY).
 * Mocks: AuditTrail.append (spy); Date#toISOString pinned; processor metadata is
 * read directly to prove the missing-concurrency fallback.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { DEFAULT_WORKER_CONCURRENCY } from '@bymax-one/nest-queue'
import type { Job, WorkerOptions } from '@bymax-one/nest-queue'
import { AuditProcessor } from './audit.processor.js'
import type { AuditTrail } from './audit-trail.service.js'
import type { AuditJobData } from './audit.types.js'
import { WebhookProcessor } from './webhook.processor.js'

/** The processor metadata the `@Processor` decorator attaches to a class. */
interface ProcessorMetadata {
  queueName: string
  workerOptions: WorkerOptions
  _warnedNoConcurrency?: boolean
}

/** Narrow reflection metadata to the processor metadata carrying a queue name. */
function isProcessorMetadata(value: unknown): value is ProcessorMetadata {
  return (
    typeof value === 'object' && value !== null && 'queueName' in value && 'workerOptions' in value
  )
}

/**
 * Read the processor metadata recorded by `@Processor` on a processor class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered processor metadata.
 */
function readProcessorMetadata(ctor: object): ProcessorMetadata {
  for (const key of Reflect.getOwnMetadataKeys(ctor)) {
    const value: unknown = Reflect.getOwnMetadata(key, ctor)
    if (isProcessorMetadata(value)) {
      return value
    }
  }
  throw new Error('processor metadata not found')
}

/**
 * Build the processor with a spyable trail.
 *
 * @returns The processor and the append spy.
 */
function setup() {
  const append = jest.fn<AuditTrail['append']>()
  const trail: Partial<AuditTrail> = { append }
  const processor = new AuditProcessor(trail as AuditTrail)
  return { processor, append }
}

describe('AuditProcessor (unit)', () => {
  it('records the job payload with an ISO timestamp', () => {
    /*
     * Scenario: a job flows through the handler.
     * Rule it protects: the handler appends `{ at, payload }` using the job's
     * payload and the current time as an ISO string.
     */
    const { processor, append } = setup()
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')
    const job = { data: { payload: 'hello' } } as Job<AuditJobData>

    processor.record(job)

    expect(append).toHaveBeenCalledWith({ at: '2026-07-09T00:00:00.000Z', payload: 'hello' })
  })

  it('omits concurrency so the library warns and falls back to the default', () => {
    /*
     * Scenario: the audit processor declares no explicit concurrency.
     * Rule it protects: the decorator flags the omission (`_warnedNoConcurrency`),
     * which the discovery service reads to warn and fall back to
     * DEFAULT_WORKER_CONCURRENCY rather than running silently serial.
     */
    const meta = readProcessorMetadata(AuditProcessor)

    expect(meta.queueName).toBe('audit')
    expect(meta._warnedNoConcurrency).toBe(true)
    expect(meta.workerOptions.concurrency).toBe(DEFAULT_WORKER_CONCURRENCY)
  })

  it('does not trip the warning for a processor with explicit concurrency', () => {
    /*
     * Contrast: a processor that sets concurrency explicitly.
     * Rule it protects: the warn flag is only set when concurrency is omitted, so
     * the fallback path is scoped to the deliberately unconfigured processor.
     */
    const meta = readProcessorMetadata(WebhookProcessor)

    expect(meta._warnedNoConcurrency).toBeUndefined()
    expect(meta.workerOptions.concurrency).toBe(5)
  })
})
