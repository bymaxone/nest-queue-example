/**
 * @fileoverview Onboarding HTTP surface. Thin controller: validate the user id at
 * the trust boundary, delegate to the service, return the idempotency outcome.
 * @layer app/orders
 */
import { Controller, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { OnboardingService } from './onboarding.service.js'
import type { OnboardingResult } from './onboarding.service.js'

/** Upper bound on a user-id length; a demo guardrail against absurd input. */
const MAX_USER_ID_LENGTH = 64

/**
 * Bounds the user-id path param to a safe charset. Colons are excluded so the
 * derived welcome job id stays valid for BullMQ.
 */
const userIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(MAX_USER_ID_LENGTH)

/** Enqueue surface for idempotent user onboarding. */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * Onboard a user by enqueuing an idempotent welcome email.
   *
   * @param userId - Unvalidated user id from the path.
   * @returns Whether the welcome job was newly created and its id.
   * @throws {BadRequestException} When the user id is malformed.
   */
  @Post(':userId')
  async welcome(@Param('userId') userId: unknown): Promise<OnboardingResult> {
    return this.onboarding.welcome(parseRequest(userIdSchema, userId))
  }
}
