/**
 * @fileoverview The living error-code catalog. Projects the library's stable
 * `QUEUE_ERROR_CODES` map into an inspectable catalog carrying each code's HTTP
 * status, human message, who raises it (the library vs this consumer), whether it
 * is reproducible through a running app request, and where the non-reproducible
 * ones are covered. The status table mirrors the library's §12.2 mapping (the
 * library does not export a status map), extended with the two 503 opt-in codes.
 * @layer app/errors
 */
import { QUEUE_ERROR_CODES, QUEUE_ERROR_MESSAGES } from '@bymax-one/nest-queue'
import type { QueueErrorCode } from '@bymax-one/nest-queue'

/** Who raises a code: the library itself, or this consumer using the library's exception. */
export type ErrorOrigin = 'library' | 'consumer'

/** One catalog entry: everything the explorer needs to describe a code. */
export interface CatalogEntry {
  /** The stable, transport-independent error code. */
  code: QueueErrorCode
  /** Human-readable message from the library's message catalog. */
  message: string
  /** HTTP status the `QueueException` carries for this code. */
  httpStatus: number
  /** Whether a running-app request can provoke this code for real. */
  reproducibleHere: boolean
  /** Whether the library raises it, or the consumer raises it with the library's code. */
  raisedBy: ErrorOrigin
  /** How this code is exercised (the trigger route, or where else it is covered). */
  coveredBy: string
}

/**
 * HTTP status per code, mirroring the library's §12.2 catalog. The library keeps
 * this table internal (no exported status map), so the consumer restates it to
 * describe the catalog. `flow_disabled` / `metrics_disabled` are the library's
 * two opt-in 503 guards.
 */
export const ERROR_HTTP_STATUS: Record<QueueErrorCode, number> = {
  [QUEUE_ERROR_CODES.CONNECTION_INVALID]: 500,
  [QUEUE_ERROR_CODES.CONNECTION_REQUIRES_NULL_RETRIES]: 500,
  [QUEUE_ERROR_CODES.CONNECTION_TIMEOUT]: 500,
  [QUEUE_ERROR_CODES.QUEUE_NOT_FOUND]: 404,
  [QUEUE_ERROR_CODES.JOB_NOT_FOUND]: 404,
  [QUEUE_ERROR_CODES.INVALID_JOB_DATA]: 400,
  [QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS]: 400,
  [QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR]: 500,
  [QUEUE_ERROR_CODES.FLOW_DISABLED]: 503,
  [QUEUE_ERROR_CODES.METRICS_DISABLED]: 503,
  [QUEUE_ERROR_CODES.SHUTDOWN_TIMEOUT_EXCEEDED]: 500,
  [QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED]: 500,
  [QUEUE_ERROR_CODES.WORKER_REGISTRATION_FAILED]: 500,
  [QUEUE_ERROR_CODES.INVALID_OPTIONS]: 500,
}

/**
 * The codes the error explorer can provoke for real inside a running app. Every
 * other code is a boot/shutdown-time or feature-flag concern covered elsewhere.
 */
export const REPRODUCIBLE_CODES = [
  QUEUE_ERROR_CODES.QUEUE_NOT_FOUND,
  QUEUE_ERROR_CODES.JOB_NOT_FOUND,
  QUEUE_ERROR_CODES.INVALID_JOB_DATA,
  QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS,
  QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED,
  QUEUE_ERROR_CODES.INVALID_OPTIONS,
  QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR,
] as const

/** Union of the codes the explorer can trigger over HTTP. */
export type ReproducibleErrorCode = (typeof REPRODUCIBLE_CODES)[number]

/** Origin (library vs consumer) per code. */
const CODE_ORIGIN: Record<QueueErrorCode, ErrorOrigin> = {
  [QUEUE_ERROR_CODES.CONNECTION_INVALID]: 'library',
  [QUEUE_ERROR_CODES.CONNECTION_REQUIRES_NULL_RETRIES]: 'library',
  [QUEUE_ERROR_CODES.CONNECTION_TIMEOUT]: 'library',
  [QUEUE_ERROR_CODES.QUEUE_NOT_FOUND]: 'consumer',
  [QUEUE_ERROR_CODES.JOB_NOT_FOUND]: 'consumer',
  [QUEUE_ERROR_CODES.INVALID_JOB_DATA]: 'consumer',
  [QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS]: 'library',
  [QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR]: 'library',
  [QUEUE_ERROR_CODES.FLOW_DISABLED]: 'library',
  [QUEUE_ERROR_CODES.METRICS_DISABLED]: 'library',
  [QUEUE_ERROR_CODES.SHUTDOWN_TIMEOUT_EXCEEDED]: 'library',
  [QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED]: 'library',
  [QUEUE_ERROR_CODES.WORKER_REGISTRATION_FAILED]: 'library',
  [QUEUE_ERROR_CODES.INVALID_OPTIONS]: 'library',
}

/**
 * Where each code is covered. Reproducible codes name their trigger route in the
 * catalog builder; these notes describe the non-reproducible ones. Total over
 * every code so the lookup is exhaustive (no defensive fallback).
 */
const COVERAGE_NOTES: Record<QueueErrorCode, string> = {
  [QUEUE_ERROR_CODES.CONNECTION_INVALID]: 'e2e connection variants (boot-time)',
  [QUEUE_ERROR_CODES.CONNECTION_REQUIRES_NULL_RETRIES]: 'e2e connection variants (boot-time)',
  [QUEUE_ERROR_CODES.CONNECTION_TIMEOUT]: 'e2e connection variants (boot-time)',
  [QUEUE_ERROR_CODES.QUEUE_NOT_FOUND]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.JOB_NOT_FOUND]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.INVALID_JOB_DATA]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.FLOW_DISABLED]: 'library unit tests (this app enables flows)',
  [QUEUE_ERROR_CODES.METRICS_DISABLED]: 'library unit tests (this app enables metrics)',
  [QUEUE_ERROR_CODES.SHUTDOWN_TIMEOUT_EXCEEDED]: 'e2e shutdown variant (shutdown-time)',
  [QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED]: 'reproducible via the error explorer',
  [QUEUE_ERROR_CODES.WORKER_REGISTRATION_FAILED]:
    'workers surface (invalid options / bad processor file)',
  [QUEUE_ERROR_CODES.INVALID_OPTIONS]: 'reproducible via the error explorer',
}

/**
 * Narrow an arbitrary string to a reproducible code.
 *
 * @param code - The candidate code.
 * @returns `true` when the code can be triggered over HTTP.
 */
export function isReproducibleCode(code: string): code is ReproducibleErrorCode {
  return (REPRODUCIBLE_CODES as readonly string[]).includes(code)
}

/**
 * Build the full catalog: one entry for every value of `QUEUE_ERROR_CODES`.
 *
 * @param messages - Message source, defaulting to the library's message catalog.
 *   Injectable so tests can exercise the missing-message fallback.
 * @returns The catalog entries in declaration order.
 */
export function buildCatalog(
  messages: Record<string, string> = QUEUE_ERROR_MESSAGES,
): CatalogEntry[] {
  return Object.values(QUEUE_ERROR_CODES).map((code) => {
    const reproducibleHere = isReproducibleCode(code)
    return {
      code,
      message: messages[code] ?? 'Queue error',
      httpStatus: ERROR_HTTP_STATUS[code],
      reproducibleHere,
      raisedBy: CODE_ORIGIN[code],
      coveredBy: reproducibleHere ? `POST /errors/trigger/${code}` : COVERAGE_NOTES[code],
    }
  })
}
