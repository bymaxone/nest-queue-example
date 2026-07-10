/**
 * @fileoverview Typed job-data and job-result contracts for the `demos` queue,
 * kept in one place so the producer and the stall processor share a single shape.
 * @layer app/demos
 */

/** Payload of a `stall` job on the `demos` queue. */
export interface StallJobData {
  /** Identifier correlating the demo run across its recovery attempts. */
  demoId: string
}

/** Result returned by the `stall` handler once the slow job finally completes. */
export interface StallJobResult {
  /** Identifier of the completed demo run. */
  demoId: string
  /** ISO 8601 timestamp of when the job completed (on the surviving worker). */
  completedAt: string
}
