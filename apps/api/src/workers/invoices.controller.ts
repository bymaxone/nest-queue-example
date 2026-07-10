/**
 * @fileoverview HTTP surface for the sandboxed invoice processor: enqueue a render
 * job (consumed off the main event loop) and read an event-loop-delay sample so
 * the loop's responsiveness during a render is observable. All input is validated
 * at the trust boundary before it reaches the queue.
 * @layer app/workers
 */
import { Body, Controller, Get, Post } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { INVOICES_QUEUE, INVOICE_RENDER_JOB } from './invoice.constants.js'
import type { InvoiceRenderData, InvoiceRenderResult } from './invoice.sandboxed.js'
import { LagProbe } from './lag-probe.service.js'
import type { LagSample } from './lag-probe.service.js'

/** Upper bound on an invoice id length; a demo guardrail against absurd input. */
const MAX_INVOICE_ID_LENGTH = 128

/**
 * Upper bound on the number of invoice lines per render. Bounds the per-job CPU
 * cost of the sandboxed hashing loop (rounds x lines) so a single request cannot
 * enqueue an unboundedly expensive job.
 */
const MAX_INVOICE_LINES = 1_000

/** Upper bound on a single invoice line length. */
const MAX_LINE_LENGTH = 512

/** Body accepted by the render endpoint. */
const renderSchema = z.object({
  invoiceId: z
    .string()
    .min(1)
    .max(MAX_INVOICE_ID_LENGTH)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  lines: z.array(z.string().max(MAX_LINE_LENGTH)).min(1).max(MAX_INVOICE_LINES),
})

/** Outcome of enqueuing an invoice render. */
export interface RenderRequested {
  /** The invoice being rendered. */
  invoiceId: string
  /** The enqueued render job id. */
  jobId: string | undefined
}

/** Enqueues sandboxed invoice renders and reports event-loop responsiveness. */
@Controller('workers')
export class InvoicesController {
  constructor(
    private readonly queueService: QueueService,
    private readonly lagProbe: LagProbe,
  ) {}

  /**
   * Enqueue an invoice render for the sandboxed processor to compute off-loop.
   *
   * @param body - The unknown request body carrying the invoice id and lines.
   * @returns The invoice id and the enqueued job id.
   * @throws {BadRequestException} When the body is malformed.
   */
  @Post('invoices/render')
  async render(@Body() body: unknown): Promise<RenderRequested> {
    const { invoiceId, lines } = parseRequest(renderSchema, body)
    const job = await this.queueService.enqueue<InvoiceRenderData, InvoiceRenderResult>(
      INVOICES_QUEUE,
      INVOICE_RENDER_JOB,
      { invoiceId, lines },
    )
    return { invoiceId, jobId: job.id }
  }

  /**
   * Return the current event-loop-delay sample, low while renders run out of
   * process.
   *
   * @returns The mean and maximum event-loop delay in milliseconds.
   */
  @Get('lag')
  lag(): LagSample {
    return this.lagProbe.sample()
  }
}
