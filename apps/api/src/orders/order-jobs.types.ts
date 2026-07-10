/**
 * @fileoverview Typed job-data and job-result contracts for the `email` queue
 * family (receipt and welcome notifications). Kept in one place per queue family
 * so the api DTOs and, later, the web app can mirror these shapes without ever
 * importing server code.
 * @layer app/orders
 */

/** Payload of a `send-receipt` job on the `email` queue. */
export interface ReceiptEmailJobData {
  /** Identifier of the order the receipt confirms. */
  orderId: string
  /** Destination email address. */
  to: string
  /** Order total amount in the demo's single currency unit. */
  total: number
}

/** Result returned by the `send-receipt` handler once the receipt is dispatched. */
export interface ReceiptEmailJobResult {
  /** Provider message id of the sent receipt. */
  messageId: string
}

/** Payload of a `send-welcome` job on the `email` queue. */
export interface WelcomeEmailJobData {
  /** Identifier of the user being onboarded. */
  userId: string
}

/** Result returned by the `send-welcome` handler once the welcome is dispatched. */
export interface WelcomeEmailJobResult {
  /** Provider message id of the sent welcome email. */
  messageId: string
}

/** Payload of an `order-created` job on the `webhooks` queue. */
export interface OrderCreatedWebhookJobData {
  /** Identifier of the order whose creation is being fanned out. */
  orderId: string
}

/** Result returned by the `order-created` webhook handler once delivery succeeds. */
export interface OrderCreatedWebhookJobResult {
  /** Identifier of the delivered order. */
  orderId: string
  /** Total attempts it took to deliver, including the successful one. */
  attempts: number
}
