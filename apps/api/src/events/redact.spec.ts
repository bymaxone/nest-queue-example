/**
 * Unit tests for redact.
 *
 * Layer: unit.
 * Goal: sensitive keys are masked at any depth while the shape is preserved and
 * primitives pass through unchanged.
 * Mocks: none.
 */
import { redact } from './redact.js'

describe('redact (unit)', () => {
  it('masks sensitive top-level keys and keeps the rest', () => {
    /*
     * Scenario: a flat job payload with a contact address.
     * Rule it protects: the `to` value is masked while non-sensitive fields stay,
     * so the feed never streams the address.
     */
    expect(redact({ orderId: 'o1', to: 'x@example.com', total: 5 })).toEqual({
      orderId: 'o1',
      to: '[redacted]',
      total: 5,
    })
  })

  it('masks sensitive keys inside nested objects', () => {
    /*
     * Scenario: a payload nesting a secret.
     * Rule it protects: redaction recurses so a nested `token` cannot leak.
     */
    expect(redact({ meta: { token: 'abc', label: 'ok' } })).toEqual({
      meta: { token: '[redacted]', label: 'ok' },
    })
  })

  it('redacts array elements', () => {
    /*
     * Scenario: an array of records.
     * Rule it protects: each element is redacted independently.
     */
    expect(redact([{ password: 'p' }, { id: 1 }])).toEqual([{ password: '[redacted]' }, { id: 1 }])
  })

  it('returns primitives and null unchanged', () => {
    /*
     * Boundary: non-object inputs.
     * Rule it protects: primitives pass through so scalar return values are intact.
     */
    expect(redact(42)).toBe(42)
    expect(redact('plain')).toBe('plain')
    expect(redact(null)).toBeNull()
  })
})
