# Coverage audit

The completion contract of this repository is the spec's
[Feature Coverage Matrix](./TECHNICAL_SPECIFICATION.md#7-feature-coverage-matrix): 70 rows, each of which
must be traceable to working code, a UI surface (where applicable), and at least one test. This document
audits every row with reproducible evidence: a source file, a route, a named spec, or a combination.

- **Code** paths are relative to `apps/api/src/` unless prefixed with `apps/`.
- **Test** evidence names the spec that exercises the row; e2e specs tag the row number in the `it()`
  description (e.g. `(row 17)`), so `grep -rn "(row 17)" apps/api/test` locates it directly.
- Unit specs run Docker-free (`pnpm --filter @nest-queue-example/api test:cov`, 100% on all four metrics);
  e2e specs run against a real Redis (`pnpm --filter @nest-queue-example/api test:e2e`).

Result: **70 / 70 rows covered, zero unexplained gaps.** The four sanctioned limitations in spec section 18
are noted inline where they apply (rows 8, 49, 62, 67).

## 7.1 Module, registration, connection

| #   | Feature                       | Status | Code                                      | Test evidence                                                                                                                                                          |
| --- | ----------------------------- | ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `forRootAsync` + `useFactory` | ✅     | `app.module.ts`, `config/queue.config.ts` | `config/queue.config.spec.ts`; boots in every e2e (`test/orders.e2e-spec.ts`)                                                                                          |
| 2   | `forRoot` (sync)              | ✅     | `test/registration.e2e-spec.ts` app       | `test/registration.e2e-spec.ts` "registers synchronously via forRoot (row 2)"                                                                                          |
| 3   | `useClass` / `useExisting`    | ✅     | `test/support/options-factory.module.ts`  | `test/registration.e2e-spec.ts` (row 3)                                                                                                                                |
| 4   | `isGlobal: true` default      | ✅     | `orders/` module (injects `QueueService`) | `orders/orders.service.spec.ts`; `test/orders.e2e-spec.ts`                                                                                                             |
| 5   | Symbol tokens in diagnostics  | ✅     | `admin/diagnostics.controller.ts`         | `admin/diagnostics.controller.spec.ts`; `test/orders.e2e-spec.ts` (row 5)                                                                                              |
| 6   | Mode B: `connection.url`      | ✅     | `config/queue.config.ts`                  | `config/queue.config.spec.ts`; `test/orders.e2e-spec.ts` (row 6)                                                                                                       |
| 7   | Mode B: `connection.options`  | ✅     | `config/queue.config.ts`                  | `config/queue.config.spec.ts`; `schedulers/boot-schedulers.service.spec.ts` (row 7)                                                                                    |
| 8   | Mode A: `connection.client`   | ✅     | `config/shared-redis.provider.ts`         | `config/shared-redis.provider.spec.ts`, `config/queue.config.spec.ts`; `test/connection.e2e-spec.ts`. Spec section 18.3: app-owned ioredis stands in for `nest-cache`. |
| 9   | Per-role retry policy         | ✅     | `admin/diagnostics.controller.ts`         | `admin/diagnostics.controller.spec.ts` asserts `queueRoleMaxRetries: 20` / `workerRoleMaxRetries: null`; `test/connection.e2e-spec.ts`                                 |
| 10  | `defaultJobOptions` merge     | ✅     | `config/queue.config.ts`, web job detail  | `config/queue.config.spec.ts`; `test/orders.e2e-spec.ts` (row 10)                                                                                                      |
| 11  | `prefix` (multi-tenant)       | ✅     | `config/queue.config.ts`                  | `config/queue.config.spec.ts`; `test/connection.e2e-spec.ts` asserts prefixed keys                                                                                     |
| 12  | `queueOptions` passthrough    | ✅     | `admin/queues.service.ts`                 | `admin/queues.service.spec.ts`; `test/orders.e2e-spec.ts` (row 12)                                                                                                     |

## 7.2 Enqueue surface

| #   | Feature                          | Status | Code                                 | Test evidence                                                     |
| --- | -------------------------------- | ------ | ------------------------------------ | ----------------------------------------------------------------- |
| 13  | `enqueue<TData, TResult>` typed  | ✅     | `orders/orders.service.ts`           | `test/orders.e2e-spec.ts` (row 13)                                |
| 14  | Per-job `priority`               | ✅     | `orders/orders.service.ts`           | `test/orders.e2e-spec.ts` "jumps a VIP receipt (row 14)"          |
| 15  | Per-job `delay`                  | ✅     | `orders/orders.service.ts`           | `test/orders.e2e-spec.ts` (row 15)                                |
| 16  | `jobId` idempotent insert        | ✅     | `orders/onboarding.service.ts`       | `test/orders.e2e-spec.ts` (row 16)                                |
| 17  | Dedup simple `{ id }`            | ✅     | `search/reindex.service.ts`          | `test/dedup.e2e-spec.ts` (row 17)                                 |
| 18  | Dedup throttle `{ id, ttl }`     | ✅     | `search/reindex.service.ts`          | `test/dedup.e2e-spec.ts` (row 18)                                 |
| 19  | Dedup debounce                   | ✅     | `search/reindex.service.ts`          | `test/dedup.e2e-spec.ts` (row 19)                                 |
| 20  | Dedup keep-last-if-active        | ✅     | `search/reindex.service.ts`          | `test/dedup.e2e-spec.ts` (row 20)                                 |
| 21  | dedup inspector (get/remove key) | ✅     | `admin/dedup.controller.ts`          | `test/dedup.e2e-spec.ts`, `test/orders.e2e-spec.ts` (row 21)      |
| 22  | `enqueueBulk`                    | ✅     | `orders/campaign.service.ts`         | `test/orders.e2e-spec.ts` (row 22)                                |
| 23  | `MAX_BULK_SIZE` guard            | ✅     | `orders/campaign.service.ts`, errors | `test/orders.e2e-spec.ts` (row 23); `test/errors.e2e-spec.ts`     |
| 24  | `getOrCreateQueue` caching       | ✅     | `admin/queues.service.ts`            | `admin/queues.service.spec.ts` (row 24); `test/dedup.e2e-spec.ts` |

## 7.3 Inspection, control, metrics

| #   | Feature                        | Status | Code                          | Test evidence                                                         |
| --- | ------------------------------ | ------ | ----------------------------- | --------------------------------------------------------------------- |
| 25  | `getJob`                       | ✅     | `admin/jobs.controller.ts`    | `admin/jobs.controller.spec.ts`; `test/orders.e2e-spec.ts` (row 25)   |
| 26  | `getJobs` by status + paging   | ✅     | `admin/jobs.controller.ts`    | `admin/jobs.controller.spec.ts`; `test/orders.e2e-spec.ts` (row 26)   |
| 27  | `getMetrics` (direct)          | ✅     | `admin/metrics.controller.ts` | `admin/metrics.controller.spec.ts`                                    |
| 28  | `MetricsService.get` (cache)   | ✅     | `admin/health.controller.ts`  | `admin/health.controller.spec.ts`, `admin/metrics.controller.spec.ts` |
| 29  | `MetricsService.getAll`        | ✅     | `admin/metrics.controller.ts` | `admin/metrics.controller.spec.ts`                                    |
| 30  | `MetricsService.invalidate`    | ✅     | `admin/metrics.controller.ts` | `admin/metrics.controller.spec.ts`                                    |
| 31  | `pauseQueue` / `resumeQueue`   | ✅     | `admin/queues.controller.ts`  | `admin/queues.controller.spec.ts`; `test/orders.e2e-spec.ts` (row 31) |
| 32  | `cleanQueue`                   | ✅     | `admin/queues.controller.ts`  | `admin/queues.controller.spec.ts`; `test/orders.e2e-spec.ts` (row 32) |
| 33  | Health check (`/health/ready`) | ✅     | `admin/health.controller.ts`  | `admin/health.controller.spec.ts`                                     |

## 7.4 Workers, dispatch, events

| #   | Feature                              | Status | Code                                                                     | Test evidence                                                                                                                                           |
| --- | ------------------------------------ | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34  | `@Processor(queue, options)` + DI    | ✅     | `processors/email.processor.ts`                                          | `processors/email.processor.spec.ts`                                                                                                                    |
| 35  | `@Process('name')` dispatch          | ✅     | `processors/email.processor.ts`                                          | `processors/email.processor.spec.ts`                                                                                                                    |
| 36  | `@Process()` fallback dispatch       | ✅     | `processors/email.processor.ts`                                          | `processors/email.processor.spec.ts`                                                                                                                    |
| 37  | Explicit `concurrency`               | ✅     | `processors/webhook.processor.ts`                                        | `processors/webhook.processor.spec.ts`                                                                                                                  |
| 38  | Missing-concurrency warning          | ✅     | `processors/audit.processor.ts`                                          | `processors/audit.processor.spec.ts`                                                                                                                    |
| 39  | `limiter { max, duration }`          | ✅     | `processors/webhook.processor.ts`                                        | `processors/webhook.processor.spec.ts` (row 39)                                                                                                         |
| 40  | Retries + exponential backoff        | ✅     | `processors/webhook.processor.ts`                                        | `processors/webhook.processor.spec.ts` (row 40)                                                                                                         |
| 41  | At-least-once idempotent handler     | ✅     | `processors/email.processor.ts`                                          | `processors/email.processor.spec.ts`                                                                                                                    |
| 42  | `lockDuration` / `stalledInterval`   | ✅     | `processors/report.processor.ts`, `processors/stall.processor.ts`        | `processors/report.processor.spec.ts`, `processors/stall.processor.spec.ts`                                                                             |
| 43  | `job.updateProgress` (number+object) | ✅     | `processors/report.processor.ts`                                         | `processors/report.processor.spec.ts`                                                                                                                   |
| 44  | `@OnWorkerEvent`                     | ✅     | `processors/email.processor.ts`, `processors/stall.processor.ts`         | `test/events.e2e-spec.ts` (row 44)                                                                                                                      |
| 45  | `@OnQueueEvent` + lazy `QueueEvents` | ✅     | `processors/webhook.processor.ts`                                        | `test/events.e2e-spec.ts` (row 45)                                                                                                                      |
| 46  | `queue.duplicate_processor` guard    | ✅     | `test/registration.e2e-spec.ts` app                                      | `test/registration.e2e-spec.ts` (row 46)                                                                                                                |
| 47  | `WorkerRegistry.register` (dynamic)  | ✅     | `workers/tenant-workers.service.ts`                                      | `test/workers.e2e-spec.ts` (row 47)                                                                                                                     |
| 48  | `WorkerRegistry.unregister` / `list` | ✅     | `workers/tenant-workers.controller.ts`                                   | `test/workers.e2e-spec.ts` (row 48)                                                                                                                     |
| 49  | `registerSandboxed`                  | ✅     | `workers/invoice.sandboxed.ts`, `workers/sandboxed-bootstrap.service.ts` | `workers/invoices.controller.spec.ts`, `test/workers.e2e-spec.ts` (row 49). Spec section 18.1: needs the built `.js` artifact, staged by `pretest:e2e`. |

## 7.5 Flows and schedulers

| #   | Feature                                   | Status | Code                                    | Test evidence                                                                                                   |
| --- | ----------------------------------------- | ------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 50  | `FlowService.add` (fan-out/fan-in)        | ✅     | `flows/fulfillment.service.ts`          | `flows/fulfillment.service.spec.ts`; `test/flows.e2e-spec.ts` (row 50)                                          |
| 51  | Nested children                           | ✅     | `flows/fulfillment.service.ts`          | `flows/fulfillment.service.spec.ts`; `test/flows.e2e-spec.ts` (row 51)                                          |
| 52  | `waiting-children` pitfall                | ✅     | `flows/flows.controller.ts`             | `flows/fulfillment.service.spec.ts`; `test/flows.e2e-spec.ts` (row 52)                                          |
| 53  | `failParentOnFailure: true`               | ✅     | `flows/fulfillment.service.ts`          | `test/flows.e2e-spec.ts` (row 53)                                                                               |
| 54  | `ignoreDependencyOnFailure: true`         | ✅     | `flows/fulfillment.service.ts`          | `test/flows.e2e-spec.ts` (row 54)                                                                               |
| 55  | `FlowService.addBulk`                     | ✅     | `flows/fulfillment.service.ts`          | `flows/flows.controller.spec.ts`; `test/flows.e2e-spec.ts` (row 55)                                             |
| 56  | `getProducer` escape hatch                | ✅     | `flows/flows.controller.ts`             | `flows/fulfillment.service.spec.ts`; `test/flows.e2e-spec.ts` (row 56)                                          |
| 57  | `upsertJobScheduler` cron 5 + tz          | ✅     | `schedulers/boot-schedulers.service.ts` | `schedulers/boot-schedulers.service.spec.ts`; `test/schedulers.e2e-spec.ts` (row 57)                            |
| 58  | Cron 6-field (seconds)                    | ✅     | `schedulers/boot-schedulers.service.ts` | `test/schedulers.e2e-spec.ts` (row 58)                                                                          |
| 59  | `every` + `offset` + `limit`              | ✅     | `schedulers/boot-schedulers.service.ts` | `test/schedulers.e2e-spec.ts` (row 59)                                                                          |
| 60  | Idempotent upsert by `schedulerId`        | ✅     | `schedulers/boot-schedulers.service.ts` | `schedulers/boot-schedulers.service.spec.ts`; `test/schedulers.e2e-spec.ts` (row 60)                            |
| 61  | `getJobSchedulers` / `removeJobScheduler` | ✅     | `schedulers/schedulers.controller.ts`   | `schedulers/schedulers.controller.spec.ts`; `test/schedulers.e2e-spec.ts` (row 61)                              |
| 62  | `queue.invalid_repeat_options`            | ✅     | `errors/error-explorer.controller.ts`   | `schedulers/schedulers.controller.spec.ts` (row 62); `test/errors.e2e-spec.ts`. Spec section 18.4 note applies. |

## 7.6 Shutdown, errors, telemetry, shared subpath

| #   | Feature                           | Status | Code                                                                 | Test evidence                                                                                                           |
| --- | --------------------------------- | ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 63  | Graceful shutdown (bounded drain) | ✅     | `apps/api`, `scripts/demo-shutdown.mjs`                              | `test/shutdown.e2e-spec.ts` (row 63)                                                                                    |
| 64  | `drainTimeoutMs` + timeout code   | ✅     | `test/shutdown.e2e-spec.ts` variant                                  | `test/shutdown.e2e-spec.ts` (row 64)                                                                                    |
| 65  | `drainOnShutdown` (dev only)      | ✅     | `config/queue.config.ts`                                             | `config/queue.config.spec.ts`                                                                                           |
| 66  | `QueueException` envelope         | ✅     | `errors/`, web error explorer                                        | `test/errors.e2e-spec.ts` (row 66)                                                                                      |
| 67  | Full `QUEUE_ERROR_CODES` catalog  | ✅     | `errors/error-explorer.controller.ts`, `test/connection.e2e-spec.ts` | `test/errors.e2e-spec.ts` (row 67); `test/connection.e2e-spec.ts`. Spec section 18.4: two bootstrap codes are e2e-only. |
| 68  | `telemetry` (bullmq-otel) opt-in  | ✅     | `config/telemetry.config.ts`                                         | `config/telemetry.config.spec.ts`, `config/telemetry-spans.spec.ts`                                                     |
| 69  | `./shared` zero-dep subpath       | ✅     | `apps/web/lib/queue-shared-probe.ts`                                 | `apps/web/lib/queue-status.test.ts`; `apps/web` declares no server peers                                                |
| 70  | Re-exported BullMQ types resolve  | ✅     | `apps/api/src/**` (typings)                                          | `pnpm typecheck` (both apps); `apps/web/lib/api-types.ts`                                                               |
