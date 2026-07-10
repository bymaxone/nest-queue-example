/**
 * @fileoverview Standalone sandboxed processor for CPU-bound invoice rendering.
 * BullMQ loads this file's default export in a separate process (or worker
 * thread), so it runs OFF the main event loop and has NO access to NestJS
 * dependency injection.
 *
 * Sandbox constraints (documented so consumers are not surprised):
 * - No DI and no app imports: everything the job needs arrives via `job.data`.
 * - Node built-ins only at runtime, so the compiled artifact is self-contained.
 * - Communication is over IPC, so `job.data` and the return value must be
 *   serializable.
 *
 * @layer app/workers
 */
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { SandboxedJob } from 'bullmq'

/**
 * Iterations of the hashing loop. Fixed CPU cost per render, chosen so a render
 * is substantial enough to demonstrate off-loop offloading yet fast in tests.
 */
const HASH_ROUNDS = 10_000

/** Payload of an invoice-render job. */
export interface InvoiceRenderData {
  /** Identifier of the invoice being rendered. */
  invoiceId: string
  /** The invoice line items folded into the checksum. */
  lines: string[]
}

/** Result of an invoice render: a deterministic checksum and the render duration. */
export interface InvoiceRenderResult {
  /** Identifier of the rendered invoice. */
  invoiceId: string
  /** Deterministic SHA-256 checksum over the invoice id and its lines. */
  checksum: string
  /** Wall-clock duration of the render in milliseconds. */
  durationMs: number
}

/**
 * Deterministically render an invoice by iteratively hashing its id and lines.
 * Pure and dependency-light: the same input always yields the same checksum, so
 * it is directly unit-testable without a sandbox.
 *
 * @param data - The invoice id and its line items.
 * @returns The invoice id, the checksum, and the wall-clock duration.
 */
export function renderInvoice(data: InvoiceRenderData): InvoiceRenderResult {
  const startedAt = performance.now()
  let digest = createHash('sha256').update(data.invoiceId).digest('hex')
  for (let round = 0; round < HASH_ROUNDS; round += 1) {
    const hash = createHash('sha256').update(digest)
    for (const line of data.lines) {
      hash.update(line)
    }
    digest = hash.digest('hex')
  }
  return { invoiceId: data.invoiceId, checksum: digest, durationMs: performance.now() - startedAt }
}

/**
 * Sandboxed entry point BullMQ invokes for each `invoices` job. Delegates to the
 * pure {@link renderInvoice} over the job payload.
 *
 * @param job - The sandboxed job carrying the invoice render payload.
 * @returns The render result.
 */
export default function handleInvoiceRender(
  job: SandboxedJob<InvoiceRenderData, InvoiceRenderResult>,
): Promise<InvoiceRenderResult> {
  return Promise.resolve(renderInvoice(job.data))
}
