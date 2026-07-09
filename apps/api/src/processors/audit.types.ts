/**
 * @fileoverview Shared shapes for the audit smoke queue: the typed job payload
 * and the in-memory trail entry.
 * @layer app/processors
 */

/** Typed payload of an `audit`/`entry` job. */
export interface AuditJobData {
  /** Arbitrary short text recorded by the smoke journey. */
  payload: string
}

/** A single processed audit entry stored in the in-memory trail. */
export interface AuditEntry {
  /** ISO 8601 timestamp of when the handler processed the job. */
  at: string
  /** The payload carried by the processed job. */
  payload: string
}
