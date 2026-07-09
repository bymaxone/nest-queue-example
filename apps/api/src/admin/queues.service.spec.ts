/**
 * Unit tests for AdminQueuesService.
 *
 * Layer: unit.
 * Goal: bootstrap pre-creates the email queue with a per-queue attempts override
 * (row 12); getManagedQueue returns the same cached instance across calls
 * (row 24) and refuses an unknown queue name with queue.queue_not_found.
 * Mocks: QueueService.getOrCreateQueue (a name-keyed cache mirroring the library).
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { HttpStatus } from '@nestjs/common'
import { QueueException, QueueService } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE, SEARCH_QUEUE } from '../queues/queue-names.js'
import { AdminQueuesService } from './queues.service.js'

/**
 * Build the service with a mocked QueueService whose getOrCreateQueue caches by
 * name, so repeated calls for the same name return the identical stub — exactly
 * the caching contract the real library provides.
 *
 * @returns The service plus the getOrCreateQueue spy.
 */
function setup() {
  const cache = new Map<string, { name: string }>()
  const getOrCreateQueue = jest.fn((name: string) => {
    const existing = cache.get(name)
    if (existing) {
      return existing
    }
    const created = { name }
    cache.set(name, created)
    return created
  })
  const queueService: Partial<QueueService> = {
    getOrCreateQueue: getOrCreateQueue as unknown as QueueService['getOrCreateQueue'],
  }
  const service = new AdminQueuesService(queueService as QueueService)
  return { service, getOrCreateQueue }
}

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
    const exception = thrown as QueueException
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND)
    expect((exception.getResponse() as { error: { code: string } }).error.code).toBe(
      'queue.queue_not_found',
    )
    expect(getOrCreateQueue).not.toHaveBeenCalledWith('rogue')
  })
})
