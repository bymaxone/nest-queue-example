/**
 * Unit tests for HeartbeatProcessor.
 *
 * Layer: unit.
 * Goal: the catch-all handler records every monitoring job it processes.
 * Mocks: HeartbeatTicks (record spy).
 */
import { jest } from '@jest/globals'
import type { Job } from '@bymax-one/nest-queue'
import { HeartbeatProcessor } from './heartbeat.processor.js'
import { HeartbeatTicks } from './heartbeat-ticks.service.js'

describe('HeartbeatProcessor (unit)', () => {
  it('records the job name of every monitoring tick', () => {
    /*
     * Scenario: a scheduled monitoring job fires.
     * Rule it protects: a catch-all handler records both the heartbeat and the
     * metrics-snapshot firings so the scheduler clock is observable.
     */
    const record = jest.fn()
    const processor = new HeartbeatProcessor({ record } as unknown as HeartbeatTicks)

    processor.tick({ name: 'heartbeat' } as unknown as Job)

    expect(record).toHaveBeenCalledWith('heartbeat')
  })
})
