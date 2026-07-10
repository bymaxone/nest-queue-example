/**
 * Unit tests for the trust-boundary validation helpers.
 *
 * Layer: unit.
 * Goal: valid input is returned parsed; invalid input raises the correct safe
 * envelope (queue.invalid_job_data for enqueue payloads, validation_failed for
 * other requests) carrying value-free field issues only.
 * Mocks: none (pure functions over zod schemas).
 */
import 'reflect-metadata'
import { BadRequestException, HttpStatus } from '@nestjs/common'
import { QueueException } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseJobData, parseRequest } from './validation.js'

/** A minimal schema exercising both a string and a numeric constraint. */
const schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() })

/** Envelope shape both helpers produce on failure. */
interface ErrorBody {
  error: { code: string; message: string; details: { issues: { path: string; message: string }[] } }
}

/**
 * Run `fn`, returning whatever it threw.
 *
 * @param fn - The thunk expected to throw.
 * @returns The caught error.
 */
function caught(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error('expected the function to throw')
}

describe('parseJobData (unit)', () => {
  it('returns the parsed payload for valid input', () => {
    /*
     * Scenario: a well-formed enqueue payload.
     * Rule it protects: valid data passes through, typed and untouched.
     */
    expect(parseJobData(schema, { name: 'ada', age: 3 })).toEqual({ name: 'ada', age: 3 })
  })

  it('raises the queue.invalid_job_data envelope for a bad payload', () => {
    /*
     * Scenario: wrong types for both fields.
     * Rule it protects: the library's INVALID_JOB_DATA code (400) is surfaced
     * with value-free field issues, never the offending values.
     */
    const error = caught(() => parseJobData(schema, { name: '', age: -1 }))

    expect(error).toBeInstanceOf(QueueException)
    const exception = error as QueueException
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    const body = exception.getResponse() as ErrorBody
    expect(body.error.code).toBe('queue.invalid_job_data')
    expect(body.error.details.issues.length).toBeGreaterThan(0)
    expect(body.error.details.issues[0]?.path).toBe('name')
  })
})

describe('parseRequest (unit)', () => {
  it('returns the parsed input for valid input', () => {
    /*
     * Scenario: a well-formed non-enqueue request.
     * Rule it protects: valid data passes through, typed and untouched.
     */
    expect(parseRequest(schema, { name: 'ada', age: 0 })).toEqual({ name: 'ada', age: 0 })
  })

  it('raises a validation_failed 400 envelope for invalid input', () => {
    /*
     * Scenario: a missing field.
     * Rule it protects: malformed requests get a safe 400 under the app-level
     * validation_failed code, with value-free issues only.
     */
    const error = caught(() => parseRequest(schema, { age: 2 }))

    expect(error).toBeInstanceOf(BadRequestException)
    const body = (error as BadRequestException).getResponse() as ErrorBody
    expect(body.error.code).toBe('validation_failed')
    expect(body.error.message).toBe('Request validation failed')
    expect(body.error.details.issues[0]?.path).toBe('name')
  })

  it('joins a nested issue path with dots', () => {
    /*
     * Scenario: a validation failure two levels deep in a nested object.
     * Rule it protects: multi-segment issue paths are joined with '.' (`address.zip`)
     * so the client can locate the exact field; a blank separator would collapse the
     * segments into an ambiguous key.
     */
    const nested = z.object({ address: z.object({ zip: z.string().min(1) }) })

    const error = caught(() => parseRequest(nested, { address: { zip: '' } }))

    const body = (error as BadRequestException).getResponse() as ErrorBody
    expect(body.error.details.issues[0]?.path).toBe('address.zip')
  })
})
