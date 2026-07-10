/**
 * Unit tests for InvoicesController.
 *
 * Layer: unit.
 * Goal: the render endpoint validates input and enqueues onto the invoices queue,
 * and the lag endpoint mirrors the probe sample.
 * Mocks: QueueService.enqueue and LagProbe.sample (spies).
 */
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import type { Job, QueueService } from '@bymax-one/nest-queue'
import { InvoicesController } from './invoices.controller.js'
import { LagProbe } from './lag-probe.service.js'
import type { LagSample } from './lag-probe.service.js'

/** Build a controller over spied collaborators. */
function build(
  enqueue: jest.Mock,
  sample: LagSample = { meanMs: 1, maxMs: 2 },
): InvoicesController {
  const queueService = { enqueue } as unknown as QueueService
  const lagProbe = { sample: jest.fn(() => sample) } as unknown as LagProbe
  return new InvoicesController(queueService, lagProbe)
}

describe('InvoicesController (unit)', () => {
  it('enqueues an invoice render and returns the job id', async () => {
    /*
     * Scenario: a valid render request.
     * Rule it protects: the validated invoice id and lines are enqueued onto the
     * invoices queue for the sandboxed processor, and the job id is returned
     * (row 49).
     */
    const enqueue = jest.fn<() => Promise<Job>>().mockResolvedValue({ id: 'job-1' } as Job)
    const controller = build(enqueue)

    const result = await controller.render({ invoiceId: 'inv-1', lines: ['a', 'b'] })

    expect(enqueue).toHaveBeenCalledWith('invoices', 'render', {
      invoiceId: 'inv-1',
      lines: ['a', 'b'],
    })
    expect(result).toEqual({ invoiceId: 'inv-1', jobId: 'job-1' })
  })

  it('rejects a render with no lines at the boundary', async () => {
    /*
     * Boundary: an empty lines array.
     * Rule it protects: a render must carry at least one line; an empty request is
     * a safe 400.
     */
    const controller = build(jest.fn())

    await expect(controller.render({ invoiceId: 'inv-1', lines: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('returns the current event-loop-delay sample', () => {
    /*
     * Scenario: reading the lag probe.
     * Rule it protects: the endpoint mirrors the probe sample so the loop's
     * responsiveness during a render is observable.
     */
    const controller = build(jest.fn(), { meanMs: 3, maxMs: 7 })

    expect(controller.lag()).toEqual({ meanMs: 3, maxMs: 7 })
  })
})
