/**
 * @fileoverview Minimal JSON HTTP client for e2e specs, built on the platform
 * `fetch`. The full application already listens on a real TCP port (see
 * `test-app.ts`), so specs exercise the real HTTP stack rather than an in-process
 * request shim.
 * @layer test/support
 */

/** A decoded HTTP response: status plus the parsed JSON body. */
export interface JsonResponse<T> {
  /** HTTP status code. */
  status: number
  /** The parsed JSON response body. */
  body: T
}

/** Retry budget for a single request against a transient connection reset. */
const MAX_ATTEMPTS = 3
/** Delay between retry attempts, in milliseconds. */
const RETRY_DELAY_MS = 100

/**
 * Parse a response body as JSON. Every endpoint this client calls always
 * returns a JSON body on success, so an empty body is never legitimate; it
 * signals a truncated response (a transient reset under load) and is treated
 * as a retryable failure rather than silently becoming `undefined`.
 *
 * @param response - The fetch response to read.
 * @returns The parsed body.
 * @throws {Error} When the body is empty.
 */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (text.length === 0) {
    throw new Error(`Expected a JSON body from ${response.url}, got an empty response`)
  }
  return JSON.parse(text) as T
}

/**
 * Retry a bounded number of times against a transient network failure (a
 * reset connection or a truncated response). Only used for `GET`: it is
 * always safe to retry, unlike a `POST`/`PUT`/`DELETE` that may have already
 * mutated state on the server before the client failed to read its response.
 *
 * @param send - Performs one attempt: issues the request and reads the body.
 * @returns The status and parsed body from the first successful attempt.
 */
async function withGetRetry<T>(send: () => Promise<JsonResponse<T>>): Promise<JsonResponse<T>> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await send()
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
  throw lastError
}

/**
 * Issue a `GET` request and parse the JSON response, retrying a transient
 * connection failure since a `GET` is always safe to repeat.
 *
 * @param url - The absolute request URL.
 * @returns The status and parsed body.
 */
export function getJson<T>(url: string): Promise<JsonResponse<T>> {
  return withGetRetry(async () => {
    const response = await fetch(url)
    return { status: response.status, body: await readJson<T>(response) }
  })
}

/**
 * Issue a request carrying a JSON body (`POST`, `PUT`, `DELETE`, ...). Never
 * retried: the server may already have applied the mutation before a network
 * blip kept the client from reading the response, and retrying could double
 * an enqueue, a registration, or another non-idempotent side effect.
 *
 * @param method - The HTTP method.
 * @param url - The absolute request URL.
 * @param payload - The request body, JSON-encoded; omit for a body-less request.
 * @returns The status and parsed body.
 */
export async function sendJson<T>(
  method: string,
  url: string,
  payload?: unknown,
): Promise<JsonResponse<T>> {
  const init: RequestInit =
    payload === undefined
      ? { method }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
  const response = await fetch(url, init)
  return { status: response.status, body: await readJson<T>(response) }
}

/**
 * Issue a `POST` request carrying a JSON body.
 *
 * @param url - The absolute request URL.
 * @param payload - The request body, JSON-encoded.
 * @returns The status and parsed body.
 */
export function postJson<T>(url: string, payload?: unknown): Promise<JsonResponse<T>> {
  return sendJson<T>('POST', url, payload)
}

/**
 * Issue a `PUT` request carrying a JSON body.
 *
 * @param url - The absolute request URL.
 * @param payload - The request body, JSON-encoded.
 * @returns The status and parsed body.
 */
export function putJson<T>(url: string, payload?: unknown): Promise<JsonResponse<T>> {
  return sendJson<T>('PUT', url, payload)
}

/**
 * Issue a `DELETE` request.
 *
 * @param url - The absolute request URL.
 * @returns The status and parsed body.
 */
export function deleteJson<T>(url: string): Promise<JsonResponse<T>> {
  return sendJson<T>('DELETE', url)
}
