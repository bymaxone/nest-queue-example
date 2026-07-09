/**
 * Unit tests for JobsController.
 *
 * Layer: unit.
 * Goal: a valid job id is validated and delegated; a malformed id is rejected
 * with a safe 400 before the service is called.
 * Mocks: AdminQueuesService.findJob.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { JobsController } from './jobs.controller.js'
import type { AdminQueuesService, JobView } from './queues.service.js'

/**
 * Build the controller with a mocked admin service.
 *
 * @returns The controller plus the findJob spy.
 */
function setup() {
  const findJob = jest.fn<AdminQueuesService['findJob']>()
  const service: Partial<AdminQueuesService> = { findJob }
  const controller = new JobsController(service as AdminQueuesService)
  return { controller, findJob }
}

describe('JobsController (unit)', () => {
  it('validates the id and delegates the lookup', async () => {
    /*
     * Scenario: a well-formed job id.
     * Rule it protects: the id is validated and passed through with the queue.
     */
    const { controller, findJob } = setup()
    const view = { id: 'j1' } as JobView
    findJob.mockResolvedValue(view)

    const result = await controller.find('email', 'j1')

    expect(findJob).toHaveBeenCalledWith('email', 'j1')
    expect(result).toBe(view)
  })

  it('rejects a malformed job id before the lookup', async () => {
    /*
     * Scenario: an over-long id.
     * Rule it protects: the boundary schema rejects it with a safe 400 and never
     * reaches the service.
     */
    const { controller, findJob } = setup()

    await expect(controller.find('email', 'x'.repeat(200))).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(findJob).not.toHaveBeenCalled()
  })
})
