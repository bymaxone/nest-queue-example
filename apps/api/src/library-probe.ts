/**
 * @fileoverview Compile-time proof that `@bymax-one/nest-queue` resolves through
 * its published `dist/` and `exports` map from the backend package, exercising
 * both subpaths: the server entry point (`.`) and the shared entry point
 * (`./shared`). The library is consumed as an external npm package via a local
 * `file:` link while it is unpublished; once it lands on npm the dependency
 * flips to `^0.1.0` with no import changes, because both resolve through the
 * same `exports` map. This module is intentionally runtime-inert and is
 * replaced by real NestJS wiring in a later stage.
 * @layer app/probe
 */

import { BymaxQueueModule, QueueService } from '@bymax-one/nest-queue'
import { JOB_STATUS, QUEUE_ERROR_CODES, type QueueMetrics } from '@bymax-one/nest-queue/shared'

/**
 * Server-subpath exports proven importable from the bare `.` entry point.
 *
 * Holding the classes as values (not only as types) proves the runtime export
 * resolves through `dist/server`, which is the surface a published consumer
 * would receive.
 */
export const serverSubpathProbe = {
  module: BymaxQueueModule,
  service: QueueService,
} as const

/**
 * Shared-subpath constants proven importable from `./shared`.
 *
 * These are zero-dependency values safe for any runtime, re-declared as a proof
 * that the backend can also reach the browser-safe surface.
 */
export const sharedSubpathProbe = {
  jobStatus: JOB_STATUS,
  errorCodes: QUEUE_ERROR_CODES,
} as const

/**
 * Type-level proof that the zero-dependency `QueueMetrics` shape resolves from
 * the shared subpath. Reserved for real metrics wiring in a later stage.
 */
export type QueueMetricsProbe = QueueMetrics
