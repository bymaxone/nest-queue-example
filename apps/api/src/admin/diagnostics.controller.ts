/**
 * @fileoverview Diagnostics endpoint. Reports the library's resolved connection
 * mode and a non-sensitive options snapshot by injecting the queue module's
 * Symbol tokens. The Redis connection (URL/password) is a credential surface and
 * is never echoed.
 * @layer app/admin
 */
import { Controller, Get, Inject } from '@nestjs/common'
import { BYMAX_QUEUE_CONNECTION_MODE, BYMAX_QUEUE_OPTIONS } from '@bymax-one/nest-queue'
import type { BymaxQueueModuleOptions, QueueConnectionMode } from '@bymax-one/nest-queue'

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
}

/** Reports resolved queue configuration for operational visibility. */
@Controller('admin')
export class DiagnosticsController {
  constructor(
    @Inject(BYMAX_QUEUE_OPTIONS) private readonly options: BymaxQueueModuleOptions,
    @Inject(BYMAX_QUEUE_CONNECTION_MODE) private readonly mode: QueueConnectionMode,
  ) {}

  /**
   * GET /admin/diagnostics - resolved mode plus the enabled feature flags.
   * Deliberately omits `connection` so the Redis URL and password never appear
   * in a response body.
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
    }
  }
}
