/**
 * @fileoverview Processor for the `audit` smoke queue. Deliberately declares no
 * explicit `concurrency`: this class is the living proof that the library logs a
 * warning at discovery and falls back to its default worker concurrency. The
 * handler records each job into the in-memory trail.
 * @layer app/processors
 */
import { Process, Processor } from '@bymax-one/nest-queue'
import type { Job } from '@bymax-one/nest-queue'
import { AuditTrail } from './audit-trail.service.js'
import type { AuditJobData } from './audit.types.js'

// No `concurrency` option is passed on purpose: the library emits a warning at
// worker-discovery time and falls back to its default concurrency. Keeping this
// queue unconfigured demonstrates that fallback path.
@Processor('audit')
export class AuditProcessor {
  constructor(private readonly trail: AuditTrail) {}

  /**
   * Record a processed job into the trail. Delivery is at-least-once, so this
   * handler stays side-effect-light and safe to run more than once for a job.
   *
   * @param job - The audit job whose payload is recorded.
   */
  @Process()
  record(job: Job<AuditJobData>): void {
    this.trail.append({ at: new Date().toISOString(), payload: job.data.payload })
  }
}
