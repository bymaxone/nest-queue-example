/**
 * @fileoverview Optional OpenTelemetry wiring. When `QUEUE_OTEL=true` the queue
 * factory attaches a BullMQ `Telemetry` instance so trace context propagates from
 * `enqueue()` into handlers. `bullmq-otel` is an optional peer loaded ONLY behind
 * the flag: the import is dynamic and lives behind an injectable seam, so when the
 * flag is off the package is never loaded (asserted by a grep gate and a test).
 * @layer app/config
 */
import type { Telemetry } from '@bymax-one/nest-queue'

/** Service name attached to every span the telemetry instance produces. */
const SERVICE_NAME = 'nest-queue-example-api'

/** The subset of `bullmq-otel` this app constructs. */
export interface BullMqOtelModule {
  /** Telemetry implementation backed by OpenTelemetry. */
  BullMQOtel: new (serviceName?: string) => Telemetry
}

/** Loads `bullmq-otel` lazily; injectable so tests can spy the seam. */
export type TelemetryImporter = () => Promise<BullMqOtelModule>

/** Produces a telemetry instance; injectable so the queue factory can spy it. */
export type TelemetryBuilder = () => Promise<Telemetry>

/** Default dynamic import; the only place `bullmq-otel` is referenced. */
const importBullMqOtel: TelemetryImporter = () => import('bullmq-otel')

/**
 * Build a BullMQ telemetry instance from the optional `bullmq-otel` peer. The
 * import is deferred to call time so the package loads only when telemetry is on.
 *
 * @param importer - The module loader, defaulting to the real dynamic import.
 * @returns A telemetry instance to attach to every Queue and Worker.
 */
export async function buildTelemetry(
  importer: TelemetryImporter = importBullMqOtel,
): Promise<Telemetry> {
  const { BullMQOtel } = await importer()
  return new BullMQOtel(SERVICE_NAME)
}
