/**
 * @fileoverview Onboarding service demonstrating idempotent enqueue by `jobId`.
 * The welcome email uses a stable, per-user job id so a repeat call while the
 * first job still exists is a no-op; the response reports whether the job was
 * newly created.
 * @layer app/orders
 */
import { Injectable } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE } from '../queues/queue-names.js'
import { WELCOME_JOB } from './order-jobs.constants.js'
import type { WelcomeEmailJobData, WelcomeEmailJobResult } from './order-jobs.types.js'

/**
 * Build the stable welcome job id for a user. BullMQ rejects a custom job id
 * containing a single colon, so the delimiter is a hyphen rather than a colon.
 *
 * @param userId - The user being onboarded.
 * @returns The idempotent welcome job id.
 */
function welcomeJobId(userId: string): string {
  return `welcome-${userId}`
}

/** Outcome of an onboarding attempt: whether the welcome job was newly created. */
export interface OnboardingResult {
  /** `false` when an identical welcome job already existed (idempotent no-op). */
  created: boolean
  /** The stable welcome job id. */
  jobId: string
}

/** Enqueues idempotent per-user welcome emails. */
@Injectable()
export class OnboardingService {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Enqueue a welcome email for a user, idempotently by `jobId`. A second call
   * while the first job still exists neither errors nor double-inserts.
   *
   * The `created` flag comes from a non-atomic check-then-act (read via `getJob`,
   * then `enqueue`), so under two concurrent identical requests both may report
   * `created: true`. The enqueue itself stays idempotent: BullMQ still creates at
   * most one job for the id, so only the reported flag, never the job count, can
   * be affected.
   *
   * @param userId - The user to onboard.
   * @returns Whether the job was newly created and its stable id.
   */
  async welcome(userId: string): Promise<OnboardingResult> {
    const jobId = welcomeJobId(userId)
    const existing = await this.queueService.getJob<WelcomeEmailJobData, WelcomeEmailJobResult>(
      EMAIL_QUEUE,
      jobId,
    )
    await this.queueService.enqueue<WelcomeEmailJobData, WelcomeEmailJobResult>(
      EMAIL_QUEUE,
      WELCOME_JOB,
      { userId },
      { jobId },
    )
    return { created: existing === null, jobId }
  }
}
