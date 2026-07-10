/**
 * @fileoverview Test-only readers for the reflection metadata the library's
 * `@Processor`, `@Process`, `@OnWorkerEvent`, and `@OnQueueEvent` decorators
 * attach to a processor class. Unit specs construct processors directly (no Nest
 * DI container), so the decorator arguments — queue name, worker options, event
 * names, and job names — are otherwise unobservable; these helpers surface them
 * through sound type guards shared across every processor spec.
 *
 * Not production code: excluded from coverage collection and the Stryker mutate
 * scope so the 100% gate and mutation score stay meaningful.
 * @layer app/testing
 */
import 'reflect-metadata'
import type { WorkerOptions } from '@bymax-one/nest-queue'

/**
 * Narrowed view of the two `reflect-metadata` reader APIs used here. The library
 * types both as `any`; this laundering boundary narrows them to `unknown` so the
 * rest of the module stays fully type-checked.
 */
const reflect = Reflect as {
  getOwnMetadataKeys(target: object): unknown[]
  getOwnMetadata(metadataKey: unknown, target: object): unknown
}

/** The processor metadata the `@Processor` decorator attaches to a class. */
export interface ProcessorMetadata {
  queueName: string
  workerOptions: WorkerOptions
  _warnedNoConcurrency?: boolean
}

/** A worker- or queue-event listener entry recorded by an event decorator. */
export interface EventListenerEntry {
  eventName: string
  methodKey: string
}

/** A `@Process` handler entry; the catch-all handler carries no job name. */
export interface ProcessHandlerEntry {
  jobName?: string
  methodKey: string
}

/**
 * Narrow an unknown value to a plain (non-null) record.
 *
 * @param value - The value to test.
 * @returns True when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Narrow an unknown value to an array of unknown entries. Unlike `Array.isArray`,
 * this keeps the element type as `unknown` rather than widening it to `any`.
 *
 * @param value - The value to test.
 * @returns True when the value is an array.
 */
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Narrow an unknown value to processor metadata carrying a queue name and worker
 * options.
 *
 * @param value - The value to test.
 * @returns True when the value is processor metadata.
 */
function isProcessorMetadata(value: unknown): value is ProcessorMetadata {
  return (
    isRecord(value) &&
    typeof value.queueName === 'string' &&
    isRecord(value.workerOptions) &&
    (!('_warnedNoConcurrency' in value) || typeof value._warnedNoConcurrency === 'boolean')
  )
}

/**
 * Narrow an unknown value to an event-listener entry. Both the event name and the
 * method key must be strings, so an entry missing either field is rejected.
 *
 * @param entry - The value to test.
 * @returns True when the value is an event-listener entry.
 */
function isEventListenerEntry(entry: unknown): entry is EventListenerEntry {
  return (
    isRecord(entry) && typeof entry.eventName === 'string' && typeof entry.methodKey === 'string'
  )
}

/**
 * Narrow an unknown value to a `@Process` handler entry. Process entries carry a
 * string `methodKey` and no `eventName`, which distinguishes them from the
 * event-listener entries attached to the same class; a present `jobName` must be a
 * string.
 *
 * @param entry - The value to test.
 * @returns True when the value is a process-handler entry.
 */
function isProcessHandlerEntry(entry: unknown): entry is ProcessHandlerEntry {
  return (
    isRecord(entry) &&
    typeof entry.methodKey === 'string' &&
    !('eventName' in entry) &&
    (!('jobName' in entry) || typeof entry.jobName === 'string')
  )
}

/**
 * Scan a class's own reflection metadata for the first array whose every entry
 * satisfies the given guard.
 *
 * @param ctor - The processor class constructor.
 * @param guard - The entry type guard the array must satisfy.
 * @returns The first matching array, or an empty array when none matches.
 */
function readMetadataArray<T>(ctor: object, guard: (entry: unknown) => entry is T): T[] {
  for (const key of reflect.getOwnMetadataKeys(ctor)) {
    const value = reflect.getOwnMetadata(key, ctor)
    if (isUnknownArray(value) && value.every(guard)) {
      return value
    }
  }
  return []
}

/**
 * Scan a class's own reflection metadata for the first value satisfying the given
 * guard.
 *
 * @param ctor - The processor class constructor.
 * @param guard - The value type guard to satisfy.
 * @param notFoundMessage - The error message thrown when no value matches.
 * @returns The first matching value.
 */
function readMetadataObject<T>(
  ctor: object,
  guard: (value: unknown) => value is T,
  notFoundMessage: string,
): T {
  for (const key of reflect.getOwnMetadataKeys(ctor)) {
    const value = reflect.getOwnMetadata(key, ctor)
    if (guard(value)) {
      return value
    }
  }
  throw new Error(notFoundMessage)
}

/**
 * Read the processor metadata recorded by `@Processor` on a processor class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered processor metadata.
 */
export function readProcessorMetadata(ctor: object): ProcessorMetadata {
  return readMetadataObject(ctor, isProcessorMetadata, 'processor metadata not found')
}

/**
 * Read the worker options recorded by `@Processor` on a processor class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered worker options.
 */
export function readWorkerOptions(ctor: object): WorkerOptions {
  return readProcessorMetadata(ctor).workerOptions
}

/**
 * Read the worker-event-listener metadata (`eventName` + `methodKey`) attached by
 * the library's `@OnWorkerEvent` decorators. This surfaces each decorator's event
 * name, which a direct method call cannot observe.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered `{ eventName, methodKey }` entries.
 */
export function readWorkerEventListeners(ctor: object): EventListenerEntry[] {
  return readMetadataArray(ctor, isEventListenerEntry)
}

/**
 * Read the queue-event-listener metadata (`eventName` + `methodKey`) attached by
 * the library's `@OnQueueEvent` decorators. This surfaces each decorator's event
 * name, which a direct method call cannot observe.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered `{ eventName, methodKey }` entries.
 */
export function readQueueEventListeners(ctor: object): EventListenerEntry[] {
  return readMetadataArray(ctor, isEventListenerEntry)
}

/**
 * Read the `@Process` handler metadata attached to a processor class.
 *
 * @param ctor - The processor class constructor.
 * @returns The registered process-handler entries.
 */
export function readProcessHandlers(ctor: object): ProcessHandlerEntry[] {
  return readMetadataArray(ctor, isProcessHandlerEntry)
}
