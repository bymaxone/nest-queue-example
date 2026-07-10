/**
 * Unit tests for SmokeController.
 *
 * Layer: unit.
 * Goal: enqueue validates the body, delegates a typed job to QueueService, and
 * returns the job id; a bad body is rejected; list returns the trail.
 * Mocks: QueueService.enqueue and AuditTrail.list.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import type { AuditTrail } from '../processors/audit-trail.service.js'
import type { AuditEntry } from '../processors/audit.types.js'
import { SmokeController } from './smoke.controller.js'

/**
 * Build the controller with mocked collaborators. The generic `enqueue` is mocked
 * with an `unknown` data param (its default instantiation) so the mock stays
 * assignable to the library's generic method type.
 *
 * @returns The controller plus the enqueue and list spies.
 */
function setup() {
  const enqueue = jest.fn<(queueName: string, jobName: string, data: unknown) => Promise<Job>>()
  const list = jest.fn<AuditTrail['list']>()
  const queueService: Partial<QueueService> = { enqueue }
  const auditTrail: Partial<AuditTrail> = { list }
  const controller = new SmokeController(queueService as QueueService, auditTrail as AuditTrail)
  return { controller, enqueue, list }
}

describe('SmokeController (unit)', () => {
  it('enqueues a typed audit job and returns the job id', async () => {
    /*
     * Scenario: a valid payload.
     * Rule it protects: the controller enqueues an `audit`/`entry` job carrying the
     * typed payload and returns the created job id.
     */
    const { controller, enqueue } = setup()
    enqueue.mockResolvedValue({ id: 'job-1' } as Partial<Job> as Job)

    const result = await controller.enqueue({ payload: 'hi' })

    expect(enqueue).toHaveBeenCalledWith('audit', 'entry', { payload: 'hi' })
    expect(result).toEqual({ id: 'job-1' })
  })

  it('rejects a malformed body with 400 before enqueuing', async () => {
    /*
     * Scenario: a body missing the payload field.
     * Rule it protects: the boundary schema rejects invalid input with a
     * BadRequestException and never reaches the queue.
     */
    const { controller, enqueue } = setup()

    const error = await controller.enqueue({}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BadRequestException)
    // The 400 states the exact constraint so a blanked message cannot pass unnoticed.
    expect((error as BadRequestException).message).toBe(
      'payload must be a non-empty string of at most 1000 characters',
    )
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('lists the processed audit entries', () => {
    /*
     * Scenario: reading the trail.
     * Rule it protects: the controller returns exactly what the trail exposes.
     */
    const { controller, list } = setup()
    const entries: readonly AuditEntry[] = [{ at: 't', payload: 'x' }]
    list.mockReturnValue(entries)

    expect(controller.list()).toBe(entries)
  })
})
