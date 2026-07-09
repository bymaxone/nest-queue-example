# Phase 3: enqueue-surface-admin-api

> **Status**: 👀 Review · **Progress**: 5 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P3)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §7.2, §7.3, §11; matrix rows 12 to 27, 31, 32

## Context

The api boots with one smoke queue. This phase builds the producer side of the Orderly demo domain: typed enqueues with every per-job option, all four deduplication modes, bulk enqueues with the bounded-size guard, and the admin inspection/control API. After this phase every `QueueService` producer method has a real endpoint.

## Rules-of-phase

1. Every endpoint validates input with zod pipes; invalid enqueue payloads surface `queue.invalid_job_data` through the example's validation wiring (spec §18 note 4).
2. In-memory repositories only; no database.
3. Each task names its matrix rows; the phase close audits them.
4. Job data interfaces live in one `orders/order-jobs.types.ts` per queue family, exported for reuse by the web app later (via api DTO mirroring, not imports).

## Reference docs

- Spec §11 (endpoint groups), §12 scenarios 1, 3; library spec §5 (QueueService).

## Task index

| ID  | Task                                                        | Status    | Priority | Size | Depends on |
| --- | ----------------------------------------------------------- | --------- | -------- | ---- | ---------- |
| 3.1 | Branch + Orderly domain + typed order placement enqueue     | ✅ Done   | P0       | M    | Phase 2    |
| 3.2 | Priority, delay, and `jobId` idempotency endpoints          | ✅ Done   | P0       | S    | 3.1        |
| 3.3 | Four deduplication modes + dedup inspector                  | ✅ Done   | P0       | M    | 3.1        |
| 3.4 | `enqueueBulk` campaigns + bounded-bulk error path           | ✅ Done   | P0       | S    | 3.1        |
| 3.5 | Admin inspection/control API (jobs, queues, metrics direct) | ✅ Done   | P0       | M    | 3.1        |
| 3.6 | Phase close: audit, dashboards, PR with Copilot review      | 👀 Review | P0       | S    | 3.2 to 3.5 |

## Tasks

### Task 3.1: Branch + Orderly domain + typed order placement enqueue

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 2

#### Description

Create the demo domain: `orders/` module with an in-memory `OrdersRepository`, `POST /orders` that stores the order and enqueues a typed `send-receipt` job on the `email` queue (matrix rows 12, 13, 24). The email processor arrives in Phase 4; jobs will wait, which is itself demonstrable.

#### Acceptance criteria

- [x] Branch `feat/phase-03-enqueue-surface-admin-api` created with `git switch -c`.
- [x] `orders/order-jobs.types.ts`: `ReceiptEmailJobData` (+ result type), documented.
- [x] `POST /orders` validates with zod, stores in-memory, enqueues `email`/`send-receipt` typed, returns `{ orderId, jobId }`.
- [x] `getOrCreateQueue` per-queue override exercised once (e.g. the `email` queue created with a custom `defaultJobOptions.attempts` override, row 12/24) inside `admin/queues.service.ts`.
- [x] Unit tests: repository, service (QueueService mocked), controller validation (invalid payload rejected with the stable envelope shape).

#### Files to create / modify

`apps/api/src/orders/*` (module, controller, service, repository, types), `apps/api/src/admin/queues.service.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer building a demo domain around typed enqueues.

PROJECT: nest-queue-example, Phase 3 Task 3.1 of 6 (FIRST). QueueService is global;
enqueue<TData, TResult>(queueName, jobName, data, options) is fully typed. The email
processor does not exist yet: enqueued jobs stay waiting, which is fine and visible.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §5.2 to §5.4 (typing + enqueue),
  §5.3 (getOrCreateQueue overrides)
- docs/TECHNICAL_SPECIFICATION.md §11 Orders group, §7 rows 12, 13, 24

TASK
Create the branch (`git switch -c feat/phase-03-enqueue-surface-admin-api`), then:
1. orders/ module: order-jobs.types.ts (ReceiptEmailJobData { orderId, to, total },
   ReceiptEmailJobResult { messageId }), OrdersRepository (in-memory Map, cap 500),
   OrdersService.place() storing + enqueuing email/send-receipt typed, OrdersController
   POST /orders with a zod validation pipe.
2. admin/queues.service.ts: getOrCreateQueue('email', { defaultJobOptions: { attempts: 5 } })
   demonstrating per-queue overrides and instance caching (assert same reference in a
   unit test, row 24).
3. Unit tests for all of it (each it() with a scenario comment).

Constraints:
- Controllers thin; zod at the edge; @fileoverview + @layer; functions <= 50 lines.
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot + `curl -s -X POST :3080/orders -d '{"to":"a@b.c","total":10}' -H
  'content-type: application/json'` returns orderId + jobId; the job shows as waiting
  via `docker compose exec redis redis-cli keys 'nqex:*' | head`.
- `pnpm --filter @nest-queue-example/api test` green.

Completion Protocol: standard 5 steps (phase file, plan §1 P3 row, tasks README,
completion log), commit `feat(api): orderly domain with typed receipt enqueue (3.1)`.
```

