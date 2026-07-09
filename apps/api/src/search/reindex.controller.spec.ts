/**
 * Unit tests for ReindexController.
 *
 * Layer: unit.
 * Goal: a valid body is parsed and delegated; an unknown mode is rejected with
 * the stable queue.invalid_job_data envelope before the service is called.
 * Mocks: ReindexService.reindex.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { QueueException } from '@bymax-one/nest-queue'
import { ReindexController } from './reindex.controller.js'
import type { ReindexResult, ReindexService } from './reindex.service.js'

/**
 * Build the controller with a mocked service.
 *
 * @returns The controller plus the reindex spy.
 */
function setup() {
  const reindex = jest.fn<ReindexService['reindex']>()
  const service: Partial<ReindexService> = { reindex }
  const controller = new ReindexController(service as ReindexService)
  return { controller, reindex }
}

describe('ReindexController (unit)', () => {
  it('parses a valid body and delegates to the service', async () => {
    /*
     * Scenario: a well-formed throttle reindex.
     * Rule it protects: the term and mode are validated and passed through.
     */
    const { controller, reindex } = setup()
    const outcome: ReindexResult = { jobId: 'j1', deduplicated: false }
    reindex.mockResolvedValue(outcome)

    const result = await controller.trigger({ term: 'widgets', mode: 'throttle' })

    expect(reindex).toHaveBeenCalledWith({ term: 'widgets', mode: 'throttle' })
    expect(result).toBe(outcome)
  })

  it('rejects an unknown mode with the queue.invalid_job_data envelope', async () => {
    /*
     * Scenario: a mode outside the accepted enum.
     * Rule it protects: the boundary schema rejects it before the service runs.
     */
    const { controller, reindex } = setup()

    await expect(controller.trigger({ term: 'widgets', mode: 'nope' })).rejects.toBeInstanceOf(
      QueueException,
    )
    expect(reindex).not.toHaveBeenCalled()
  })
})
