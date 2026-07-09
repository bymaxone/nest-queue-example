/**
 * Unit tests for QueuesController.
 *
 * Layer: unit.
 * Goal: list delegates to metrics; jobs validates the status/pagination query and
 * delegates (rejecting a bad status); pause/resume/clean return confirmations and
 * delegate with parsed, defaulted arguments.
 * Mocks: AdminQueuesService methods.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import type { QueueMetrics } from '@bymax-one/nest-queue'
import { QueuesController } from './queues.controller.js'
import type { AdminQueuesService, JobView } from './queues.service.js'

/**
 * Build the controller with a mocked admin service.
 *
 * @returns The controller plus every delegated spy.
 */
function setup() {
  const collectMetrics = jest.fn<AdminQueuesService['collectMetrics']>()
  const listJobs = jest.fn<AdminQueuesService['listJobs']>()
  const pause = jest.fn<AdminQueuesService['pause']>()
  const resume = jest.fn<AdminQueuesService['resume']>()
  const clean = jest.fn<AdminQueuesService['clean']>()
  const service: Partial<AdminQueuesService> = { collectMetrics, listJobs, pause, resume, clean }
  const controller = new QueuesController(service as AdminQueuesService)
  return { controller, collectMetrics, listJobs, pause, resume, clean }
}

describe('QueuesController (unit)', () => {
  it('lists queues with their metrics', async () => {
    /*
     * Scenario: the overview request.
     * Rule it protects: the controller returns the direct metrics snapshot.
     */
    const { controller, collectMetrics } = setup()
    const metrics = [{ queue: 'email' }] as unknown as QueueMetrics[]
    collectMetrics.mockResolvedValue(metrics)

    expect(await controller.list()).toBe(metrics)
  })

  it('parses the jobs query with pagination defaults and delegates', async () => {
    /*
     * Scenario: a status filter with no explicit window.
     * Rule it protects: start/end default to 0/50 and the parsed values reach the
     * service.
     */
    const { controller, listJobs } = setup()
    const views: JobView[] = []
    listJobs.mockResolvedValue(views)

    const result = await controller.jobs('email', { status: 'waiting' })

    expect(listJobs).toHaveBeenCalledWith('email', 'waiting', 0, 50)
    expect(result).toBe(views)
  })

  it('rejects an invalid job status with a safe 400', async () => {
    /*
     * Scenario: a status outside the JOB_STATUS set.
     * Rule it protects: the boundary schema rejects it before the service runs.
     */
    const { controller, listJobs } = setup()

    await expect(controller.jobs('email', { status: 'bogus' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(listJobs).not.toHaveBeenCalled()
  })

  it('pauses and resumes a queue', async () => {
    /*
     * Scenario: pausing then resuming.
     * Rule it protects: each action delegates and returns its confirmation flag.
     */
    const { controller, pause, resume } = setup()
    pause.mockResolvedValue(undefined)
    resume.mockResolvedValue(undefined)

    expect(await controller.pause('email')).toEqual({ paused: true })
    expect(await controller.resume('email')).toEqual({ resumed: true })
    expect(pause).toHaveBeenCalledWith('email')
    expect(resume).toHaveBeenCalledWith('email')
  })

  it('cleans a queue with defaulted options and returns removed ids', async () => {
    /*
     * Scenario: a clean with no explicit options.
     * Rule it protects: grace/limit default to 0 and status to completed, and the
     * removed ids are returned.
     */
    const { controller, clean } = setup()
    clean.mockResolvedValue(['1'])

    const result = await controller.clean('email', {})

    expect(clean).toHaveBeenCalledWith('email', 0, 0, 'completed')
    expect(result).toEqual({ removed: ['1'] })
  })
})
