/**
 * @fileoverview Job Scheduler management surface: list (paginated), upsert, and
 * remove schedulers on the managed queues. Every input is validated at the trust
 * boundary; the queue name is checked against an allow-list so untrusted input can
 * never target an arbitrary queue. The repeat body is validated only for shape and
 * bounds, then handed to the library, which is the single authority on schedule
 * validity and surfaces `queue.invalid_repeat_options` for a bad schedule.
 * @layer app/schedulers
 */
import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common'
import { QueueService } from '@bymax-one/nest-queue'
import type { JobSchedulerJson, JobSchedulerRepeatOptions } from '@bymax-one/nest-queue'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { SCHEDULER_QUEUES } from './scheduler.constants.js'
import { HeartbeatTicks } from './heartbeat-ticks.service.js'
import type { SchedulerTick } from './scheduler.types.js'

/** Upper bound on a scheduler id length; a demo guardrail against absurd input. */
const MAX_SCHEDULER_ID_LENGTH = 128

/** Upper bound on a cron pattern length; comfortably above any real crontab string. */
const MAX_PATTERN_LENGTH = 120

/** Upper bound on a timezone string length. */
const MAX_TZ_LENGTH = 64

/** Upper bound on a job template name length. */
const MAX_TEMPLATE_NAME_LENGTH = 128

/** Upper bound on a pagination index, capping how much Redis is read at once. */
const MAX_PAGE_INDEX = 10_000

/** Default page end index (inclusive). */
const DEFAULT_PAGE_END = 50

/** Managed queue names, validated against the allow-list. */
const queueSchema = z.enum(SCHEDULER_QUEUES)

/** A scheduler id: a conservative identifier, alphanumeric plus dash/underscore. */
const schedulerIdSchema = z
  .string()
  .min(1)
  .max(MAX_SCHEDULER_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)

/** A start or stop time: epoch milliseconds or an ISO string. */
const dateSchema = z.union([z.number().int(), z.string().min(1).max(MAX_TZ_LENGTH)])

/**
 * Structural (not semantic) validation of the repeat body. Both `pattern` and
 * `every` are optional and `every` is not constrained to be positive on purpose:
 * the library owns schedule validity (exactly-one-of, positive interval, cron
 * parse, future endDate) and raises `queue.invalid_repeat_options`, so those
 * checks are deliberately left to it rather than duplicated here.
 */
