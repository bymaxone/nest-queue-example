/**
 * @fileoverview Canonical queue name, job name, and concurrency for the sandboxed
 * invoice processor. The bootstrap registrar and the render endpoint reference
 * this single source of truth.
 * @layer app/workers
 */

/** Queue the sandboxed invoice processor consumes. */
export const INVOICES_QUEUE = 'invoices'

/** Job name for an invoice-render job. */
export const INVOICE_RENDER_JOB = 'render'

/** Concurrency for the sandboxed processor: CPU work stays low and scales by process. */
export const SANDBOX_CONCURRENCY = 2
