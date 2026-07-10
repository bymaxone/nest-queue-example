/**
 * Unit tests for buildTelemetry.
 *
 * Layer: unit.
 * Goal: the telemetry instance is built through the dynamic-import seam, and the
 * default importer resolves the real bullmq-otel package.
 * Mocks: a fake importer for the spy path; the real dynamic import for the default.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Telemetry } from '@bymax-one/nest-queue'
import { buildTelemetry } from './telemetry.config.js'
import type { BullMqOtelModule, TelemetryImporter } from './telemetry.config.js'

describe('buildTelemetry (unit)', () => {
  it('constructs the telemetry instance from the injected importer', async () => {
    /*
     * Scenario: flag-on path with a spied importer.
     * Rule it protects: buildTelemetry loads the module through the seam and returns
     * a `new BullMQOtel(...)` instance, without a top-level import.
     */
    const instance = {} as Telemetry
    const BullMQOtel = jest
      .fn()
      .mockReturnValue(instance) as unknown as BullMqOtelModule['BullMQOtel']
    const importer = jest.fn<TelemetryImporter>().mockResolvedValue({ BullMQOtel })

    await expect(buildTelemetry(importer)).resolves.toBe(instance)
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('resolves the real bullmq-otel package through the default importer', async () => {
    /*
     * Scenario: the default importer (no argument).
     * Rule it protects: the default dynamic import loads the actual package and yields
     * a usable telemetry instance, covering the un-injected code path.
     */
    const telemetry = await buildTelemetry()
    expect(telemetry).toBeDefined()
    expect(telemetry.tracer).toBeDefined()
  })
})
