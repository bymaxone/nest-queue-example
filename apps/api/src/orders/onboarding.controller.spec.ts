/**
 * Unit tests for OnboardingController.
 *
 * Layer: unit.
 * Goal: a valid user id is delegated to the service; an id with an illegal
 * character (which would break the derived job id) is rejected with a safe 400.
 * Mocks: OnboardingService.welcome.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { OnboardingController } from './onboarding.controller.js'
import type { OnboardingService } from './onboarding.service.js'

/**
 * Build the controller with a mocked service.
 *
 * @returns The controller plus the welcome spy.
 */
function setup() {
  const welcome = jest.fn<OnboardingService['welcome']>()
  const service: Partial<OnboardingService> = { welcome }
  const controller = new OnboardingController(service as OnboardingService)
  return { controller, welcome }
}

describe('OnboardingController (unit)', () => {
  it('delegates a valid user id to the service', async () => {
    /*
     * Scenario: an alphanumeric user id.
     * Rule it protects: the id is validated and passed through unchanged.
     */
    const { controller, welcome } = setup()
    welcome.mockResolvedValue({ created: true, jobId: 'welcome-u1' })

    const result = await controller.welcome('u1')

    expect(welcome).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ created: true, jobId: 'welcome-u1' })
  })

  it('rejects a user id containing an illegal character', async () => {
    /*
     * Scenario: a user id with a colon.
     * Rule it protects: a colon would break the derived BullMQ job id, so the
     * boundary schema rejects it with a safe 400 before the service is called.
     */
    const { controller, welcome } = setup()

    await expect(controller.welcome('bad:id')).rejects.toBeInstanceOf(BadRequestException)
    expect(welcome).not.toHaveBeenCalled()
  })
})
