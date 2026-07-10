/**
 * Unit tests for DiagnosticsController.
 *
 * Layer: unit.
 * Goal: the snapshot reports the resolved mode, feature flags, and the per-role
 * retry policy (queue fail-fast vs worker null), and never echoes the connection
 * credentials.
 * Mocks: literal options/mode/env plus a Redis client and WorkerRegistry stub.
 */
import 'reflect-metadata'
import type { BymaxQueueModuleOptions, WorkerRegistry } from '@bymax-one/nest-queue'
import type { Redis } from 'ioredis'
import { parseEnv } from '../config/env.js'
import { DiagnosticsController } from './diagnostics.controller.js'

/** A Redis stub exposing only the options the controller reads. */
function redisStub(maxRetriesPerRequest: number | null | undefined): Redis {
  return {
    options: { maxRetriesPerRequest, host: 'cache', password: 'supersecret' },
  } as unknown as Redis
}

/** A WorkerRegistry stub whose connections map is provided per test. */
function registryStub(connections: ReadonlyMap<string, Redis>): WorkerRegistry {
  return { getConnections: () => connections } as unknown as WorkerRegistry
}

/** Fully-configured options for the happy-path snapshot. */
const OPTIONS: BymaxQueueModuleOptions = {
  connection: { url: 'redis://user:supersecret@cache:6379/0' },
  prefix: 'nqex',
  flows: { enabled: true },
  metrics: { enabled: true, cacheTtlMs: 3000 },
}

describe('DiagnosticsController (unit)', () => {
  it('reports the resolved mode, flags, and the per-role retry policy', () => {
    /*
     * Scenario: Mode B url with a registered worker.
     * Rule it protects: the snapshot mirrors mode/prefix/flags and proves the split
     * (queue keeps a numeric retry budget, worker is null) read from live clients.
     */
    const controller = new DiagnosticsController(
      OPTIONS,
      'mode-b-owned',
      redisStub(20),
      registryStub(new Map([['email', redisStub(null)]])),
      parseEnv({ QUEUE_CONNECTION_STYLE: 'options' }),
    )

    expect(controller.diagnostics()).toEqual({
      mode: 'mode-b-owned',
      prefix: 'nqex',
      flowsEnabled: true,
      metricsEnabled: true,
      connection: {
        mode: 'mode-b-owned',
        style: 'options',
        queueRoleMaxRetries: 20,
        workerRoleMaxRetries: null,
      },
    })
  })

  it('falls back to null worker retries when no worker is registered', () => {
    /*
     * Scenario: diagnostics before any worker connection exists.
     * Rule it protects: the worker-role value defaults to the contract value (null)
     * rather than throwing on an empty connections map.
     */
    const controller = new DiagnosticsController(
      OPTIONS,
      'mode-a-byo',
      redisStub(20),
      registryStub(new Map()),
      parseEnv({}),
    )

    expect(controller.diagnostics().connection.workerRoleMaxRetries).toBeNull()
  })

  it('normalises an unset queue retry count to null', () => {
    /*
     * Scenario: a client whose maxRetriesPerRequest is undefined.
     * Rule it protects: the reader coerces undefined to null so the response type
     * stays `number | null`.
     */
    const controller = new DiagnosticsController(
      OPTIONS,
      'mode-b-owned',
      redisStub(undefined),
      registryStub(new Map([['email', redisStub(null)]])),
      parseEnv({}),
    )

    expect(controller.diagnostics().connection.queueRoleMaxRetries).toBeNull()
  })

  it('defaults the flags to false and never echoes the connection credentials', () => {
    /*
     * Scenario: minimal options with flows/metrics unset.
     * Rule it protects: the flags fall back to false and the response omits every
     * credential, so the Redis password and host never leak through diagnostics.
     */
    const controller = new DiagnosticsController(
      { connection: { url: 'redis://user:supersecret@cache:6379/0' }, prefix: 'nqex' },
      'mode-b-owned',
      redisStub(20),
      registryStub(new Map([['email', redisStub(null)]])),
      parseEnv({}),
    )

    const snapshot = controller.diagnostics()
    expect(snapshot).toMatchObject({ flowsEnabled: false, metricsEnabled: false })
    expect(JSON.stringify(snapshot)).not.toContain('supersecret')
    expect(JSON.stringify(snapshot)).not.toContain('cache')
  })
})
