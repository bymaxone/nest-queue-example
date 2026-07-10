/**
 * @fileoverview Diagnostics endpoint. Reports the library's resolved connection
 * mode, a non-sensitive options snapshot, and the per-role retry policy that is
 * the library's signature correctness feature: the Queue role keeps ioredis'
 * default retries (fail-fast) while Worker/QueueEvents roles are forced to
 * `null`. Only retry values and roles are surfaced; the Redis URL, host, and
 * password are a credential surface and are never echoed.
 * @layer app/admin
 */
import { Controller, Get, Inject } from '@nestjs/common'
import {
  BYMAX_QUEUE_CONNECTION_MODE,
  BYMAX_QUEUE_OPTIONS,
  BYMAX_QUEUE_REDIS_CLIENT,
  WorkerRegistry,
} from '@bymax-one/nest-queue'
import type { BymaxQueueModuleOptions, QueueConnectionMode } from '@bymax-one/nest-queue'
import type { Redis } from 'ioredis'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'

/** Per-role retry policy and active connection shape (values, never credentials). */
export interface ConnectionDiagnostics {
  /** Resolved mode: `mode-a-byo` (shared client) or `mode-b-owned` (library opens it). */
  mode: QueueConnectionMode
  /** Mode B connection style requested via the environment. */
  style: AppEnv['QUEUE_CONNECTION_STYLE']
  /** `maxRetriesPerRequest` on the Queue-role client (fail-fast: a number, not null). */
  queueRoleMaxRetries: number | null
  /** `maxRetriesPerRequest` on a Worker-role connection (blocking: always null). */
  workerRoleMaxRetries: number | null
}

/** Non-sensitive projection of the resolved queue configuration. */
export interface DiagnosticsSnapshot {
  /** Resolved connection mode reported by the library. */
  mode: QueueConnectionMode
  /** Redis key prefix, if configured. */
  prefix: string | undefined
  /** Whether flow support is enabled. */
  flowsEnabled: boolean
  /** Whether metrics collection is enabled. */
  metricsEnabled: boolean
  /** Per-role retry policy and connection shape. */
  connection: ConnectionDiagnostics
}

/** Reports resolved queue configuration for operational visibility. */
@Controller('admin')
export class DiagnosticsController {
  constructor(
    @Inject(BYMAX_QUEUE_OPTIONS) private readonly options: BymaxQueueModuleOptions,
    @Inject(BYMAX_QUEUE_CONNECTION_MODE) private readonly mode: QueueConnectionMode,
    @Inject(BYMAX_QUEUE_REDIS_CLIENT) private readonly queueClient: Redis,
    private readonly workers: WorkerRegistry,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /**
   * GET /admin/diagnostics - resolved mode, feature flags, and the per-role retry
   * policy. Deliberately omits `connection` details so the Redis URL, host, and
   * password never appear in a response body.
   *
   * @returns The non-sensitive configuration snapshot.
   */
  @Get('diagnostics')
  diagnostics(): DiagnosticsSnapshot {
    return {
      mode: this.mode,
      prefix: this.options.prefix,
      flowsEnabled: this.options.flows?.enabled ?? false,
      metricsEnabled: this.options.metrics?.enabled ?? false,
      connection: {
        mode: this.mode,
        style: this.env.QUEUE_CONNECTION_STYLE,
        queueRoleMaxRetries: readMaxRetries(this.queueClient),
        workerRoleMaxRetries: this.readWorkerRoleMaxRetries(),
      },
    }
  }

  /**
   * Read the retry policy from a registered worker connection, proving the
   * blocking-role override resolves to `null`. Falls back to `null` (the contract
   * value) when no worker has been registered yet.
   *
   * @returns The Worker-role `maxRetriesPerRequest`, expected to be `null`.
   */
  private readWorkerRoleMaxRetries(): number | null {
    const [firstConnection] = this.workers.getConnections().values()
    return firstConnection === undefined ? null : readMaxRetries(firstConnection)
  }
}

/**
 * Extract only the retry count from a client's options, normalising `undefined`
 * to `null`. Never reads host, port, or password.
 *
 * @param client - The Redis client to inspect.
 * @returns The `maxRetriesPerRequest` value, or `null` when unset.
 */
function readMaxRetries(client: Redis): number | null {
  return client.options.maxRetriesPerRequest ?? null
}
