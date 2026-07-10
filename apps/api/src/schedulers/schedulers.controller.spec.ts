/**
 * Unit tests for SchedulersController.
 *
 * Layer: unit.
 * Goal: the controller lists/upserts/removes schedulers on allow-listed queues,
 * exposes the tick clock, validates input at the boundary, and surfaces the
 * library's invalid_repeat_options envelope for every bad-schedule trigger.
 * Mocks: QueueService (spies) and, for the validation triggers, the real
 * QueueService whose schedule validation short-circuits before Redis.
 */
import { jest } from '@jest/globals'
import { BadRequestException, HttpStatus } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException, QueueService } from '@bymax-one/nest-queue'
import type { Job, JobSchedulerJson } from '@bymax-one/nest-queue'
import { HeartbeatTicks } from './heartbeat-ticks.service.js'
import { SchedulersController } from './schedulers.controller.js'
import type { SchedulerTick } from './scheduler.types.js'

/** Concrete mock signatures, avoiding friction with the library's generic methods. */
type ListMock = (
  queue: string,
  start: number,
  end: number,
  asc: boolean,
) => Promise<JobSchedulerJson[]>
type UpsertMock = (
  queue: string,
  id: string,
  repeat: unknown,
  template?: unknown,
) => Promise<Job | undefined>
type RemoveMock = (queue: string, id: string) => Promise<boolean>

/** Build a controller over the given collaborators and tick store. */
function build(
  overrides: Record<string, unknown>,
  ticks?: readonly SchedulerTick[],
): SchedulersController {
  const store = { list: jest.fn(() => ticks ?? []) } as unknown as HeartbeatTicks
  return new SchedulersController(overrides as unknown as QueueService, store)
}

/** A real QueueService whose schedule validation runs before any Redis access. */
function realController(): SchedulersController {
  const service = new QueueService(
    {} as unknown as ConstructorParameters<typeof QueueService>[0],
    {} as unknown as ConstructorParameters<typeof QueueService>[1],
  )
  return build(service as unknown as Record<string, unknown>)
}

/** Assert a promise rejects with the stable invalid_repeat_options (400) envelope. */
async function expectInvalidRepeat(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(QueueException)
  await promise.catch((error: unknown) => {
    const exception = error as QueueException
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    const body = exception.getResponse() as { error: { code: string } }
    expect(body.error.code).toBe(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS)
  })
}

