/**
 * @fileoverview Job-name constants for the `demos` queue, shared by the demos
 * producer and the stall processor so the job name is declared exactly once.
 * @layer app/demos
 */

/** Job name for the deliberately slow job used by the stalled-recovery demo. */
export const STALL_JOB = 'stall'
