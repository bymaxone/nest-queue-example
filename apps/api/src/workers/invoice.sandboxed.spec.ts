/**
 * Unit tests for the sandboxed invoice processor.
 *
 * Layer: unit.
 * Goal: rendering is deterministic (same input, same checksum), sensitive to the
 * lines, and the default export delegates to the pure renderer.
 * Mocks: none (pure function; imported directly, not through a sandbox).
 */
import type { SandboxedJob } from 'bullmq'
import handleInvoiceRender, { renderInvoice } from './invoice.sandboxed.js'
import type { InvoiceRenderData, InvoiceRenderResult } from './invoice.sandboxed.js'

describe('invoice.sandboxed (unit)', () => {
  it('produces a deterministic checksum for the same input', () => {
    /*
     * Scenario: rendering the same invoice twice.
     * Rule it protects: the checksum is a pure function of the id and lines, so a
     * redelivered job yields the same result (idempotent compute).
     */
    const data: InvoiceRenderData = { invoiceId: 'inv-1', lines: ['a', 'b', 'c'] }

    const first = renderInvoice(data)
    const second = renderInvoice(data)

    expect(first.invoiceId).toBe('inv-1')
    expect(first.checksum).toBe(second.checksum)
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(first.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('yields a different checksum when the lines change', () => {
    /*
     * Scenario: two invoices differing only by their lines.
     * Rule it protects: the lines are folded into the checksum, so different
     * content produces a different digest.
     */
    const base = renderInvoice({ invoiceId: 'inv-1', lines: ['a'] })
    const changed = renderInvoice({ invoiceId: 'inv-1', lines: ['b'] })

    expect(base.checksum).not.toBe(changed.checksum)
  })

  it('delegates the default export to the pure renderer', async () => {
    /*
     * Scenario: BullMQ invokes the sandboxed entry point.
     * Rule it protects: the default export renders over job.data and resolves the
     * same result the pure function returns.
     */
    const data: InvoiceRenderData = { invoiceId: 'inv-2', lines: ['x'] }
    const job = { data } as SandboxedJob<InvoiceRenderData, InvoiceRenderResult>

    const result = await handleInvoiceRender(job)

    expect(result.checksum).toBe(renderInvoice(data).checksum)
  })
})
