/**
 * @fileoverview Compile-time proof that the browser-facing package can consume
 * `@bymax-one/nest-queue` through the zero-dependency `./shared` subpath ONLY,
 * never the server subpath. The load-bearing part of this proof is what is
 * absent: this package declares none of the library's server peers (NestJS,
 * BullMQ, ioredis, reflect-metadata), so server-only code can never reach the
 * client bundle. This module verifies the shared surface still resolves without
 * them. Runtime-inert; replaced by the real dashboard data layer in a later
 * stage.
 * @layer web/probe
 */

import {
  JOB_STATUS,
  QUEUE_ERROR_CODES,
  type JobSchedulerRepeatOptions,
  type JobStatus,
  type QueueMetrics,
} from '@bymax-one/nest-queue/shared'

/**
 * Zero-dependency constants proven importable from `./shared` in a package that
 * declares none of the server peers.
 */
export const sharedConstantsProbe = {
  jobStatus: JOB_STATUS,
  errorCodes: QUEUE_ERROR_CODES,
} as const

/**
 * Zero-dependency types proven importable from `./shared`, reserved for the
 * dashboard's typed views of job state, queue metrics, and scheduler options.
 */
export interface SharedTypesProbe {
  status: JobStatus
  metrics: QueueMetrics
  schedule: JobSchedulerRepeatOptions
}
