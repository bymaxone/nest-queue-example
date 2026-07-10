/**
 * Unit tests for the duplicate-processor probe.
 *
 * Layer: unit.
 * Goal: the probe double-registers a worker in an isolated context, lets the real
 * guard exception propagate, always closes the context, and surfaces the code even
 * if the guard fails to fire.
 * Mocks: a fake application context whose WorkerRegistry is driven per scenario.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { HttpStatus } from '@nestjs/common'
import type { INestApplicationContext } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import { provokeDuplicateProcessor } from './duplicate-probe.js'

/**
 * Build a fake context whose WorkerRegistry uses the given register spy.
 *
 * @param register - The spy backing `WorkerRegistry.register`.
 * @returns The fake context and its close spy.
 */
function fakeContext(register: jest.Mock) {
  const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const context = { get: () => ({ register }), close } as unknown as INestApplicationContext
  return { context, close }
}

describe('provokeDuplicateProcessor (unit)', () => {
  it('propagates the real duplicate guard exception and closes the context', async () => {
    /*
     * Scenario: the second register hits the guard.
     * Rule it protects: the library's DUPLICATE_PROCESSOR exception propagates
     * untouched and the isolated context is torn down (no leaked connections).
     */
    const guardError = new QueueException(
      QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      {
        queueName: 'errors-duplicate-probe',
      },
    )
    const register = jest
      .fn()
      .mockImplementationOnce((config) => {
        // Exercise the probe's no-op handler so the first registration is realistic.
        void (config as { handler: () => Promise<void> }).handler()
      })
      .mockImplementationOnce(() => {
        throw guardError
      })
    const { context, close } = fakeContext(register)

    await expect(provokeDuplicateProcessor(() => Promise.resolve(context))).rejects.toBe(guardError)
    expect(register).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('surfaces the code and still closes when the guard fails to fire', async () => {
    /*
     * Scenario: both registrations unexpectedly succeed.
     * Rule it protects: the probe throws the duplicate code with a diagnostic reason
     * rather than returning a misleading success, and still closes the context.
     */
    const register = jest.fn().mockReturnValue(undefined)
    const { context, close } = fakeContext(register)

    const error = await provokeDuplicateProcessor(() => Promise.resolve(context)).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(QueueException)
    expect((error as QueueException).getResponse()).toMatchObject({
      error: {
        code: QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR,
        details: { reason: 'duplicate guard did not fire' },
      },
    })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
