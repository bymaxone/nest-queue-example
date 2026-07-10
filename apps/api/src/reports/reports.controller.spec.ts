/**
 * Unit tests for ReportsController.
 *
 * Layer: unit.
 * Goal: a report request enqueues a generate job with a fresh report id and
 * returns both ids.
 * Mocks: QueueService.enqueue (spy).
 */
import { jest } from '@jest/globals'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { REPORTS_QUEUE } from '../queues/queue-names.js'
import { GENERATE_REPORT_JOB } from './report-jobs.constants.js'
import { ReportsController } from './reports.controller.js'

describe('ReportsController (unit)', () => {
  it('enqueues a generate job with a fresh report id and returns both ids', async () => {
    /*
     * Scenario: a report request.
     * Rule it protects: a server-generated report id is enqueued as the job data
     * and both the report id and job id are returned so the caller can poll.
     */
    const enqueue = jest.fn<QueueService['enqueue']>().mockResolvedValue({ id: 'job-1' } as Job)
    const controller = new ReportsController({ enqueue } as unknown as QueueService)

    const result = await controller.generate()

    expect(typeof result.reportId).toBe('string')
    expect(result.reportId.length).toBeGreaterThan(0)
    expect(result.jobId).toBe('job-1')
    expect(enqueue).toHaveBeenCalledWith(REPORTS_QUEUE, GENERATE_REPORT_JOB, {
      reportId: result.reportId,
    })
  })
})
