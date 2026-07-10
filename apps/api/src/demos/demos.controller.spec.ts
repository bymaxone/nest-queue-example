/**
 * Unit tests for DemosController.
 *
 * Layer: unit.
 * Goal: a stall request enqueues a stall job with a fresh demo id and returns
 * both ids.
 * Mocks: QueueService.enqueue (spy).
 */
import { jest } from '@jest/globals'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { DEMOS_QUEUE } from '../queues/queue-names.js'
import { STALL_JOB } from './demo-jobs.constants.js'
import { DemosController } from './demos.controller.js'

describe('DemosController (unit)', () => {
  it('enqueues a stall job with a fresh demo id and returns both ids', async () => {
    /*
     * Scenario: a stall-demo request.
     * Rule it protects: a server-generated demo id is enqueued as the job data and
     * both ids are returned so the operator can follow the recovery.
     */
    const enqueue = jest.fn<QueueService['enqueue']>().mockResolvedValue({ id: 'job-1' } as Job)
    const controller = new DemosController({ enqueue } as unknown as QueueService)

    const result = await controller.stall()

    expect(typeof result.demoId).toBe('string')
    expect(result.demoId.length).toBeGreaterThan(0)
    expect(result.jobId).toBe('job-1')
    expect(enqueue).toHaveBeenCalledWith(DEMOS_QUEUE, STALL_JOB, { demoId: result.demoId })
  })
})
