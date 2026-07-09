/**
 * Unit tests for CampaignController.
 *
 * Layer: unit.
 * Goal: a valid count is delegated; a count above the zod ceiling is rejected
 * with the stable queue.invalid_job_data envelope before the service is called.
 * Mocks: CampaignService.sendReceipts.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { QueueException } from '@bymax-one/nest-queue'
import { CampaignController } from './campaign.controller.js'
import type { CampaignResult, CampaignService } from './campaign.service.js'

/**
 * Build the controller with a mocked service.
 *
 * @returns The controller plus the sendReceipts spy.
 */
function setup() {
  const sendReceipts = jest.fn<CampaignService['sendReceipts']>()
  const service: Partial<CampaignService> = { sendReceipts }
  const controller = new CampaignController(service as CampaignService)
  return { controller, sendReceipts }
}

describe('CampaignController (unit)', () => {
  it('delegates a valid count to the service', async () => {
    /*
     * Scenario: a within-cap campaign request.
     * Rule it protects: the count is validated and passed through.
     */
    const { controller, sendReceipts } = setup()
    const outcome: CampaignResult = { enqueued: 2, jobIds: ['1', '2'] }
    sendReceipts.mockResolvedValue(outcome)

    const result = await controller.receipts({ count: 2 })

    expect(sendReceipts).toHaveBeenCalledWith(2)
    expect(result).toBe(outcome)
  })

  it('rejects a count above the ceiling with the queue.invalid_job_data envelope', async () => {
    /*
     * Scenario: a request far above any reasonable batch.
     * Rule it protects: the boundary schema rejects it before the service runs,
     * so untrusted input can never drive an unbounded enqueue.
     */
    const { controller, sendReceipts } = setup()

    await expect(controller.receipts({ count: 5000 })).rejects.toBeInstanceOf(QueueException)
    expect(sendReceipts).not.toHaveBeenCalled()
  })
})
