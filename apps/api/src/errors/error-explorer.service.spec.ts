/**
 * Unit tests for ErrorExplorerService.
 *
 * Layer: unit.
 * Goal: every reproducible trigger runs its real failing operation and lets the
 * library's stable envelope propagate; the catalog is complete; the fallback fires
 * when an operation unexpectedly resolves.
 * Mocks: a real AdminQueuesService over a spied QueueService (getJob/upsert/bulk),
 * plus a spied WorkerRegistry. parseJobData and forRoot run for real.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import type { Job, QueueService, WorkerRegistry } from '@bymax-one/nest-queue'
import { AdminQueuesService } from '../admin/queues.service.js'
import { ErrorExplorerService } from './error-explorer.service.js'

/** Read the stable error code off a thrown QueueException. */
function codeOf(error: unknown): string {
  const response = (error as QueueException).getResponse()
  return (response as { error: { code: string } }).error.code
}

/**
 * Build the service over a real AdminQueuesService and spied collaborators.
 *
 * @returns The service and its spies.
 */
function setup() {
  const getJob = jest.fn<QueueService['getJob']>().mockResolvedValue(null)
  const upsertJobScheduler = jest.fn<QueueService['upsertJobScheduler']>()
  const enqueueBulk = jest.fn<QueueService['enqueueBulk']>()
  const getOrCreateQueue = jest.fn()
  const queueService = {
    getJob,
    upsertJobScheduler,
    enqueueBulk,
    getOrCreateQueue,
  } as unknown as QueueService
  const adminQueues = new AdminQueuesService(queueService)
  const list = jest.fn<WorkerRegistry['list']>().mockReturnValue(['email'])
  const register = jest.fn<WorkerRegistry['register']>()
  const workers = { list, register } as unknown as WorkerRegistry
  const service = new ErrorExplorerService(adminQueues, queueService, workers)
  return { service, getJob, upsertJobScheduler, enqueueBulk, list, register }
}