describe('SchedulersController (unit)', () => {
  it('lists schedulers with default pagination', async () => {
    /*
     * Scenario: a list request with only the queue.
     * Rule it protects: pagination defaults to the full first page ascending, and
     * the managed queue is forwarded to getJobSchedulers (row 61).
     */
    const getJobSchedulers = jest.fn<ListMock>().mockResolvedValue([])
    const controller = build({ getJobSchedulers })

    const result = await controller.list({ queue: 'monitoring' })

    expect(getJobSchedulers).toHaveBeenCalledWith('monitoring', 0, 50, true)
    expect(result).toEqual({ schedulers: [] })
  })

  it('coerces explicit pagination and sort from the query string', async () => {
    /*
     * Scenario: a list request with explicit start/end/asc as strings.
     * Rule it protects: query strings are coerced to the numeric page and boolean
     * sort the library expects.
     */
    const getJobSchedulers = jest.fn<ListMock>().mockResolvedValue([])
    const controller = build({ getJobSchedulers })

    await controller.list({ queue: 'maintenance', start: '5', end: '20', asc: 'false' })

    expect(getJobSchedulers).toHaveBeenCalledWith('maintenance', 5, 20, false)
  })

  it('rejects an unknown queue on list at the boundary', async () => {
    /*
     * Scenario: a list request for a queue outside the allow-list.
     * Rule it protects: the endpoint never touches an arbitrary Redis queue.
     */
    const controller = build({})

    await expect(controller.list({ queue: 'bogus' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('returns the recorded scheduler ticks', () => {
    /*
     * Scenario: reading the tick clock.
     * Rule it protects: the endpoint mirrors HeartbeatTicks.list so the scheduler
     * clock is observable.
     */
    const recorded: SchedulerTick[] = [{ job: 'heartbeat', at: 1 }]
    const controller = build({}, recorded)

    expect(controller.readTicks()).toEqual({ ticks: recorded })
  })

  it('upserts a scheduler and returns the first job id', async () => {
    /*
     * Scenario: a valid interval upsert with a template.
     * Rule it protects: the validated queue, id, repeat, and template reach the
     * library and the first scheduled job id is returned.
     */
    const upsertJobScheduler = jest.fn<UpsertMock>().mockResolvedValue({ id: 'job-1' } as Job)
    const controller = build({ upsertJobScheduler })

    const result = await controller.upsert('monitoring', 'demo', {
      repeat: { every: 60_000 },
      template: { name: 'x', data: { a: 1 } },
    })

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'monitoring',
      'demo',
      { every: 60_000 },
      { name: 'x', data: { a: 1 } },
    )
    expect(result).toEqual({ schedulerId: 'demo', firstJobId: 'job-1' })
  })

  it('forwards an empty template as an empty object, omitting unset keys', async () => {
    /*
     * Boundary: a template object with neither name nor data.
     * Rule it protects: only provided keys are forwarded, so an empty template
     * lets the library apply its own name/data defaults.
     */
    const upsertJobScheduler = jest.fn<UpsertMock>().mockResolvedValue({ id: 'j' } as Job)
    const controller = build({ upsertJobScheduler })

    await controller.upsert('monitoring', 'demo', { repeat: { every: 1_000 }, template: {} })

    expect(upsertJobScheduler).toHaveBeenCalledWith('monitoring', 'demo', { every: 1_000 }, {})
  })

  it('returns a null first job id when the library produced none', async () => {
    /*
     * Edge case: an upsert that yields no immediate job.
     * Rule it protects: a missing first job maps to null, never undefined.
     */
    const upsertJobScheduler = jest.fn<UpsertMock>().mockResolvedValue(undefined)
    const controller = build({ upsertJobScheduler })

    const result = await controller.upsert('monitoring', 'demo', { repeat: { every: 60_000 } })

    expect(result.firstJobId).toBeNull()
  })

  it('rejects an unknown queue and a malformed id on upsert', async () => {
    /*
     * Scenario: upsert targeting a non-managed queue or a malformed id.
     * Rule it protects: both are validated before the library is called.
     */
    const controller = build({})

    await expect(
      controller.upsert('bogus', 'demo', { repeat: { every: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      controller.upsert('monitoring', 'bad id', { repeat: { every: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('surfaces invalid_repeat_options when both pattern and every are given', async () => {
    /*
     * Validation trigger 1: both schedule kinds present.
     * Rule it protects: the boundary forwards the shape and the library raises the
     * stable envelope for a conflicting schedule (row 62).
     */
    await expectInvalidRepeat(
      realController().upsert('monitoring', 'demo', {
        repeat: { pattern: '0 3 * * *', every: 1_000 },
      }),
    )
  })

  it('surfaces invalid_repeat_options when neither pattern nor every is given', async () => {
    /*
     * Validation trigger 2: an empty schedule.
     * Rule it protects: exactly one schedule kind is required; the library rejects
     * an empty repeat (row 62).
     */
    await expectInvalidRepeat(realController().upsert('monitoring', 'demo', { repeat: {} }))
  })

  it('surfaces invalid_repeat_options for a non-positive interval', async () => {
    /*
     * Validation trigger 3: every is zero.
     * Rule it protects: the boundary lets a non-positive interval through so the
     * library owns the positivity check and raises the envelope (row 62).
     */
    await expectInvalidRepeat(
      realController().upsert('monitoring', 'demo', { repeat: { every: 0 } }),
    )
  })

  it('surfaces invalid_repeat_options for an unparseable cron pattern', async () => {
    /*
     * Validation trigger 4: a cron string the library cannot parse.
     * Rule it protects: the endpoint propagates the library's parse-failure
     * envelope unchanged rather than a raw error (row 62). The real cron parse
     * happens in the library at registration and is exercised end-to-end.
     */
    const upsertJobScheduler = jest
      .fn<UpsertMock>()
      .mockRejectedValue(
        new QueueException(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, HttpStatus.BAD_REQUEST),
      )
    const controller = build({ upsertJobScheduler })

    await expectInvalidRepeat(
      controller.upsert('monitoring', 'demo', { repeat: { pattern: 'not-a-cron' } }),
    )
  })

  it('removes a scheduler and returns whether one was removed', async () => {
    /*
     * Scenario: deleting a scheduler by id.
     * Rule it protects: the validated queue and id reach removeJobScheduler and its
     * boolean result is surfaced (row 61).
     */
    const removeJobScheduler = jest.fn<RemoveMock>().mockResolvedValue(true)
    const controller = build({ removeJobScheduler })

    const result = await controller.remove('monitoring', 'demo')

    expect(removeJobScheduler).toHaveBeenCalledWith('monitoring', 'demo')
    expect(result).toEqual({ removed: true })
  })
})
