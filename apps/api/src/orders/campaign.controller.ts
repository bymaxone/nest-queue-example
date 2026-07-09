/**
 * @fileoverview Campaign HTTP surface. Thin controller: validate the requested
 * batch size at the trust boundary and delegate. The zod ceiling sits just above
 * the library's bulk cap so an over-cap request still reaches the library and
 * triggers its `queue.bulk_enqueue_failed` guard, while a truly absurd request is
 * rejected outright.
 * @layer app/orders
 */
import { Body, Controller, Post } from '@nestjs/common'
import { z } from 'zod'
import { parseJobData } from '../http/validation.js'
import { CampaignService } from './campaign.service.js'
import type { CampaignResult } from './campaign.service.js'

/** Zod ceiling on requested campaign size; just above the library's bulk cap. */
const MAX_CAMPAIGN_SIZE = 1200

/** Body accepted by `POST /campaigns/receipts`. */
const campaignSchema = z.object({
  count: z.number().int().positive().max(MAX_CAMPAIGN_SIZE),
})

/** Enqueue surface for bulk receipt campaigns. */
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaign: CampaignService) {}

  /**
   * Bulk-enqueue a receipt campaign.
   *
   * @param body - Unvalidated request body; parsed against the campaign schema.
   * @returns The number enqueued and the created job ids.
   * @throws {QueueException} `queue.invalid_job_data` (400) for a bad payload, or
   *   `queue.bulk_enqueue_failed` (500) when the batch exceeds the library cap.
   */
  @Post('receipts')
  async receipts(@Body() body: unknown): Promise<CampaignResult> {
    const { count } = parseJobData(campaignSchema, body)
    return this.campaign.sendReceipts(count)
  }
}
