/**
 * @fileoverview Canonical queue and job names for the fulfillment flow. The flow
 * builder, the node processors, and the tree reader all reference this single
 * source of truth so a node's queue and job name are declared exactly once.
 * @layer app/flows
 */

/** Concurrency for every flow-node worker: nodes are light, so a small pool suffices. */
export const FLOW_NODE_CONCURRENCY = 2

/** Queue carrying the flow root (`ship-order`) and the `render-invoice` branch. */
export const FULFILLMENT_QUEUE = 'fulfillment'

/** Queue carrying the stock-reservation child. */
export const STOCK_QUEUE = 'stock'

/** Queue carrying the payment-charge child. */
export const PAYMENTS_QUEUE = 'payments'

/** Queue carrying the two invoice data-fetch grandchildren. */
export const INVOICES_DATA_QUEUE = 'invoices-data'

/** Root job: ships the order once every descendant has completed. */
export const SHIP_ORDER_JOB = 'ship-order'

/** Child job: reserves stock for the order. */
export const RESERVE_STOCK_JOB = 'reserve-stock'

/** Child job: charges payment for the order (the failure-injection node). */
export const CHARGE_PAYMENT_JOB = 'charge-payment'

/** Child job: renders the invoice; parents the two data-fetch grandchildren. */
export const RENDER_INVOICE_JOB = 'render-invoice'

/** Grandchild job: fetches the invoice line items. */
export const FETCH_LINES_JOB = 'fetch-lines'

/** Grandchild job: fetches the invoice customer record. */
export const FETCH_CUSTOMER_JOB = 'fetch-customer'
