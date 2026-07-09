/**
 * Unit tests for OnboardingService.
 *
 * Layer: unit.
 * Goal: the first welcome for a user reports created:true and enqueues under a
 * stable hyphenated job id; a repeat while the job still exists reports
 * created:false; both enqueue idempotently by jobId.
 * Mocks: QueueService.getJob and QueueService.enqueue.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { WELCOME_JOB } from './order-jobs.constants.js'
import { OnboardingService } from './onboarding.service.js'

/**
 * Build the service with mocked queue collaborators.
 *
 * @returns The service plus the getJob and enqueue spies.
 */
function setup() {
  const getJob = jest.fn<(queueName: string, jobId: string) => Promise<Job | null>>()
  const enqueue =
    jest.fn<
      (queueName: string, jobName: string, data: unknown, options?: unknown) => Promise<Job>
    >()
  const queueService: Partial<QueueService> = { getJob, enqueue }
  const service = new OnboardingService(queueService as QueueService)
  return { service, getJob, enqueue }
}

describe('OnboardingService (unit)', () => {
  it('creates the welcome job on the first call', async () => {
    /*
     * Scenario: no prior welcome job for the user.
     * Rule it protects: created:true, and the job is enqueued under the stable
     * hyphenated id with the typed payload.
     */
    const { service, getJob, enqueue } = setup()
    getJob.mockResolvedValue(null)
    enqueue.mockResolvedValue({ id: 'welcome-u1' } as Partial<Job> as Job)

    const result = await service.welcome('u1')

    expect(getJob).toHaveBeenCalledWith(EMAIL_QUEUE, 'welcome-u1')
    expect(enqueue).toHaveBeenCalledWith(
      EMAIL_QUEUE,
      WELCOME_JOB,
      { userId: 'u1' },
      { jobId: 'welcome-u1' },
    )
    expect(result).toEqual({ created: true, jobId: 'welcome-u1' })
  })

  it('reports created:false when the welcome job already exists', async () => {
    /*
     * Scenario: a repeat call while the first welcome job still exists.
     * Rule it protects: the second call is a no-op idempotent insert, reported as
     * created:false with the same job id and no error.
     */
    const { service, getJob, enqueue } = setup()
    getJob.mockResolvedValue({ id: 'welcome-u1' } as Partial<Job> as Job)
    enqueue.mockResolvedValue({ id: 'welcome-u1' } as Partial<Job> as Job)

    const result = await service.welcome('u1')

    expect(result).toEqual({ created: false, jobId: 'welcome-u1' })
    expect(enqueue).toHaveBeenCalledWith(
      EMAIL_QUEUE,
      WELCOME_JOB,
      { userId: 'u1' },
      { jobId: 'welcome-u1' },
    )
  })
})
