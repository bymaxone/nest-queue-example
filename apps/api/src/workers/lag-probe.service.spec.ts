/**
 * Unit tests for LagProbe.
 *
 * Layer: unit.
 * Goal: nanosecond readings convert to milliseconds (mapping non-finite readings
 * to zero), and the lifecycle enables/disables the histogram without leaking a
 * timer.
 * Mocks: none (real perf_hooks histogram, disabled after each test).
 */
import { LagProbe, toMs } from './lag-probe.service.js'

describe('toMs (unit)', () => {
  it('converts nanoseconds to milliseconds', () => {
    /*
     * Scenario: a finite histogram reading.
     * Rule it protects: nanosecond readings are scaled to milliseconds for the API.
     */
    expect(toMs(2_000_000)).toBe(2)
  })

  it('maps a non-finite reading to zero', () => {
    /*
     * Boundary: the histogram before it has collected any sample (NaN/Infinity).
     * Rule it protects: a non-finite reading never leaks into the response as NaN.
     */
    expect(toMs(Number.NaN)).toBe(0)
    expect(toMs(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('LagProbe (unit)', () => {
  it('samples the enabled histogram and reports finite milliseconds', () => {
    /*
     * Scenario: the probe is enabled at bootstrap and sampled.
     * Rule it protects: sample() returns finite mean and max delays in ms; the
     * histogram is disabled afterward so no libuv timer is leaked.
     */
    const probe = new LagProbe()
    probe.onApplicationBootstrap()

    const sample = probe.sample()

    expect(Number.isFinite(sample.meanMs)).toBe(true)
    expect(Number.isFinite(sample.maxMs)).toBe(true)

    probe.onModuleDestroy()
  })
})
