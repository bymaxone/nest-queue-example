/**
 * @fileoverview Redacts sensitive fields out of a job payload before it is placed
 * on the event feed. The Server-Sent Events stream is a demonstration surface, so
 * it must never leak addresses, secrets, or connection strings. Redaction is
 * recursive and matches by key name, replacing the value with a marker while
 * keeping the shape visible.
 * @layer app/events
 */

/** Marker substituted for the value of a sensitive key. */
const REDACTED = '[redacted]'

/**
 * Lower-cased key names whose values are masked. Covers the demo's contact
 * fields plus common secret-bearing names so a future payload cannot leak them.
 */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'to',
  'email',
  'password',
  'secret',
  'token',
  'authorization',
  'apikey',
  'connection',
  'url',
  'redisurl',
])

/** Narrow an unknown value to a plain (non-array) record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Return a copy of `value` with the values of sensitive keys masked. Arrays and
 * nested objects are redacted recursively; primitives are returned unchanged.
 *
 * @param value - The value to redact (typically a job payload).
 * @returns A redacted copy safe to serialize onto the event feed.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redact(item))
  }
  if (!isRecord(value)) {
    return value
  }
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(entry)
  }
  return result
}
