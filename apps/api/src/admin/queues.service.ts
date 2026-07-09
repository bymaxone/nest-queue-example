/**
 * @fileoverview Admin plane service over the library's `QueueService`. Owns the
 * set of queues the example manages, pre-creates them at boot to exercise the
 * per-queue option override, and gates every inspection/control operation behind
 * a known-queue allow-list so untrusted admin input can never lazily create an
 * arbitrary Redis queue. Job payloads returned here are the demo domain's own
 * data and carry no secrets.
 * @layer app/admin
 */
import { HttpStatus, Injectable } from '@nestjs/common'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException, QueueService } from '@bymax-one/nest-queue'
import type { Job, JobStatus, Queue, QueueMetrics } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE, KNOWN_QUEUES, SEARCH_QUEUE } from '../queues/queue-names.js'
import type { KnownQueue } from '../queues/queue-names.js'

/**
 * Retry budget for the `email` queue, applied via a per-queue override so it
 * differs from the module-wide default and proves `queueOptions` passthrough.
 */
const EMAIL_QUEUE_ATTEMPTS = 5

/** Statuses BullMQ's `clean` accepts (mirrors the library's internal type). */
export type CleanStatus = 'completed' | 'failed' | 'delayed' | 'wait' | 'active' | 'paused'

/** A serializable projection of a BullMQ `Job` for the admin surface. */
export interface JobView {
  /** The job id. */
  id: string | undefined
  /** The job name used for dispatch. */
  name: string
  /** The typed job payload (demo data; no secrets). */
  data: unknown
  /** Epoch ms when the job was created. */
  timestamp: number
  /** How many attempts have been made so far. */
  attemptsMade: number
  /** Configured delay in ms (0 when immediate). */
  delay: number
  /** Latest reported progress (a number or a structured value). */
  progress: unknown
  /** The handler return value, when completed. */
  returnvalue: unknown
  /** The failure reason, when failed. */
  failedReason: string | undefined
}

/**
 * Project a BullMQ job into a serializable view. Deliberately omits the live
 * queue reference and methods so the response serializes cleanly.
 *
 * @param job - The BullMQ job.
 * @returns The serializable job view.
 */
function toJobView(job: Job<unknown, unknown>): JobView {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    timestamp: job.timestamp,
    attemptsMade: job.attemptsMade,
    delay: job.delay,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  }
}

/** Manages the example's queues and guards admin access to them by name. */
@Injectable()
export class AdminQueuesService implements OnApplicationBootstrap {
  constructor(private readonly queueService: QueueService) {}

  /** Pre-create the managed queues once the application has fully started. */
  onApplicationBootstrap(): void {
    this.ensureManagedQueues()
  }

  /**
   * Create the managed queues up front. The `email` queue is created with a
   * per-queue `defaultJobOptions.attempts` override, so producers that enqueue
   * onto it afterward reuse that same cached, override-carrying instance.
   */
  ensureManagedQueues(): void {
    this.queueService.getOrCreateQueue(EMAIL_QUEUE, {
      defaultJobOptions: { attempts: EMAIL_QUEUE_ATTEMPTS },
    })
    this.queueService.getOrCreateQueue(SEARCH_QUEUE)
  }

  /**
   * Resolve the cached `Queue` for a known name. Repeated calls return the same
   * instance because `getOrCreateQueue` caches by name.
   *
   * @param name - The requested queue name.
   * @returns The cached queue instance.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  getManagedQueue(name: string): Queue {
    return this.queueService.getOrCreateQueue(this.assertKnownQueue(name))
  }

  /**
   * Collect a direct (uncached) metrics snapshot for every managed queue.
   *
   * @returns One metrics snapshot per known queue.
   */
  collectMetrics(): Promise<QueueMetrics[]> {
    return Promise.all(KNOWN_QUEUES.map((name) => this.queueService.getMetrics(name)))
  }

  /**
   * List jobs in a status with pagination for a known queue.
   *
   * @param name - The queue name.
   * @param status - The status filter.
   * @param start - Page start index (inclusive).
   * @param end - Page end index (inclusive).
   * @returns The matching jobs as serializable views.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  async listJobs(name: string, status: JobStatus, start: number, end: number): Promise<JobView[]> {
    const queue = this.assertKnownQueue(name)
    const jobs = await this.queueService.getJobs(queue, status, start, end)
    return jobs.map(toJobView)
  }

  /**
   * Fetch a single job, surfacing the stable not-found envelope when absent.
   *
   * @param name - The queue name.
   * @param jobId - The job id.
   * @returns The job as a serializable view.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown queue,
   *   or `queue.job_not_found` (404) when the job does not exist.
   */
  async findJob(name: string, jobId: string): Promise<JobView> {
    const queue = this.assertKnownQueue(name)
    const job = await this.queueService.getJob(queue, jobId)
    if (job === null) {
      throw new QueueException(QUEUE_ERROR_CODES.JOB_NOT_FOUND, HttpStatus.NOT_FOUND, {
        queue,
        jobId,
      })
    }
    return toJobView(job)
  }

  /**
   * Pause a known queue.
   *
   * @param name - The queue name.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  async pause(name: string): Promise<void> {
    await this.queueService.pauseQueue(this.assertKnownQueue(name))
  }

  /**
   * Resume a known queue.
   *
   * @param name - The queue name.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  async resume(name: string): Promise<void> {
    await this.queueService.resumeQueue(this.assertKnownQueue(name))
  }

  /**
   * Clean a known queue, returning the removed job ids.
   *
   * @param name - The queue name.
   * @param gracePeriodMs - Keep jobs younger than this many milliseconds.
   * @param limit - Maximum jobs to remove (0 = no limit).
   * @param status - Status of jobs to clean.
   * @returns The removed job ids.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  clean(
    name: string,
    gracePeriodMs: number,
    limit: number,
    status: CleanStatus,
  ): Promise<string[]> {
    return this.queueService.cleanQueue(this.assertKnownQueue(name), gracePeriodMs, limit, status)
  }

  /**
   * Narrow an arbitrary string to a known queue name or reject it.
   *
   * @param name - The requested queue name.
   * @returns The name, typed as a known queue.
   * @throws {QueueException} `queue.queue_not_found` (404) for an unknown name.
   */
  private assertKnownQueue(name: string): KnownQueue {
    if ((KNOWN_QUEUES as readonly string[]).includes(name)) {
      return name as KnownQueue
    }
    throw new QueueException(QUEUE_ERROR_CODES.QUEUE_NOT_FOUND, HttpStatus.NOT_FOUND, {
      queue: name,
    })
  }
}
