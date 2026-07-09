/**
 * Unit tests for DiagnosticsController.
 *
 * Layer: unit.
 * Goal: the snapshot reports the resolved mode and feature flags and never echoes
 * the connection credentials.
 * Mocks: none - the controller is constructed with literal options and a mode.
 */
import 'reflect-metadata'
import type { BymaxQueueModuleOptions } from '@bymax-one/nest-queue'
import { DiagnosticsController } from './diagnostics.controller.js'

describe('DiagnosticsController (unit)', () => {
  it('reports the resolved mode, prefix, and enabled flags', () => {
    /*
     * Scenario: fully-configured options.
     * Rule it protects: the snapshot mirrors the resolved mode, prefix, and the
     * flows/metrics enabled flags.
     */
    const options: BymaxQueueModuleOptions = {
      connection: { url: 'redis://user:supersecret@cache:6379/0' },
      prefix: 'nqex',
      flows: { enabled: true },
      metrics: { enabled: true, cacheTtlMs: 3000 },
    }
    const controller = new DiagnosticsController(options, 'mode-b-owned')

    expect(controller.diagnostics()).toEqual({
      mode: 'mode-b-owned',
      prefix: 'nqex',
      flowsEnabled: true,
      metricsEnabled: true,
    })
  })

  it('defaults the flags to false and never echoes the connection credentials', () => {
    /*
     * Scenario: minimal options with flows/metrics unset.
     * Rule it protects: the flags fall back to false (the `?? false` branches) and
     * the response omits `connection`, so the Redis password never leaks.
     */
    const options: BymaxQueueModuleOptions = {
      connection: { url: 'redis://user:supersecret@cache:6379/0' },
      prefix: 'nqex',
    }
    const controller = new DiagnosticsController(options, 'mode-b-owned')

    const snapshot = controller.diagnostics()
    expect(snapshot).toMatchObject({ flowsEnabled: false, metricsEnabled: false })
    expect(JSON.stringify(snapshot)).not.toContain('supersecret')
  })
})
