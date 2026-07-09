/**
 * Unit tests for AuditProcessor.
 *
 * Layer: unit.
 * Goal: the handler records the job payload with an ISO timestamp into the trail.
 * Mocks: AuditTrail.append (spy); Date#toISOString pinned for a deterministic timestamp.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { AuditProcessor } from './audit.processor.js'
import type { AuditTrail } from './audit-trail.service.js'
import type { AuditJobData } from './audit.types.js'

/**
 * Build the processor with a spyable trail.
 *
 * @returns The processor and the append spy.
 */
function setup() {
  const append = jest.fn<AuditTrail['append']>()
  const trail: Partial<AuditTrail> = { append }
  const processor = new AuditProcessor(trail as AuditTrail)
  return { processor, append }
}

describe('AuditProcessor (unit)', () => {
  it('records the job payload with an ISO timestamp', () => {
    /*
     * Scenario: a job flows through the handler.
     * Rule it protects: the handler appends `{ at, payload }` using the job's
     * payload and the current time as an ISO string.
     */
    const { processor, append } = setup()
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')
    const job = { data: { payload: 'hello' } } as Job<AuditJobData>

    processor.record(job)

    expect(append).toHaveBeenCalledWith({ at: '2026-07-09T00:00:00.000Z', payload: 'hello' })
  })
})