---

### Task 3.2: Priority, delay, and `jobId` idempotency endpoints

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1

#### Description

Per-job options in anger: `POST /orders/:id/remind` (delayed job, row 15), VIP priority on placement (row 14), and `POST /onboarding/:userId` using `jobId: welcome:{userId}` so the second call is a no-op (row 16); the response reports whether the job was newly created or already existed.

#### Acceptance criteria

- [x] `POST /orders` accepts `vip: true` mapping to `priority: 1` (documented: lower is higher priority in BullMQ).
- [x] `POST /orders/:id/remind` enqueues with `delay: 60_000` (env-tunable); the job is visible under `delayed` status.
- [x] `POST /onboarding/:userId` enqueues with `jobId: welcome-<userId>` (hyphen: BullMQ rejects a single-colon custom id); a second call returns `{ created: false, jobId }` (compare existing state, no error).
- [x] Unit tests cover the three option paths (assert the options object passed to `enqueue`).

#### Files to create / modify

`apps/api/src/orders/orders.controller.ts`, `orders.service.ts`, `onboarding.controller.ts`, `onboarding.service.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer surfacing per-job options.

PROJECT: nest-queue-example, Phase 3 Task 3.2 of 6 (MIDDLE). enqueue() accepts BullMQ
JobsOptions: priority (lower = higher), delay (ms), jobId (idempotent insert: adding a
second job with the same id while the first exists is a no-op).

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §5.4 + §5.4.1 (jobId semantics)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 14, 15, 16

TASK
1. Extend POST /orders with vip -> priority 1.
2. POST /orders/:id/remind: delayed reminder (delay from env REMINDER_DELAY_MS,
   default 60000; add to env schema + .env.example).
3. onboarding/: POST /onboarding/:userId enqueues email/send-welcome with
   jobId `welcome:<userId>`; detect the no-op second call (fetch the existing job via
   queueService.getJob and compare timestamps/ids) and answer { created: boolean, jobId }.
4. Unit tests asserting the exact options objects and the created:false path.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Two `curl -X POST :3080/onboarding/u1` calls: first { created: true }, second
  { created: false } with the same jobId.
- Reminder job appears via redis-cli in the delayed set.

Completion Protocol: standard 5 steps, id 3.2, commit
`feat(api): priority, delay and jobId idempotency endpoints (3.2)`.
```

---

### Task 3.3: Four deduplication modes + dedup inspector

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

The dedup lab (matrix rows 17 to 21): `POST /search/reindex` with `mode` selecting simple, throttle, debounce (with `delay`), or keep-last-if-active deduplication; plus the inspector endpoints wrapping `getDeduplicationJobId` / `removeDeduplicationKey`.

#### Acceptance criteria

- [x] `search/` module: `POST /search/reindex { term, mode }` maps modes exactly per the library spec table: simple `{ id }`, throttle `{ id, ttl: 5000 }`, debounce `{ id, ttl: 5000, extend: true, replace: true }` + `delay: 2000`, keepLast `{ id, keepLastIfActive: true }`; dedup id is `reindex:<term>`.
- [x] `GET /admin/dedup/:queue/:id` returns the deduplication job id (or null); `DELETE /admin/dedup/:queue/:id` clears the key.
- [x] Response includes `{ jobId, deduplicated: boolean }` (comparing requested vs returned id) so the lab is observable without the dashboard.
- [x] Unit tests per mode asserting the exact `deduplication` option shape.

#### Files to create / modify

