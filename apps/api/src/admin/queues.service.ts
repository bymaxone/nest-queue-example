/**
 * @fileoverview Admin plane service over the library's `QueueService`. Owns the
 * set of queues the example manages, pre-creates them at boot to exercise the
 * per-queue option override, and refuses to act on an unknown queue name so
 * untrusted admin input can never lazily create an arbitrary Redis queue.
 * @layer app/admin
 */
import { HttpStatus, Injectable } from '@nestjs/common'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException, QueueService } from '@bymax-one/nest-queue'
import type { Queue } from '@bymax-one/nest-queue'
import { EMAIL_QUEUE, KNOWN_QUEUES, SEARCH_QUEUE } from '../queues/queue-names.js'
import type { KnownQueue } from '../queues/queue-names.js'

/**
 * Retry budget for the `email` queue, applied via a per-queue override so it
 * differs from the module-wide default and proves `queueOptions` passthrough.
 */
const EMAIL_QUEUE_ATTEMPTS = 5

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
