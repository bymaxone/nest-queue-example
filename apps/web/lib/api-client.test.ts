/**
 * @fileoverview Unit tests for the typed HTTP client and its error envelope
 * parsing.
 * @layer lib/api-client.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from './api-client'

/** Builds a minimal Response-like object for a given status/json body. */
function fakeResponse(status: number, body: unknown, ok = status >= 200 && status < 300): Response {
  return {
    ok,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe('apiGet / apiPost / apiPut / apiDelete', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves with the parsed JSON body on a 2xx GET', async () => {
    // Scenario: the common success path every hook relies on.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { queue: 'email' }))
    await expect(apiGet<{ queue: string }>('/admin/queues')).resolves.toEqual({ queue: 'email' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3080/admin/queues',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('serializes the body and issues POST with a JSON body', async () => {
    // Scenario: enqueue-style actions send a JSON payload.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { jobId: '1' }))
    await apiPost('/orders', { to: 'a@b.c', total: 10 })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ to: 'a@b.c', total: 10 }))
  })

  it('omits the body on a POST with no payload', async () => {
    // Scenario: fire-and-forget POSTs (e.g. pause) carry no body at all.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { paused: true }))
    await apiPost('/admin/queues/email/pause')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })

  it('issues a PUT with a JSON body', async () => {
    // Scenario: scheduler upsert uses PUT with a required body.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { schedulerId: 'heartbeat' }))
    await apiPut('/schedulers/email/heartbeat', { repeat: { every: 1000 } })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ repeat: { every: 1000 } }))
  })

  it('issues a DELETE request', async () => {
    // Scenario: scheduler / tenant removal uses DELETE with no body.
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { removed: true }))
    await apiDelete('/schedulers/email/heartbeat')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
  })

  it('returns undefined for a 204 No Content response', async () => {
    // Scenario: some mutation endpoints reply with no body at all.
    fetchMock.mockResolvedValueOnce(fakeResponse(204, null))
    await expect(apiDelete('/schedulers/email/heartbeat')).resolves.toBeUndefined()
  })

  it('throws an ApiError carrying the known code, message, and details on failure', async () => {
    // Scenario: the library's stable envelope must surface as a typed error the
    // UI can branch on by code, e.g. queue.job_not_found.
    fetchMock.mockResolvedValueOnce(
      fakeResponse(404, {
        error: { code: 'queue.job_not_found', message: 'Job not found', details: { jobId: '1' } },
      }),
    )
    const failure = apiGet('/admin/jobs/email/1')
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({
      code: 'queue.job_not_found',
      message: 'Job not found',
      status: 404,
      details: { jobId: '1' },
    })
  })

  it('falls back to UNKNOWN for a code outside the known catalog', async () => {
    // Scenario: a future/unrecognized code must not crash the client; it
    // degrades to a safe 'UNKNOWN' rather than throwing during parsing.
    fetchMock.mockResolvedValueOnce(
      fakeResponse(500, { error: { code: 'not.a.real.code', message: 'oops' } }),
    )
    await expect(apiGet('/x')).rejects.toMatchObject({ code: 'UNKNOWN' })
  })

  it('falls back to a generic ApiError when the body is not the stable envelope', async () => {
    // Scenario: an upstream proxy error (e.g. a plain-text 502) has no JSON
    // envelope at all; the client must still surface a usable ApiError.
    fetchMock.mockResolvedValueOnce(fakeResponse(502, { message: 'bad gateway' }))
    await expect(apiGet('/x')).rejects.toMatchObject({ code: 'UNKNOWN', status: 502 })
  })

  it('falls back to a generic ApiError when the body is not valid JSON', async () => {
    // Scenario: a non-JSON failure body (e.g. an HTML error page from a proxy)
    // must not throw out of the parser itself.
    const res = {
      ok: false,
      status: 500,
      headers: new Headers(),
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response
    fetchMock.mockResolvedValueOnce(res)
    await expect(apiGet('/x')).rejects.toMatchObject({ code: 'UNKNOWN', status: 500 })
  })
})
