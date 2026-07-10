/**
 * @fileoverview Job-name constants for the `reports` queue, shared by the reports
 * producer and the report processor so the job name is declared exactly once.
 * @layer app/reports
 */

/** Job name for a long-running report-generation job. */
export const GENERATE_REPORT_JOB = 'generate'
