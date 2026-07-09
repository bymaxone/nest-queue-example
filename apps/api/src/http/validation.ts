/**
 * @fileoverview Trust-boundary validation helpers. Every controller parses its
 * unknown request payload through one of these before touching a service, so no
 * unvalidated value ever reaches the queue. Failures return a safe, stable error
 * envelope carrying field paths and messages only, never the offending values,
 * secrets, or a stack trace.
 * @layer app/http
 */
import { BadRequestException, HttpStatus } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import type { ZodError, ZodType } from 'zod'

/** A single, value-free validation problem: where it failed and why. */
export interface ValidationIssue {
  /** Dotted path to the offending field (empty string for the root). */
  path: string
  /** Human-readable reason, produced by zod and free of the input value. */
  message: string
}

/**
 * Project the zod error into value-free issues safe to return to a client.
 *
 * @param error - The zod validation error.
 * @returns One issue per problem, carrying only the field path and message.
 */
function toIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }))
}

/**
 * Validate an enqueue payload at the trust boundary. On failure this raises the
 * library's stable `queue.invalid_job_data` envelope (400): the example wires
 * schema validation so the code the library reserves for bad payloads is surfaced
 * from the consumer side, exactly as the spec documents (§18 note 4).
 *
 * @param schema - The zod schema describing the accepted payload.
 * @param input - The unknown request payload.
 * @returns The parsed, typed payload.
 * @throws {QueueException} `queue.invalid_job_data` (400) when validation fails.
 */
export function parseJobData<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) {
    return result.data
  }
  throw new QueueException(QUEUE_ERROR_CODES.INVALID_JOB_DATA, HttpStatus.BAD_REQUEST, {
    issues: toIssues(result.error),
  })
}

/**
 * Validate a non-enqueue request (query string, path, or control body) at the
 * trust boundary. On failure this raises a 400 in the same `{ error }` envelope
 * shape the library uses, under the app-level `validation_failed` code.
 *
 * @param schema - The zod schema describing the accepted input.
 * @param input - The unknown request input.
 * @returns The parsed, typed input.
 * @throws {BadRequestException} A safe 400 envelope when validation fails.
 */
export function parseRequest<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) {
    return result.data
  }
  throw new BadRequestException({
    error: {
      code: 'validation_failed',
      message: 'Request validation failed',
      details: { issues: toIssues(result.error) },
    },
  })
}
