/**
 * @fileoverview Boots an isolated instance of the real application for e2e specs.
 * Every spec file gets its own Redis key prefix (and its own ephemeral HTTP port),
 * so specs never observe each other's queues, jobs, or schedulers even though they
 * all share one Redis instance. Environment variables are set on `process.env`
 * immediately before the app boots, because {@link parseEnv} (in `config/env.ts`)
 * reads `process.env` lazily inside a Nest factory provider, not at import time.
 * @layer test/support
 */
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { AppModule } from '../../src/app.module.js'

/** A booted application instance ready to receive HTTP requests. */
export interface TestApp {
  /** The underlying Nest application (shutdown hooks enabled). */
  app: INestApplication
  /** Base URL of the listening HTTP server, e.g. `http://127.0.0.1:54213`. */
  baseUrl: string
  /** The Redis key prefix this instance was booted with. */
  prefix: string
  /** Close the application, running the library's ordered graceful shutdown. */
  close: () => Promise<void>
}

/** Redis URL used when the suite does not override it. Matches `docker-compose.yml`. */
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379/0'

/**
 * Resolve the Redis URL the e2e suite connects to. `E2E_REDIS_URL` lets a local
 * run point at an alternate port when 6379 is already bound on a shared machine,
 * without editing the committed `docker-compose.yml`.
 *
 * @returns The Redis connection URL for e2e specs.
 */
export function e2eRedisUrl(): string {
  return process.env.E2E_REDIS_URL ?? DEFAULT_REDIS_URL
}

/**
 * Baseline environment applied to every spec-owned app instance before its own
 * overrides. Keeps every spec deterministic regardless of what a previous spec
 * file left on `process.env` in the same worker.
 *
 * @param prefix - The unique Redis key prefix for this instance.
 */
function baseEnv(prefix: string): Record<string, string> {
  return {
    REDIS_URL: e2eRedisUrl(),
    QUEUE_PREFIX: prefix,
    QUEUE_CONNECTION_MODE: 'own',
    QUEUE_CONNECTION_STYLE: 'url',
    QUEUE_OTEL: 'false',
    QUEUE_DRAIN_ON_SHUTDOWN: 'false',
    QUEUE_DRAIN_TIMEOUT_MS: '30000',
    WEBHOOK_FAILURES: '2',
    REMINDER_DELAY_MS: '60000',
    INVOICE_WORKER_THREADS: 'false',
  }
}

/**
 * Boot a full application instance (the real `AppModule`, real Redis, real
 * workers) with a spec-unique queue prefix and an ephemeral HTTP port.
 *
 * @param specName - Short spec identifier folded into the queue prefix, so a
 *   Redis key dump is traceable to the spec that produced it.
 * @param envOverrides - Extra environment overrides applied after the baseline
 *   (for example a tight `QUEUE_DRAIN_TIMEOUT_MS` in the shutdown spec).
 * @returns The booted, listening test application.
 */
export async function createTestApp(
  specName: string,
  envOverrides: Record<string, string> = {},
): Promise<TestApp> {
  const prefix = `e2e-${specName}-${randomUUID().slice(0, 8)}`
  const env = { ...baseEnv(prefix), ...envOverrides }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication()
  app.enableShutdownHooks()
  await app.listen(0)
  const address = app.getHttpServer().address() as AddressInfo
  return {
    app,
    prefix,
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () => app.close(),
  }
}
