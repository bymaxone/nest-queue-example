/**
 * @fileoverview E2E: the error explorer, triggering every reproducible
 * `QUEUE_ERROR_CODES` member for real over HTTP and asserting the stable
 * envelope. Covers spec §12 scenario 9 and matrix row 66 (the envelope) plus the
 * reproducible half of row 67 (the connection-bootstrap codes are covered by
 * `connection.e2e-spec.ts`).
 * @layer test/e2e
 */
import { QUEUE_ERROR_CODES } from '@bymax-one/nest-queue'
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { getJson, postJson } from './support/http.js'
import { REPRODUCIBLE_CODES, ERROR_HTTP_STATUS } from '../src/errors/error-catalog.js'
import type { CatalogEntry } from '../src/errors/error-catalog.js'

describe('errors (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp('errors')
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('lists every QUEUE_ERROR_CODES member with its status and reproducibility (row 66)', async () => {
    // Scenario: reading the full error catalog over real HTTP.
    // Rule it protects: the catalog is exhaustive over QUEUE_ERROR_CODES, so no
    // code is silently missing from the explorer.
    const response = await getJson<CatalogEntry[]>(`${testApp.baseUrl}/errors/catalog`)
    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(Object.keys(QUEUE_ERROR_CODES).length)
  })

  // Scenario: every reproducible code triggered through the real failing
  // operation, end to end over HTTP against real Redis.
  // Rule it protects: each trigger yields the stable { error: { code, message,
  // details } } envelope with the code's documented HTTP status (row 66, 67).
  it.each(REPRODUCIBLE_CODES)(
    'triggers %s for real and returns the stable error envelope',
    async (code) => {
      const response = await postJson<{ error: { code: string; message: string } }>(
        `${testApp.baseUrl}/errors/trigger/${code}`,
      )
      expect(response.status).toBe(ERROR_HTTP_STATUS[code])
      expect(response.body.error.code).toBe(code)
      expect(response.body.error.message).toEqual(expect.any(String))
    },
  )

  it('rejects triggering a non-reproducible code with a pointer to where it is covered', async () => {
    // Scenario: triggering a boot-time-only code (connection_timeout) through
    // the runtime error explorer.
    // Rule it protects: the explorer refuses with errors.not_reproducible and a
    // pointer to where the code is actually covered, never a false success.
    const response = await postJson<{ error: { code: string; details: { coveredBy: string } } }>(
      `${testApp.baseUrl}/errors/trigger/${QUEUE_ERROR_CODES.CONNECTION_TIMEOUT}`,
    )
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('errors.not_reproducible')
    expect(response.body.error.details.coveredBy).toContain('e2e')
  })

  it('404s triggering an unknown code', async () => {
    // Scenario: triggering a code that does not exist in the catalog at all.
    // Rule it protects: an unknown code 404s with errors.unknown_code rather
    // than being treated as a valid-but-uncovered one.
    const response = await postJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/errors/trigger/not-a-real-code`,
    )
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('errors.unknown_code')
  })
})
