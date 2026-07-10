/**
 * Unit tests for ReportProcessor.
 *
 * Layer: unit.
 * Goal: the handler emits three numeric progress checkpoints then a structured
 * object, returns the report id with a measured duration, and the worker is
 * registered with the intended concurrency and raised lock duration.
 * Mocks: fake timers drive the staged delays; Job.updateProgress is a spy;
 * processor metadata is read directly to assert worker options.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job, WorkerOptions } from '@bymax-one/nest-queue'
import type { ReportJobData, ReportJobResult } from '../reports/report-jobs.types.js'
import { ReportProcessor } from './report.processor.js'

/** Narrow reflection metadata to the processor metadata carrying worker options. */
function isProcessorMetadata(
  value: unknown,
): value is { queueName: string; workerOptions: WorkerOptions } {
  return (
    typeof value === 'object' && value !== null && 'queueName' in value && 'workerOptions' in value
  )
}

/**
 * Read the worker options recorded by `@Processor` on a processor class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered worker options.
 */
function readWorkerOptions(ctor: object): WorkerOptions {
  for (const key of Reflect.getOwnMetadataKeys(ctor)) {
    const value: unknown = Reflect.getOwnMetadata(key, ctor)
    if (isProcessorMetadata(value)) {
      return value.workerOptions
    }
  }
  throw new Error('processor metadata not found')
}

describe('ReportProcessor (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('registers concurrency 2 and a raised lock duration', () => {
    /*
     * Scenario: worker registration.
     * Rule it protects: the decorator carries a low concurrency and a lock duration
     * well above the handler's worst-case runtime so healthy jobs never falsely
     * stall.
     */
    const options = readWorkerOptions(ReportProcessor)

    expect(options.concurrency).toBe(2)
    expect(options.lockDuration).toBe(60_000)
  })

  it('emits staged numeric progress then a final object and returns a summary', async () => {
    /*
     * Scenario: a report job advances through its staged steps.
     * Rule it protects: progress is reported as three numeric checkpoints then one
     * structured object (both `updateProgress` forms), and the result carries the
     * report id and a numeric duration.
     */
    jest.useFakeTimers()
    const processor = new ReportProcessor()
    const updateProgress = jest.fn<Job['updateProgress']>().mockResolvedValue(undefined)
    const job = { data: { reportId: 'r1' }, updateProgress } as unknown as Job<
      ReportJobData,
      ReportJobResult
    >

    const pending = processor.generate(job)
    await jest.runAllTimersAsync()
    const result = await pending

    expect(updateProgress.mock.calls).toEqual([[25], [50], [75], [{ stage: 'render', pct: 90 }]])
    expect(result.reportId).toBe('r1')
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    // An elapsed span is far smaller than the wall clock; a mutated `+` would make it
    // ~2x the epoch, so this pins the subtraction that computes the real duration.
    expect(result.durationMs).toBeLessThan(Date.now())
  })
})
