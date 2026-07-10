/**
 * @fileoverview Registers the sandboxed invoice processor at application bootstrap.
 * The processor is a BUILT artifact (`invoice.sandboxed.js`) resolved relative to
 * this compiled module, so the path is fixed and never derived from request input,
 * ruling out path traversal or arbitrary-file execution. Worker-thread mode is an
 * opt-in via the environment.
 * @layer app/workers
 */
import { Inject, Injectable } from '@nestjs/common'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { WorkerRegistry } from '@bymax-one/nest-queue'
import { APP_ENV } from '../config/env.js'
import type { AppEnv } from '../config/env.js'
import { INVOICES_QUEUE, SANDBOX_CONCURRENCY } from './invoice.constants.js'

/**
 * Resolve the compiled sandboxed processor artifact relative to this module. In
 * built (and dev) mode both files live side by side under `dist/workers`, so the
 * URL points at the emitted `invoice.sandboxed.js`.
 */
const PROCESSOR_FILE = new URL('./invoice.sandboxed.js', import.meta.url)

/** Registers the file-based, out-of-process invoice processor at boot. */
@Injectable()
export class SandboxedBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly registry: WorkerRegistry,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /**
   * Register the sandboxed processor once the application has started. The fixed
   * artifact path and the env-driven worker-thread toggle are the only inputs; no
   * request data reaches this registration.
   */
  onApplicationBootstrap(): void {
    this.registry.registerSandboxed({
      queueName: INVOICES_QUEUE,
      processorFile: PROCESSOR_FILE,
      options: {
        concurrency: SANDBOX_CONCURRENCY,
        useWorkerThreads: this.env.INVOICE_WORKER_THREADS,
      },
    })
  }
}
