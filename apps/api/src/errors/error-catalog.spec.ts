/**
 * Unit tests for the error catalog.
 *
 * Layer: unit.
 * Goal: the catalog projects every QUEUE_ERROR_CODES member with the correct HTTP
 * status, origin, and reproducibility, and the reproducible guard narrows codes.
 * Mocks: none - the catalog is pure.
 */
import 'reflect-metadata'
import { QUEUE_ERROR_CODES } from '@bymax-one/nest-queue'
import {
  buildCatalog,
  ERROR_HTTP_STATUS,
  isReproducibleCode,
  REPRODUCIBLE_CODES,
} from './error-catalog.js'

describe('error catalog (unit)', () => {
  it('lists every QUEUE_ERROR_CODES member exactly once', () => {
    /*
     * Scenario: the full catalog.
     * Rule it protects: the catalog mirrors the library's code set (14 codes) so no
     * shipped code is silently missing from the explorer.
     */
    const catalog = buildCatalog()
    const codes = catalog.map((entry) => entry.code)
    expect(catalog).toHaveLength(Object.keys(QUEUE_ERROR_CODES).length)
    expect(new Set(codes).size).toBe(catalog.length)
    expect(codes).toEqual(Object.values(QUEUE_ERROR_CODES))
  })

  it('marks exactly the seven reproducible codes', () => {
    /*
     * Scenario: reproducibility flags.
     * Rule it protects: only the seven runtime-reproducible codes are flagged; the
     * boot/shutdown and feature-flag codes are not.
     */
    const reproducible = buildCatalog().filter((entry) => entry.reproducibleHere)
    expect(reproducible).toHaveLength(REPRODUCIBLE_CODES.length)
    expect(new Set(reproducible.map((entry) => entry.code))).toEqual(new Set(REPRODUCIBLE_CODES))
  })

  it('carries the library HTTP status per code', () => {
    /*
     * Scenario: status mapping.
     * Rule it protects: each entry's status matches the §12.2 table restated in
     * ERROR_HTTP_STATUS (404 not-found, 400 bad-request, 503 opt-in, 500 otherwise).
     */
    const byCode = new Map(buildCatalog().map((entry) => [entry.code, entry]))
    expect(byCode.get(QUEUE_ERROR_CODES.QUEUE_NOT_FOUND)?.httpStatus).toBe(404)
    expect(byCode.get(QUEUE_ERROR_CODES.INVALID_JOB_DATA)?.httpStatus).toBe(400)
    expect(byCode.get(QUEUE_ERROR_CODES.FLOW_DISABLED)?.httpStatus).toBe(503)
    expect(byCode.get(QUEUE_ERROR_CODES.INVALID_OPTIONS)?.httpStatus).toBe(
      ERROR_HTTP_STATUS[QUEUE_ERROR_CODES.INVALID_OPTIONS],
    )
  })

  it('attributes consumer-raised vs library-raised codes', () => {
    /*
     * Scenario: origin attribution.
     * Rule it protects: the codes the library never throws (queue/job not-found,
     * invalid-job-data) are attributed to the consumer; the rest to the library.
     */
    const byCode = new Map(buildCatalog().map((entry) => [entry.code, entry]))
    expect(byCode.get(QUEUE_ERROR_CODES.QUEUE_NOT_FOUND)?.raisedBy).toBe('consumer')
    expect(byCode.get(QUEUE_ERROR_CODES.JOB_NOT_FOUND)?.raisedBy).toBe('consumer')
    expect(byCode.get(QUEUE_ERROR_CODES.INVALID_JOB_DATA)?.raisedBy).toBe('consumer')
    expect(byCode.get(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS)?.raisedBy).toBe('library')
    expect(byCode.get(QUEUE_ERROR_CODES.CONNECTION_TIMEOUT)?.raisedBy).toBe('library')
  })

  it('names the trigger route for reproducible codes and a note otherwise', () => {
    /*
     * Scenario: coverage pointers.
     * Rule it protects: reproducible entries point at their trigger route while
     * non-reproducible ones carry a note about where they are covered instead.
     */
    const byCode = new Map(buildCatalog().map((entry) => [entry.code, entry]))
    expect(byCode.get(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED)?.coveredBy).toContain(
      'POST /errors/trigger/',
    )
    expect(byCode.get(QUEUE_ERROR_CODES.CONNECTION_TIMEOUT)?.coveredBy).toContain('e2e')
  })

  it('falls back to a generic message when the source lacks the code', () => {
    /*
     * Scenario: a message source missing every code.
     * Rule it protects: the builder never emits an empty message, defaulting to a
     * safe generic string.
     */
    const catalog = buildCatalog({})
    expect(catalog.every((entry) => entry.message === 'Queue error')).toBe(true)
  })

  it('narrows reproducible codes and rejects the rest', () => {
    /*
     * Scenario: the reproducible type guard.
     * Rule it protects: only reproducible codes pass, so the controller cannot
     * dispatch a boot-time or unknown code into a trigger.
     */
    expect(isReproducibleCode(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED)).toBe(true)
    expect(isReproducibleCode(QUEUE_ERROR_CODES.CONNECTION_TIMEOUT)).toBe(false)
    expect(isReproducibleCode('totally.unknown')).toBe(false)
  })
})
