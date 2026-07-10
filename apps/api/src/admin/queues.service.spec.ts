/**
 * Unit tests for AdminQueuesService.
 *
 * Layer: unit.
 * Goal: bootstrap pre-creates the email queue with a per-queue attempts override
 * (row 12) and getManagedQueue caches by name (row 24); metrics, job listing,
 * job lookup, and pause/resume/clean delegate to the library and refuse unknown
 * queues with queue.queue_not_found, surfacing queue.job_not_found for a missing job.
 * Mocks: QueueService methods.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { HttpStatus } from '@nestjs/common'
import { QueueException, QueueService } from '@bymax-one/nest-queue'
import type { Job, JobStatus, QueueMetrics } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE, KNOWN_QUEUES, SEARCH_QUEUE } from '../queues/queue-names.js'
import { AdminQueuesService } from './queues.service.js'

/**
 * Build the service with a fully mocked QueueService. getOrCreateQueue caches by
 * name so repeated calls return the identical stub.
 *
 * @returns The service plus every underlying spy.
 */
function setup() {
  const cache = new Map<string, { name: string }>()
  const getOrCreateQueue = jest.fn(
    (name: string) => cache.get(name) ?? cache.set(name, { name }).get(name),
  )
  const getMetrics = jest.fn<(name: string) => Promise<QueueMetrics>>()
  const getJobs =
    jest.fn<(name: string, status: JobStatus, start?: number, end?: number) => Promise<Job[]>>()
  const getJob = jest.fn<(name: string, id: string) => Promise<Job | null>>()
  const pauseQueue = jest.fn<(name: string) => Promise<void>>()
  const resumeQueue = jest.fn<(name: string) => Promise<void>>()
  const cleanQueue =
    jest.fn<(name: string, grace: number, limit: number, status?: string) => Promise<string[]>>()
  const queueService = {
    getOrCreateQueue,
    getMetrics,
    getJobs,
    getJob,
    pauseQueue,
    resumeQueue,
    cleanQueue,
  } as unknown as QueueService
  const service = new AdminQueuesService(queueService)
  return {
    service,
    getOrCreateQueue,
    getMetrics,
    getJobs,
    getJob,
    pauseQueue,
    resumeQueue,
    cleanQueue,
  }
}

/** A BullMQ job fixture with every field the view projects. */
const jobFixture = {
  id: 'j1',
  name: 'send-receipt',
  data: { orderId: 'o1' },
  timestamp: 1000,
  attemptsMade: 1,
  delay: 0,
  progress: 50,
  returnvalue: { messageId: 'm1' },
  failedReason: undefined,
} as unknown as Job