describe('ErrorExplorerService (unit)', () => {
  it('exposes the full catalog', () => {
    /*
     * Scenario: catalog delegation.
     * Rule it protects: the service surfaces every code so the controller can list
     * the whole catalog.
     */
    expect(setup().service.catalog().length).toBe(Object.keys(QUEUE_ERROR_CODES).length)
  })

  it('triggers queue_not_found via the real allow-list guard', async () => {
    /*
     * Scenario: asking for an unregistered queue.
     * Rule it protects: the consumer guard raises the stable queue_not_found (404)
     * envelope, not a fabricated one.
     */
    const { service } = setup()
    const error = await service.trigger(QUEUE_ERROR_CODES.QUEUE_NOT_FOUND).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(QueueException)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.QUEUE_NOT_FOUND)
  })

  it('triggers job_not_found after a real null getJob', async () => {
    /*
     * Scenario: looking up a missing job.
     * Rule it protects: getJob returning null drives the consumer to raise
     * job_not_found (the library never throws it itself).
     */
    const { service, getJob } = setup()
    const error = await service.trigger(QUEUE_ERROR_CODES.JOB_NOT_FOUND).catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.JOB_NOT_FOUND)
    expect(getJob).toHaveBeenCalledWith('audit', 'errors-explorer-missing-job')
  })

  it('triggers invalid_job_data through the real schema guard', async () => {
    /*
     * Scenario: enqueue payload that fails validation.
     * Rule it protects: the zod guard raises the library's invalid_job_data (400).
     */
    const { service } = setup()
    const error = await service.trigger(QUEUE_ERROR_CODES.INVALID_JOB_DATA).catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.INVALID_JOB_DATA)
  })

  it.each([
    [0, { pattern: '0 3 * * *', every: 60_000 }],
    [1, { every: 0 }],
    [2, { pattern: 'not-a-valid-cron-expression' }],
  ])(
    'triggers invalid_repeat_options variant %i with the expected shape',
    async (variant, shape) => {
      /*
       * Scenario: each structural repeat-option variant.
       * Rule it protects: the service forwards the exact invalid shape to
       * upsertJobScheduler on a managed queue, where the library rejects it.
       */
      const { service, upsertJobScheduler } = setup()
      upsertJobScheduler.mockRejectedValue(
        new QueueException(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, 400, {}),
      )
      const error = await service
        .trigger(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, variant)
        .catch((e: unknown) => e)
      expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS)
      expect(upsertJobScheduler).toHaveBeenCalledWith('audit', 'errors-explorer-scheduler', shape)
    },
  )

  it('triggers invalid_repeat_options variant 3 with a past end date', async () => {
    /*
     * Scenario: the past-endDate repeat variant.
     * Rule it protects: variant 3 forwards a pattern with an endDate in the past,
     * which the library rejects.
     */
    const { service, upsertJobScheduler } = setup()
    upsertJobScheduler.mockRejectedValue(
      new QueueException(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, 400, {}),
    )
    await service.trigger(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, 3).catch((e: unknown) => e)
    const call = upsertJobScheduler.mock.calls[0]
    expect(call?.[2]).toMatchObject({ pattern: '0 3 * * *' })
    expect((call?.[2] as { endDate: number }).endDate).toBeLessThan(Date.now())
  })

  it('triggers bulk_enqueue_failed with an oversized batch on a managed queue', async () => {
    /*
     * Scenario: a batch one job over the cap.
     * Rule it protects: the service submits 1001 jobs to a managed queue so the
     * library's bulk guard rejects the batch.
     */
    const { service, enqueueBulk } = setup()
    enqueueBulk.mockRejectedValue(
      new QueueException(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, 500, {}),
    )
    const error = await service
      .trigger(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED)
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED)
    expect(enqueueBulk.mock.calls[0]?.[0]).toBe('audit')
    expect(enqueueBulk.mock.calls[0]?.[1]).toHaveLength(1001)
  })

  it('triggers invalid_options through a real forRoot rejection', async () => {
    /*
     * Scenario: compiling module options the library rejects.
     * Rule it protects: forRoot validates synchronously and raises invalid_options
     * (500) without opening a connection.
     */
    const { service } = setup()
    const error = await service.trigger(QUEUE_ERROR_CODES.INVALID_OPTIONS).catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.INVALID_OPTIONS)
  })

  it('triggers duplicate_processor by colliding with a registered worker', async () => {
    /*
     * Scenario: registering a second worker for an already-registered queue.
     * Rule it protects: the service hits the library's duplicate guard on a real
     * registered queue, and the guard exception propagates.
     */
    const { service, register } = setup()
    register.mockImplementation((config) => {
      // The library never runs the handler (the guard fires first); exercise the
      // no-op here to confirm the service supplied a valid handler, then throw.
      void config.handler({} as Job)
      throw new QueueException(QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR, 500, { queueName: 'email' })
    })
    const error = await service
      .trigger(QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR)
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR)
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ queueName: 'email' }))
  })

  it('surfaces duplicate_processor defensively when no worker is registered', async () => {
    /*
     * Scenario: an impossible empty registry.
     * Rule it protects: with no worker to collide with, the service still returns the
     * duplicate code rather than a false success, and never calls register.
     */
    const { service, list, register } = setup()
    list.mockReturnValue([])
    const error = await service
      .trigger(QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR)
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.DUPLICATE_PROCESSOR)
    expect(register).not.toHaveBeenCalled()
  })

  it('surfaces the code when an operation unexpectedly resolves', async () => {
    /*
     * Scenario: a trigger operation resolves instead of raising.
     * Rule it protects: the fallback raises the code with a diagnostic reason so a
     * broken contract never returns a misleading success.
     */
    const { service, upsertJobScheduler } = setup()
    upsertJobScheduler.mockResolvedValue(undefined)
    const error = await service
      .trigger(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS)
      .catch((e: unknown) => e)
    expect(codeOf(error)).toBe(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS)
    expect((error as QueueException).getResponse()).toMatchObject({
      error: { details: { reason: 'operation did not raise' } },
    })
  })
})
