/**
 * @fileoverview Unit tests for the Tailwind class-merge helper.
 * @layer lib/utils.test
 */
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins multiple class strings with a space', () => {
    // Scenario: the common case of composing static classes.
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values (conditional classes)', () => {
    // Scenario: components pass `condition && 'class'` results, which may be
    // `false`, `undefined`, or `null` when the condition does not hold.
    expect(cn('a', undefined, null, '', 'c')).toBe('a c')
  })

  it('deduplicates conflicting Tailwind utilities, keeping the last one', () => {
    // Scenario: a caller overriding a base padding class must win, not stack.
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
