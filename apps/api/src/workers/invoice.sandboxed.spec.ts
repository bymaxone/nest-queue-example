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
    // Pin the exact digest for a fixed input: the sha256 algorithm, the hex encoding,
    // and the exact number of hashing rounds all fold into this value, so any change
    // to them (not just to the lines) produces a different checksum.
    expect(first.checksum).toBe('80f849ad5f65c0833a6c0b271d008a8f9be14200816322ee9fd7f896140d3cfb')
    // An elapsed span is far smaller than the process clock; a mutated `+` would make
    // durationMs ~2x performance.now(), so this pins the subtraction.
    expect(first.durationMs).toBeGreaterThanOrEqual(0)
    expect(first.durationMs).toBeLessThan(performance.now())
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
