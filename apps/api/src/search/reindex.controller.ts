/**
 * @fileoverview Search reindex HTTP surface. Thin controller: validate the body
 * at the trust boundary and delegate to the deduplication lab service.
 * @layer app/search
 */
import { Body, Controller, Post } from '@nestjs/common'
import { z } from 'zod'
import { parseJobData } from '../http/validation.js'
import { ReindexService } from './reindex.service.js'
import type { ReindexResult } from './reindex.service.js'
import { DEDUP_MODES } from './search.constants.js'

/** Maximum accepted search-term length; a demo guardrail against absurd input. */
const MAX_TERM_LENGTH = 128

/** Body accepted by `POST /search/reindex`. */
const reindexSchema = z.object({
  term: z.string().min(1).max(MAX_TERM_LENGTH),
  mode: z.enum(DEDUP_MODES),
})

/** Enqueue surface for the deduplication laboratory. */
@Controller('search')
export class ReindexController {
  constructor(private readonly reindex: ReindexService) {}

  /**
   * Enqueue a reindex under the requested deduplication mode.
   *
   * @param body - Unvalidated request body; parsed against the reindex schema.
   * @returns The job id and whether the enqueue was deduplicated.
   * @throws {QueueException} `queue.invalid_job_data` (400) for a bad payload.
   */
  @Post('reindex')
  async trigger(@Body() body: unknown): Promise<ReindexResult> {
    return this.reindex.reindex(parseJobData(reindexSchema, body))
  }
}
