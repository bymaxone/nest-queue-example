/**
 * @fileoverview Typed job-data and job-result contracts for the `reports` queue,
 * kept in one place so the api producer and, later, the web app can mirror these
 * shapes without importing server code.
 * @layer app/reports
 */

/** Payload of a `generate` job on the `reports` queue. */
export interface ReportJobData {
  /** Identifier of the report being generated. */
  reportId: string
}

/** Result returned by the `generate` handler once the report finishes. */
export interface ReportJobResult {
  /** Identifier of the generated report. */
  reportId: string
  /** Wall-clock duration of the generation in milliseconds. */
  durationMs: number
}
