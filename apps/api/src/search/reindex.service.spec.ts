/**
 * Unit tests for ReindexService.
 *
 * Layer: unit.
 * Goal: each deduplication mode maps to the exact BullMQ option shape and the
 * dedup key is `reindex:<term>`; the deduplicated flag compares the pre-existing
 * dedup job id against the returned job id.
 * Mocks: QueueService.getOrCreateQueue (with getDeduplicationJobId) and enqueue.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { SEARCH_QUEUE } from '../queues/queue-names.js'
import { REINDEX_JOB } from './search.constants.js'
import { ReindexService } from './reindex.service.js'

/**
 * Build the service with a mocked queue exposing getDeduplicationJobId.
 *
 * @returns The service plus the getDeduplicationJobId and enqueue spies.
 */
function setup() {
  const getDeduplicationJobId = jest.fn<(id: string) => Promise<string | null>>()
  const enqueue =
    jest.fn<
      (queueName: string, jobName: string, data: unknown, options?: unknown) => Promise<Job>
    >()
  const getOrCreateQueue = jest.fn(() => ({ getDeduplicationJobId }))
  const queueService: Partial<QueueService> = {
    getOrCreateQueue: getOrCreateQueue as unknown as QueueService['getOrCreateQueue'],
    enqueue,
  }
  const service = new ReindexService(queueService as QueueService)
  return { service, getDeduplicationJobId, enqueue }
}

/** Dedup key derived from the term used across the suite. */
const DEDUP_ID = 'reindex:widgets'

describe('ReindexService (unit)', () => {
  it('maps simple mode to a bare deduplication id', async () => {
    /*
     * Scenario: first simple reindex for a term.
     * Rule it protects: simple mode passes only { id }; with no prior dedup key
     * the enqueue is not deduplicated.
     */
    const { service, getDeduplicationJobId, enqueue } = setup()
    getDeduplicationJobId.mockResolvedValue(null)
    enqueue.mockResolvedValue({ id: 'j1' } as Partial<Job> as Job)

    const result = await service.reindex({ term: 'widgets', mode: 'simple' })

    expect(enqueue).toHaveBeenCalledWith(
      SEARCH_QUEUE,
      REINDEX_JOB,
      { term: 'widgets' },
      {
        deduplication: { id: DEDUP_ID },
      },
    )
    expect(result).toEqual({ jobId: 'j1', deduplicated: false })
  })

  it('maps throttle mode and reports a collapsed enqueue as deduplicated', async () => {
    /*
     * Scenario: a throttled reindex whose key already points at a job.
     * Rule it protects: throttle passes { id, ttl }; when the returned job equals
     * the pre-existing dedup job the response is deduplicated:true.
     */
    const { service, getDeduplicationJobId, enqueue } = setup()
    getDeduplicationJobId.mockResolvedValue('j1')
    enqueue.mockResolvedValue({ id: 'j1' } as Partial<Job> as Job)

    const result = await service.reindex({ term: 'widgets', mode: 'throttle' })

    expect(enqueue).toHaveBeenCalledWith(
      SEARCH_QUEUE,
      REINDEX_JOB,
      { term: 'widgets' },
      {
        deduplication: { id: DEDUP_ID, ttl: 5000 },
      },
    )
    expect(result).toEqual({ jobId: 'j1', deduplicated: true })
  })

  it('maps debounce mode with a delay and treats a replaced job as not deduplicated', async () => {
    /*
     * Scenario: a debounced reindex that replaces the previous job.
     * Rule it protects: debounce passes { id, ttl, extend, replace } plus a delay;
     * a replacing job has a new id, so the response is deduplicated:false.
     */
    const { service, getDeduplicationJobId, enqueue } = setup()
    getDeduplicationJobId.mockResolvedValue('old')
    enqueue.mockResolvedValue({ id: 'new' } as Partial<Job> as Job)

    const result = await service.reindex({ term: 'widgets', mode: 'debounce' })

    expect(enqueue).toHaveBeenCalledWith(
      SEARCH_QUEUE,
      REINDEX_JOB,
      { term: 'widgets' },
      {
        deduplication: { id: DEDUP_ID, ttl: 5000, extend: true, replace: true },
        delay: 2000,
      },
    )
    expect(result).toEqual({ jobId: 'new', deduplicated: false })
  })

  it('maps keepLast mode to keepLastIfActive', async () => {
    /*
     * Scenario: a keep-last-if-active reindex.
     * Rule it protects: keepLast passes { id, keepLastIfActive: true }.
     */
    const { service, getDeduplicationJobId, enqueue } = setup()
    getDeduplicationJobId.mockResolvedValue(null)
    enqueue.mockResolvedValue({ id: 'j2' } as Partial<Job> as Job)

    await service.reindex({ term: 'widgets', mode: 'keepLast' })

    expect(enqueue).toHaveBeenCalledWith(
      SEARCH_QUEUE,
      REINDEX_JOB,
      { term: 'widgets' },
      {
        deduplication: { id: DEDUP_ID, keepLastIfActive: true },
      },
    )
  })
})
