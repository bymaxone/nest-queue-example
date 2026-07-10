/**
 * @fileoverview Provokes the library's `duplicate_processor` guard for real,
 * inside an isolated in-process module so the main app is never touched. The
 * guard (`WorkerRegistry.register` refusing a second worker for one queue) is the
 * exact check discovery runs when two `@Processor` decorators target the same
 * queue. The isolated context is always closed, so the probe never leaks the
 * Redis connections the library opened for it.
 * @layer app/errors
 */
import { HttpStatus } from '@nestjs/common'
import type { INestApplicationContext } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException, WorkerRegistry } from '@bymax-one/nest-queue'

/** Queue name used only inside the throwaway probe context. */
export const DUPLICATE_PROBE_QUEUE = 'errors-duplicate-probe'

/** Builds the isolated module context whose `WorkerRegistry` the probe drives. */
export type ProbeContextFactory = () => Promise<INestApplicationContext>

/** No-op handler for the probe workers; they never run (`autorun: false`). */
const PROBE_HANDLER = (): Promise<void> => Promise.resolve()

/**
 * Register two workers for one queue in a throwaway context to trigger the real
 * `duplicate_processor` guard, then tear the context down. The first registration
 * succeeds; the second hits `guardDuplicate` and throws the library's exception,
 * which propagates untouched.
 *
 * @param createContext - Factory that bootstraps the isolated module context.
 * @returns Never resolves; always throws the library's `QueueException`.
 * @throws {QueueException} `queue.duplicate_processor` (500) from the real guard.
 */
export async function provokeDuplicateProcessor(
  createContext: ProbeContextFactory,
): Promise<never> {
  const context = await createContext()
  try {
    const registry = context.get(WorkerRegistry)
    registry.register({
      queueName: DUPLICATE_PROBE_QUEUE,
      handler: PROBE_HANDLER,
      options: { autorun: false },
    })
    registry.register({
      queueName: DUPLICATE_PROBE_QUEUE,
      handler: PROBE_HANDLER,
      options: { autorun: false },
    })
    // Reached only if the guard failed to fire; surface the same code so the
    // catalog contract still holds rather than returning a misleading success.
    throw new QueueException(
      QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      {
        reason: 'duplicate guard did not fire',
      },
    )
  } finally {
    await context.close()
  }
}