describe('AdminQueuesService (unit)', () => {
  it('pre-creates the email queue with an attempts override at bootstrap', () => {
    /*
     * Scenario: application bootstrap.
     * Rule it protects: the email queue is created through the per-queue override
     * (attempts 5), and the search queue is created with module defaults.
     */
    const { service, getOrCreateQueue } = setup()

    service.onApplicationBootstrap()

    expect(getOrCreateQueue).toHaveBeenCalledWith(EMAIL_QUEUE, {
      defaultJobOptions: { attempts: 5 },
    })
    expect(getOrCreateQueue).toHaveBeenCalledWith(SEARCH_QUEUE)
  })

  it('returns the same cached queue instance across calls', () => {
    /*
     * Scenario: two lookups of the same known queue.
     * Rule it protects: getOrCreateQueue caches by name, so the admin plane always
     * operates on one queue instance per name.
     */
    const { service } = setup()

    expect(service.getManagedQueue(EMAIL_QUEUE)).toBe(service.getManagedQueue(EMAIL_QUEUE))
  })

  it('rejects an unknown queue name with queue.queue_not_found', () => {
    /*
     * Scenario: an admin request naming a queue the example does not manage.
     * Rule it protects: untrusted input can never lazily create an arbitrary
     * Redis queue; the stable 404 not-found envelope is surfaced instead.
     */
    const { service, getOrCreateQueue } = setup()

    let thrown: unknown
    try {
      service.getManagedQueue('rogue')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(QueueException)
    expect((thrown as QueueException).getStatus()).toBe(HttpStatus.NOT_FOUND)
    expect(
      ((thrown as QueueException).getResponse() as { error: { code: string } }).error.code,
    ).toBe('queue.queue_not_found')
    expect(getOrCreateQueue).not.toHaveBeenCalledWith('rogue')
  })

  it('collects a direct metrics snapshot for every managed queue', async () => {
    /*
     * Scenario: the overview metrics call.
     * Rule it protects: one direct getMetrics is issued per known queue.
     */
    const { service, getMetrics } = setup()
    getMetrics.mockImplementation((name) =>
      Promise.resolve({ queue: name } as unknown as QueueMetrics),
    )

    const result = await service.collectMetrics()

    expect(getMetrics).toHaveBeenCalledTimes(KNOWN_QUEUES.length)
    expect(result.map((metric) => metric.queue)).toEqual([...KNOWN_QUEUES])
  })

  it('lists jobs by status as serializable views', async () => {
    /*
     * Scenario: paging waiting jobs.
     * Rule it protects: getJobs is called with the status and window, and each job
     * is projected to a serializable view with no live queue reference.
     */
    const { service, getJobs } = setup()
    getJobs.mockResolvedValue([jobFixture])

    const result = await service.listJobs(EMAIL_QUEUE, 'waiting', 0, 50)

    expect(getJobs).toHaveBeenCalledWith(EMAIL_QUEUE, 'waiting', 0, 50)
    expect(result).toEqual([
      {
        id: 'j1',
        name: 'send-receipt',
        data: { orderId: 'o1' },
        timestamp: 1000,
        attemptsMade: 1,
        delay: 0,
        progress: 50,
        returnValue: { messageId: 'm1' },
        failedReason: undefined,
      },
    ])
  })

  it('rejects a job listing on an unknown queue', async () => {
    /*
     * Scenario: listing jobs on an unmanaged queue.
     * Rule it protects: the allow-list guard fires before any Redis access.
     */
    const { service, getJobs } = setup()

    await expect(service.listJobs('rogue', 'waiting', 0, 50)).rejects.toBeInstanceOf(QueueException)
    expect(getJobs).not.toHaveBeenCalled()
  })

  it('returns a single job view when the job exists', async () => {
    /*
     * Scenario: fetching an existing job.
     * Rule it protects: the job is projected to a view.
     */
    const { service, getJob } = setup()
    getJob.mockResolvedValue(jobFixture)

    const result = await service.findJob(EMAIL_QUEUE, 'j1')

    expect(getJob).toHaveBeenCalledWith(EMAIL_QUEUE, 'j1')
    expect(result.id).toBe('j1')
  })

  it('surfaces queue.job_not_found when the job is missing', async () => {
    /*
     * Scenario: fetching a job that does not exist.
     * Rule it protects: the library returns null; the example raises the stable
     * job-not-found envelope (404) rather than returning null to the client.
     */
    const { service, getJob } = setup()
    getJob.mockResolvedValue(null)

    let thrown: unknown
    try {
      await service.findJob(EMAIL_QUEUE, 'missing')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(QueueException)
    expect((thrown as QueueException).getStatus()).toBe(HttpStatus.NOT_FOUND)
    expect((thrown as QueueException).getResponse()).toMatchObject({
      error: { code: 'queue.job_not_found', details: { queue: EMAIL_QUEUE, jobId: 'missing' } },
    })
  })

  it('delegates pause and resume to the library', async () => {
    /*
     * Scenario: pausing then resuming a queue.
     * Rule it protects: both control calls reach the library for a known queue.
     */
    const { service, pauseQueue, resumeQueue } = setup()

    await service.pause(EMAIL_QUEUE)
    await service.resume(EMAIL_QUEUE)

    expect(pauseQueue).toHaveBeenCalledWith(EMAIL_QUEUE)
    expect(resumeQueue).toHaveBeenCalledWith(EMAIL_QUEUE)
  })

  it('cleans a queue and returns the removed ids', async () => {
    /*
     * Scenario: cleaning completed jobs.
     * Rule it protects: cleanQueue is called with the grace, limit, and status in
     * BullMQ argument order, and the removed ids are returned.
     */
    const { service, cleanQueue } = setup()
    cleanQueue.mockResolvedValue(['1', '2'])

    const result = await service.clean(EMAIL_QUEUE, 1000, 10, 'completed')

    expect(cleanQueue).toHaveBeenCalledWith(EMAIL_QUEUE, 1000, 10, 'completed')
    expect(result).toEqual(['1', '2'])
  })
})