`apps/api/src/search/*`, `apps/api/src/admin/dedup.controller.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer building a deduplication laboratory.

PROJECT: nest-queue-example, Phase 3 Task 3.3 of 6 (MIDDLE). BullMQ-native deduplication
is surfaced through enqueue options: simple { id }, throttle { id, ttl }, debounce
{ id, ttl, extend: true, replace: true } used with delay, keep-last-if-active
{ id, keepLastIfActive: true }. Inspection: getDeduplicationJobId / removeDeduplicationKey
on the queue (reach them via queueService.getOrCreateQueue(name)).

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §5.4.1 (the modes table, follow exactly)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 17 to 21, §12 scenario 3

TASK
1. search/ module: POST /search/reindex { term, mode: 'simple'|'throttle'|'debounce'|
   'keepLast' } enqueuing search/reindex with the mode-mapped deduplication options and
   dedup id `reindex:<term>`; respond { jobId, deduplicated }.
2. admin/dedup.controller.ts: GET and DELETE /admin/dedup/:queue/:id wrapping the native
   inspection methods.
3. Unit tests: one per mode asserting the exact options object; inspector paths.

Constraints:
- Do not reimplement dedup logic; pass through the native options only.
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Fire 5 rapid `curl -X POST :3080/search/reindex -d '{"term":"x","mode":"throttle"}'`:
  exactly one job created within the ttl window, subsequent responses deduplicated: true.
- GET /admin/dedup/search/reindex:x returns the id; DELETE clears it; next enqueue creates anew.

Completion Protocol: standard 5 steps, id 3.3, commit
`feat(api): four deduplication modes with inspector (3.3)`.
```

---

### Task 3.4: `enqueueBulk` campaigns + bounded-bulk error path

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1

#### Description

Fan-out in one roundtrip (rows 22, 23): `POST /campaigns/receipts { count }` bulk-enqueues N receipt emails; `count` above `MAX_BULK_SIZE` returns the library's `queue.bulk_enqueue_failed` envelope untouched, proving nothing was enqueued.

#### Acceptance criteria

- [x] `POST /campaigns/receipts` builds `BulkJob<ReceiptEmailJobData>[]` and calls `enqueueBulk`; returns `{ enqueued, jobIds }`.
- [x] `count: 1001` yields the library error envelope (`error.code: 'queue.bulk_enqueue_failed'`) and queue counts prove zero new jobs.
- [x] Unit tests: happy path order preservation, oversized rejection.

#### Files to create / modify

`apps/api/src/orders/campaign.controller.ts`, `campaign.service.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer exercising bulk enqueues and their guardrail.

PROJECT: nest-queue-example, Phase 3 Task 3.4 of 6 (MIDDLE). enqueueBulk(queue, jobs)
performs one Redis roundtrip and throws queue.bulk_enqueue_failed when jobs.length
exceeds MAX_BULK_SIZE (1000) BEFORE anything is enqueued.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §5.5
- docs/TECHNICAL_SPECIFICATION.md §7 rows 22, 23

TASK
campaigns: POST /campaigns/receipts { count <= 1200 } builds count BulkJob entries
(name 'send-receipt', synthetic data) and calls enqueueBulk('email', jobs). Let the
library exception propagate to the stable envelope (do not catch-and-rewrap). Unit
tests: order of returned ids matches input; 1001 rejects with the code and no partial
enqueue (assert enqueueBulk mock called once, and in an integration-style test with a
real queue, counts unchanged).

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `curl -X POST :3080/campaigns/receipts -d '{"count":50}'` returns 50 ids.
- `curl -X POST :3080/campaigns/receipts -d '{"count":1001}'` returns the
  queue.bulk_enqueue_failed envelope.

Completion Protocol: standard 5 steps, id 3.4, commit
`feat(api): bulk receipt campaigns with bounded-bulk guard (3.4)`.
```

---

### Task 3.5: Admin inspection/control API (jobs, queues, metrics direct)

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

The read/control plane the dashboard will consume (rows 25 to 27, 31, 32): job lookup, status-paginated listings, direct metrics, pause/resume/clean, with the library's not-found errors surfacing as-is.

#### Acceptance criteria

- [x] `GET /admin/queues` lists known queues with direct `getMetrics` counts (row 27).
- [x] `GET /admin/queues/:name/jobs?status=&start=&end=` wraps `getJobs` (row 26); invalid status rejected by zod.
- [x] `GET /admin/jobs/:queue/:id` wraps `getJob`; missing job surfaces `queue.job_not_found` (404) via the library's stable envelope (row 25).
- [x] `POST /admin/queues/:name/pause` and `/resume` (row 31); `POST /admin/queues/:name/clean { gracePeriodMs, limit, status }` returns removed ids (row 32).
- [x] Unit tests for every route (mocked service; not-found surfacing asserted).

#### Files to create / modify

