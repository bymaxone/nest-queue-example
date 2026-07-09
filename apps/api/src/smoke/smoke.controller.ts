/**
 * @fileoverview Smoke endpoints that prove the enqueue-to-process loop end to
 * end. Injects `QueueService` without importing the queue module, exercising the
 * library's global registration.
 * @layer app/smoke
 */
import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { AuditTrail } from '../processors/audit-trail.service.js'
import type { AuditEntry, AuditJobData } from '../processors/audit.types.js'

/** Validates the smoke request body at the trust boundary. */
const smokeBodySchema = z.object({ payload: z.string().min(1).max(1000) })

/** Enqueue-and-inspect surface for the `audit` smoke queue. */
@Controller('smoke')
export class SmokeController {
  constructor(
    private readonly queueService: QueueService,
    private readonly auditTrail: AuditTrail,
  ) {}

  /**
   * Enqueue a typed `audit`/`entry` job.
   *
   * @param body - Unvalidated request body; parsed against {@link smokeBodySchema}.
   * @returns The created job id.
   * @throws {BadRequestException} When the payload is missing or malformed.
   */
  @Post('audit')
  async enqueue(@Body() body: unknown): Promise<{ id: string | undefined }> {
    const parsed = smokeBodySchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('payload must be a non-empty string of at most 1000 characters')
    }
    const job = await this.queueService.enqueue<AuditJobData>('audit', 'entry', {
      payload: parsed.data.payload,
    })
    return { id: job.id }
  }

  /**
   * Return the entries processed so far.
   *
   * @returns A snapshot of the audit trail.
   */
  @Get('audit')
  list(): readonly AuditEntry[] {
    return this.auditTrail.list()
  }
}
