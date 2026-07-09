/**
 * Unit tests for sleep.
 *
 * Layer: unit.
 * Goal: the helper resolves only after its delay elapses.
 * Mocks: fake timers to drive the delay deterministically.
 */
import { jest } from '@jest/globals'
import { sleep } from './sleep.js'

describe('sleep (unit)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves after the delay elapses', async () => {
    /*
     * Scenario: a 10ms sleep advanced by fake timers.
     * Rule it protects: the promise stays pending until the delay passes, then
     * resolves, so callers can stage work on a clock.
     */
    jest.useFakeTimers()
    let resolved = false
    const pending = sleep(10).then(() => {
      resolved = true
    })

    await jest.advanceTimersByTimeAsync(10)
    await pending

    expect(resolved).toBe(true)
  })
})