`apps/api/src/admin/jobs.controller.ts`, `queues.controller.ts`, `metrics.controller.ts` (direct part), `admin.module.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer building the queue admin plane.

PROJECT: nest-queue-example, Phase 3 Task 3.5 of 6 (MIDDLE). QueueService exposes
getJob, getJobs(queue, status, start, end), getMetrics, pauseQueue, resumeQueue,
cleanQueue(queue, gracePeriodMs, limit, status?) mirroring BullMQ argument order.
Library errors are HttpExceptions with the stable envelope; let them propagate.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §5.7 to §5.9, §12.2 (job/queue not found)
- docs/TECHNICAL_SPECIFICATION.md §11 Admin group, §7 rows 25 to 27, 31, 32

TASK
Implement the admin endpoints listed in the acceptance criteria; zod-validate query and
body params (status enum from the shared JOB_STATUS values); thin controllers over an
AdminQueuesService. Unit tests for each route including the 404 passthrough.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot journey: place 3 orders, `GET /admin/queues/email/jobs?status=waiting` lists 3;
  pause, place 1, counts show paused growth; resume; clean completed returns ids array.
- `curl :3080/admin/jobs/email/nope` returns the queue.job_not_found envelope with 404.

Completion Protocol: standard 5 steps, id 3.5, commit
`feat(api): admin inspection and control endpoints (3.5)`.
```

---

### Task 3.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 👀 Review
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.2 to 3.5

#### Description

Standard phase close for the producer surface: re-verify all tasks (including the curl journeys), update dashboards, PR with Copilot review, squash-merge on green.

#### Acceptance criteria

- [x] All 3.1 to 3.5 verifications re-run green (lint, typecheck, build, 82 unit tests at 100% coverage, invariant greps, and the manual Redis journeys).
- [x] Matrix rows 12 to 27, 31, 32 marked demonstrated in the PR body evidence table.
- [x] Dashboards updated; PR opened with the Copilot review requested. (Squash-merge, branch deletion, and CI-green gating are owned by the orchestrator.)

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 3 of nest-queue-example.

CURRENT PHASE: 3 (enqueue-surface-admin-api), Task 3.6 of 6 (LAST).

PRECONDITIONS: tasks 3.1 to 3.5 done on branch feat/phase-03-enqueue-surface-admin-api.

REQUIRED READING (only these)
- docs/tasks/phase-03-enqueue-surface-admin-api.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P3 DoD, §6 Update protocol

TASK
Re-run every verification from 3.1 to 3.5 against compose Redis (fix reds with normal
commits). Update dashboards (phase file, plan §1 P3 row, tasks README). Open the PR:
`gh pr create --title "feat(api): phase 3, producer surface and admin plane"` with a
body containing the matrix-row evidence table (rows 12 to 27, 31, 32: endpoint +
verification output). Request the GitHub Copilot code review (gh pr edit
--add-reviewer copilot-pull-request-reviewer[bot] or via the UI); address EVERY
finding; merge only with CI green via `gh pr merge --squash --delete-branch`; verify
branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P3 ✅ 6/6.

Completion Protocol: append `- 3.6 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P3 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 3.1 ✅ 2026-07-09 Orderly domain: bounded in-memory OrdersRepository, POST /orders typed send-receipt enqueue, AdminQueuesService per-queue override + caching, shared zod validation surfacing queue.invalid_job_data.
- 3.2 ✅ 2026-07-09 Per-job options: VIP priority on placement, env-tunable delayed reminder (delayed set), idempotent POST /onboarding/:userId welcome via hyphenated jobId returning created:true/false.
- 3.3 ✅ 2026-07-09 Dedup lab: POST /search/reindex maps all four modes to the exact BullMQ deduplication shapes with { jobId, deduplicated }; GET/DELETE /admin/dedup/:queue/:id inspector over the native getDeduplicationJobId/removeDeduplicationKey.
- 3.4 ✅ 2026-07-09 Bulk campaigns: POST /campaigns/receipts fans out N ordered send-receipt jobs via enqueueBulk; zod ceiling 1200 lets 1001 reach the library's queue.bulk_enqueue_failed guard with zero partial enqueue.
- 3.5 ✅ 2026-07-09 Admin plane: GET /admin/queues (direct getMetrics), GET /admin/queues/:name/jobs (status+pagination), pause/resume/clean, GET /admin/jobs/:queue/:id; allow-list guard surfaces queue.queue_not_found and consumer-raised queue.job_not_found via the library's stable envelope.
- 3.6 👀 2026-07-09 Phase close: security review clean, code-review findings (2 MEDIUM + 2 LOW) all resolved, gates re-run green; PR opened and Copilot review requested (merge owned by the orchestrator).