const repeatSchema = z
  .object({
    pattern: z.string().min(1).max(MAX_PATTERN_LENGTH).optional(),
    tz: z.string().min(1).max(MAX_TZ_LENGTH).optional(),
    every: z.number().int().optional(),
    offset: z.number().int().optional(),
    limit: z.number().int().positive().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .strict()

/** Optional job template carried by the scheduler. */
const templateSchema = z
  .object({
    name: z.string().min(1).max(MAX_TEMPLATE_NAME_LENGTH).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

/** Body accepted by the upsert endpoint. */
const upsertSchema = z.object({ repeat: repeatSchema, template: templateSchema.optional() })

/** Parsed, boundary-validated upsert body. */
type UpsertBody = z.infer<typeof upsertSchema>

/** A job template shaped for the library, carrying only the keys that were set. */
interface JobTemplate {
  /** Job name for the scheduled job; defaults to the scheduler id when omitted. */
  name?: string
  /** Job payload for the scheduled job; defaults to `{}` when omitted. */
  data?: Record<string, unknown>
}

/** Query accepted by the list endpoint: the managed queue plus pagination. */
const listQuerySchema = z.object({
  queue: queueSchema,
  start: z.coerce.number().int().min(0).max(MAX_PAGE_INDEX).default(0),
  end: z.coerce.number().int().min(0).max(MAX_PAGE_INDEX).default(DEFAULT_PAGE_END),
  asc: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
})

/** Outcome of an upsert: the scheduler id and the first scheduled job id. */
export interface SchedulerUpserted {
  /** The scheduler id (upsert key). */
  schedulerId: string
  /** The id of the first scheduled (delayed) job, or null when none was produced. */
  firstJobId: string | null
}

/** Manages the recurring Job Schedulers on the allow-listed queues. */
@Controller('schedulers')
export class SchedulersController {
  constructor(
    private readonly queueService: QueueService,
    private readonly ticks: HeartbeatTicks,
  ) {}

  /**
   * List the schedulers registered on a managed queue, paginated.
   *
   * @param query - The unknown query carrying the queue and pagination.
   * @returns The registered schedulers in the requested page.
   * @throws {BadRequestException} When the query is malformed.
   */
  @Get()
  async list(@Query() query: unknown): Promise<{ schedulers: JobSchedulerJson[] }> {
    const { queue, start, end, asc } = parseRequest(listQuerySchema, query)
    const schedulers = await this.queueService.getJobSchedulers(queue, start, end, asc)
    return { schedulers }
  }

  /**
   * Return the recorded monitoring ticks, oldest first, so the scheduler clock is
   * observable without Redis access.
   *
   * @returns The recorded scheduler ticks.
   */
  @Get('ticks')
  readTicks(): { ticks: readonly SchedulerTick[] } {
    return { ticks: this.ticks.list() }
  }

  /**
   * Create or update a scheduler. Idempotent by id: re-upserting the same id
   * updates the schedule in place.
   *
   * @param queue - The managed queue (validated against the allow-list).
   * @param id - The scheduler id (upsert key).
   * @param body - The unknown request body carrying the repeat and optional template.
   * @returns The scheduler id and the first scheduled job id.
   * @throws {BadRequestException} When the queue, id, or body is malformed.
   * @throws {QueueException} `queue.invalid_repeat_options` (400) for a bad schedule.
   */
  @Put(':queue/:id')
  async upsert(
    @Param('queue') queue: unknown,
    @Param('id') id: unknown,
    @Body() body: unknown,
  ): Promise<SchedulerUpserted> {
    const queueName = parseRequest(queueSchema, queue)
    const schedulerId = parseRequest(schedulerIdSchema, id)
    const { repeat, template } = parseRequest(upsertSchema, body)
    const job = await this.queueService.upsertJobScheduler(
      queueName,
      schedulerId,
      // The library validates schedule semantics and raises the stable
      // invalid_repeat_options envelope; this asserts the boundary-validated
      // shape into its union so that authoritative check is the one that fires.
      repeat as JobSchedulerRepeatOptions,
      toJobTemplate(template),
    )
    return { schedulerId, firstJobId: job?.id ?? null }
  }

  /**
   * Remove a scheduler by id.
   *
   * @param queue - The managed queue (validated against the allow-list).
   * @param id - The scheduler id to remove.
   * @returns Whether a scheduler was removed.
   * @throws {BadRequestException} When the queue or id is malformed.
   */
  @Delete(':queue/:id')
  async remove(
    @Param('queue') queue: unknown,
    @Param('id') id: unknown,
  ): Promise<{ removed: boolean }> {
    const queueName = parseRequest(queueSchema, queue)
    const schedulerId = parseRequest(schedulerIdSchema, id)
    const removed = await this.queueService.removeJobScheduler(queueName, schedulerId)
    return { removed }
  }
}

/**
 * Reshape the boundary-validated template into the library's template argument,
 * including only the keys that were actually provided. Mirrors the library's own
 * defaulting so an absent `name`/`data` falls back to the scheduler id and `{}`.
 *
 * @param template - The parsed template, or `undefined` when none was sent.
 * @returns The library-shaped template, or `undefined` when none was sent.
 */
function toJobTemplate(template: UpsertBody['template']): JobTemplate | undefined {
  if (template === undefined) {
    return undefined
  }
  return {
    ...(template.name === undefined ? {} : { name: template.name }),
    ...(template.data === undefined ? {} : { data: template.data }),
  }
}
