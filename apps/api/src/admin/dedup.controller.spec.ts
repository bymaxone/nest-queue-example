/**
 * Unit tests for DedupController.
 *
 * Layer: unit.
 * Goal: the inspector reads and clears a dedup key via the managed queue's native
 * methods, bounding the key at the boundary.
 * Mocks: AdminQueuesService.getManagedQueue returning a stub queue.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { DedupController } from './dedup.controller.js'
import type { AdminQueuesService } from './queues.service.js'

/**
 * Build the controller with a mocked admin service whose managed queue exposes
 * the native deduplication inspection methods.
 *
 * @returns The controller plus the getDeduplicationJobId and removeDeduplicationKey spies.
 */
function setup() {
  const getDeduplicationJobId = jest.fn<(id: string) => Promise<string | null>>()
  const removeDeduplicationKey = jest.fn<(id: string) => Promise<number>>()
  const getManagedQueue = jest.fn(() => ({ getDeduplicationJobId, removeDeduplicationKey }))
  const adminQueues: Partial<AdminQueuesService> = {
    getManagedQueue: getManagedQueue as unknown as AdminQueuesService['getManagedQueue'],
  }
  const controller = new DedupController(adminQueues as AdminQueuesService)
  return { controller, getManagedQueue, getDeduplicationJobId, removeDeduplicationKey }
}

describe('DedupController (unit)', () => {
  it('returns the registered dedup job id', async () => {
    /*
     * Scenario: an active dedup key.
     * Rule it protects: the controller returns the native getDeduplicationJobId result.
     */
    const { controller, getManagedQueue, getDeduplicationJobId } = setup()
    getDeduplicationJobId.mockResolvedValue('j1')

    const result = await controller.view('search', 'reindex:widgets')

    expect(getManagedQueue).toHaveBeenCalledWith('search')
    expect(getDeduplicationJobId).toHaveBeenCalledWith('reindex:widgets')
    expect(result).toEqual({ jobId: 'j1' })
  })

  it('returns null when the dedup key is not set', async () => {
    /*
     * Scenario: no active dedup key.
     * Rule it protects: absence is reported as null rather than an error.
     */
    const { controller, getDeduplicationJobId } = setup()
    getDeduplicationJobId.mockResolvedValue(null)

    expect(await controller.view('search', 'reindex:widgets')).toEqual({ jobId: null })
  })

  it('rejects a malformed dedup key before touching the queue', async () => {
    /*
     * Scenario: an over-long key.
     * Rule it protects: the boundary schema rejects it with a safe 400.
     */
    const { controller, getManagedQueue } = setup()

    await expect(controller.view('search', 'x'.repeat(300))).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(getManagedQueue).not.toHaveBeenCalled()
  })

  it('reports removed:true when a key was cleared', async () => {
    /*
     * Scenario: clearing an existing key.
     * Rule it protects: a positive removal count maps to removed:true.
     */
    const { controller, removeDeduplicationKey } = setup()
    removeDeduplicationKey.mockResolvedValue(1)

    expect(await controller.clear('search', 'reindex:widgets')).toEqual({ removed: true })
  })

  it('reports removed:false when no key existed', async () => {
    /*
     * Scenario: clearing a missing key.
     * Rule it protects: a zero removal count maps to removed:false.
     */
    const { controller, removeDeduplicationKey } = setup()
    removeDeduplicationKey.mockResolvedValue(0)

    expect(await controller.clear('search', 'reindex:widgets')).toEqual({ removed: false })
  })
})
