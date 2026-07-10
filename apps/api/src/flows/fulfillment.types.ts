/**
 * @fileoverview Typed contracts for the fulfillment flow: the failure-propagation
 * variant union, the per-node job payload, and the serializable tree projection
 * returned by the tree endpoint. Kept free of server imports so the web app can
 * mirror these shapes later.
 * @layer app/flows
 */

/**
 * Failure-propagation posture selected when launching the flow.
 *
 * - `default`: happy path; every node succeeds and the root ships.
 * - `stuck`: the payment child exhausts its single attempt WITHOUT
 *   `failParentOnFailure`, so the root sits in `waiting-children` forever (the
 *   documented BullMQ pitfall).
 * - `failParent`: the payment child sets `failParentOnFailure: true`, so its
 *   failure fails the root.
 * - `ignoreDependency`: the payment child sets `ignoreDependencyOnFailure: true`,
 *   so the root proceeds despite the failed optional child.
 */
export type FulfillmentVariant = 'default' | 'stuck' | 'failParent' | 'ignoreDependency'

/** Payload shared by every fulfillment flow node: only the order id, no secrets. */
export interface FulfillmentNodeData {
  /** Identifier of the order the flow fulfills. */
  orderId: string
}

/** Result recorded by a flow node processor: the node (job) name that ran. */
export interface FulfillmentNodeResult {
  /** The flow node (job) name that executed. */
  node: string
}

/**
 * Serializable projection of a single flow-tree node. Carries only structural and
 * status fields, never `job.data`, so the tree response leaks nothing sensitive.
 */
export interface FlowTreeNode {
  /** The BullMQ job id of this node. */
  id: string | undefined
  /** The job name of this node (e.g. `ship-order`). */
  name: string
  /** The queue the node lives on. */
  queue: string
  /** The node's live BullMQ state (e.g. `waiting-children`, `completed`, `failed`). */
  status: string
  /** Child nodes, present when the node has descendants. */
  children: FlowTreeNode[]
}
