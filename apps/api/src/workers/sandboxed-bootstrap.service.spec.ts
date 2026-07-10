/**
 * Unit tests for SandboxedBootstrapService.
 *
 * Layer: unit.
 * Goal: bootstrap registers the sandboxed processor for the invoices queue with a
 * fixed built-artifact URL, concurrency 2, and the env-driven worker-thread flag.
 * Mocks: WorkerRegistry (registerSandboxed spy).
 */
import { jest } from '@jest/globals'
import type { WorkerRegistry } from '@bymax-one/nest-queue'
import type { AppEnv } from '../config/env.js'
import { SandboxedBootstrapService } from './sandboxed-bootstrap.service.js'

/** The config the service passes to registerSandboxed. */
interface SandboxedConfig {
  queueName: string
  processorFile: URL
  options: { concurrency: number; useWorkerThreads: boolean }
}

/** Build the service over a spied registry and an env with the given thread flag. */
function build(threads: boolean): {
  service: SandboxedBootstrapService
  registerSandboxed: jest.Mock
} {
  const registerSandboxed = jest.fn()
  const registry = { registerSandboxed } as unknown as WorkerRegistry
  const env = { INVOICE_WORKER_THREADS: threads } as unknown as AppEnv
  return { service: new SandboxedBootstrapService(registry, env), registerSandboxed }
}

describe('SandboxedBootstrapService (unit)', () => {
  it('registers the sandboxed processor with the built artifact and concurrency 2', () => {
    /*
     * Scenario: application bootstrap with threads disabled (the default).
     * Rule it protects: the fixed invoice.sandboxed.js artifact is registered for
     * the invoices queue at concurrency 2, and the processor path is never derived
     * from request input (row 49).
     */
    const { service, registerSandboxed } = build(false)

    service.onApplicationBootstrap()

    const config = registerSandboxed.mock.calls[0]?.[0] as SandboxedConfig
    expect(config.queueName).toBe('invoices')
    expect(config.processorFile).toBeInstanceOf(URL)
    expect(config.processorFile.pathname.endsWith('/invoice.sandboxed.js')).toBe(true)
    expect(config.options).toEqual({ concurrency: 2, useWorkerThreads: false })
  })

  it('propagates the worker-thread flag from the environment', () => {
    /*
     * Scenario: bootstrap with INVOICE_WORKER_THREADS enabled.
     * Rule it protects: the env toggle selects worker-thread mode over child
     * processes.
     */
    const { service, registerSandboxed } = build(true)

    service.onApplicationBootstrap()

    const config = registerSandboxed.mock.calls[0]?.[0] as SandboxedConfig
    expect(config.options.useWorkerThreads).toBe(true)
  })
})
