/**
 * @fileoverview Demos HTTP surface. Enqueues the deliberately slow `stall` job
 * used by the stalled-recovery journey and returns the demo id and job id so the
 * operator can follow the recovery on the event stream.
 * @layer app/demos
 */
import { randomUUID } from 'node:crypto'
import { Controller, Post } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { DEMOS_QUEUE } from '../queues/queue-names.js'
import { STALL_JOB } from './demo-jobs.constants.js'
import type { StallJobData, StallJobResult } from './demo-jobs.types.js'

/** Outcome of a stall-demo request: the demo id and the enqueued job id. */
export interface StallRequested {
  /** The server-generated demo run id. */
  demoId: string
  /** The enqueued stall job id. */
  jobId: string | undefined
}

/** Enqueues the stalled-recovery demo job. */
@Controller('demos')
export class DemosController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Enqueue a stall job for the recovery demo.
   *
   * @returns The generated demo id and the enqueued job id.
   */
  @Post('stall')
  async stall(): Promise<StallRequested> {
    const demoId = randomUUID()
    const job = await this.queueService.enqueue<StallJobData, StallJobResult>(
      DEMOS_QUEUE,
      STALL_JOB,
      { demoId },
    )
    return { demoId, jobId: job.id }
  }
}
