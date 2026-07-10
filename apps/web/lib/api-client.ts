/**
 * @fileoverview Typed HTTP client for the queue API. Every failed response is
 * parsed against the library's stable error envelope
 * (`{ error: { code, message, details } }`) using `QUEUE_ERROR_CODES` from the
 * `./shared` subpath, so the UI can branch on a known code instead of a raw
 * message string.
 * @layer lib/api-client
 */
import { QUEUE_ERROR_CODES, type QueueErrorCode } from '@bymax-one/nest-queue/shared'
import { API_BASE_URL } from './constants'

/** All valid queue error codes as a set for runtime narrowing. */
const KNOWN_CODES = new Set<string>(Object.values(QUEUE_ERROR_CODES))

/** Shape of the library's stable error envelope. */
interface ErrorEnvelope {
  error: {
    code: string
    message: string
    details?: Record<string, unknown> | null
  }
}

/** Typed error thrown by the queue API. */
export class ApiError extends Error {
  /** The queue error code (one of QUEUE_ERROR_CODES), or 'UNKNOWN' for a non-conforming body. */
  readonly code: QueueErrorCode | 'UNKNOWN'
  /** HTTP status code from the response. */
  readonly status: number
  /** Optional structured details from the error body. */
  readonly details: Record<string, unknown> | null | undefined

  constructor(
    code: QueueErrorCode | 'UNKNOWN',
    message: string,
    status: number,
    details?: Record<string, unknown> | null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Narrows a raw code string to a known QueueErrorCode or 'UNKNOWN'. */
function toCode(raw: unknown): QueueErrorCode | 'UNKNOWN' {
  if (typeof raw === 'string' && KNOWN_CODES.has(raw)) return raw as QueueErrorCode
  return 'UNKNOWN'
}

/** Type guard for the library's error envelope shape. */
function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const candidate = (value as { error?: unknown }).error
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { code?: unknown }).code === 'string' &&
    typeof (candidate as { message?: unknown }).message === 'string'
  )
}

/** Parses a failed Response into an ApiError. */
async function parseError(res: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return new ApiError('UNKNOWN', `HTTP ${String(res.status)}`, res.status)
  }
  if (isErrorEnvelope(body)) {
    return new ApiError(toCode(body.error.code), body.error.message, res.status, body.error.details)
  }
  return new ApiError('UNKNOWN', `HTTP ${String(res.status)}`, res.status)
}

/** Core fetch wrapper: resolves on 2xx, rejects with ApiError otherwise. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // Only declare a JSON body when one is actually sent: setting Content-Type on
  // GETs and body-less requests forces a CORS preflight (dev runs cross-origin).
  if (init.body !== undefined && init.body !== null) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) throw await parseError(res)
  if (res.status === 204 || res.headers.get('Content-Length') === '0') return undefined as T
  return res.json() as Promise<T>
}

/** Issues a GET request. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

/** Issues a POST request with an optional JSON body. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

/** Issues a PUT request with a JSON body. */
export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

/** Issues a DELETE request. */
export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
