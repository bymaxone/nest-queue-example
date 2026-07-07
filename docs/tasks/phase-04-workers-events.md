# Phase 4: workers-events

> **Status**: 📋 ToDo · **Progress**: 0 / 6 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P4)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §7.4; matrix rows 34 to 46

## Context

Producers exist; jobs pile up waiting. This phase builds the consumer side: processors with every worker knob (concurrency, limiter, lock tuning), named vs fallback dispatch, the at-least-once idempotency pattern, progress reporting, both event decorators bridged into an SSE feed, the stalled-recovery demo, and the graceful shutdown demo.

## Rules-of-phase

1. One `@Processor` per queue (the library enforces `queue.duplicate_processor`); processors live in `processors/`, one file each.
2. Every handler is idempotent by construction; the receipt handler carries the canonical already-processed-marker pattern with a documenting comment.
3. Failure injection is env-driven (`WEBHOOK_FAILURES`), never random, so demos and e2e are deterministic.
4. The SSE bridge holds no history (ring buffer cap 200); it is a demonstration surface, not an event store.

## Reference docs

- Library spec §6 (workers, decorators, events, sandboxed constraints), §10 (delivery semantics).
- Spec §12 scenarios 2 and 8; §7 rows 34 to 46.

## Task index

| ID | Task | Status | Priority | Size | Depends on |
|---|---|---|---|---|---|
| 4.1 | Branch + email processor: named vs fallback dispatch + idempotency marker | 📋 ToDo | P0 | M | Phase 3 |
| 4.2 | Webhook processor: concurrency, limiter, failure injection, backoff | 📋 ToDo | P0 | M | 4.1 |
| 4.3 | Report processor: progress (number + object) + lock tuning; concurrency-warning proof | 📋 ToDo | P0 | S | 4.1 |
| 4.4 | Event decorators bridged to the SSE stream | 📋 ToDo | P0 | M | 4.1 |
| 4.5 | Stalled-recovery demo + graceful-shutdown demo script | 📋 ToDo | P1 | S | 4.2 |
| 4.6 | Phase close: audit, dashboards, PR with Copilot review | 📋 ToDo | P0 | S | 4.2 to 4.5 |

## Tasks

### Task 4.1: Branch + email processor: named vs fallback dispatch + idempotency marker

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 3

#### Description

The `email` queue consumer (rows 34 to 36, 41): `@Processor('email', { concurrency: 3 })` with `@Process('send-welcome')`, `@Process('send-receipt')`, and a fallback `@Process()`; a mailer stub injected via DI; the receipt handler implements the already-processed marker keyed by `job.id` (at-least-once pattern).

#### Acceptance criteria

- [ ] Branch `feat/phase-04-workers-events` created with `git switch -c`.
- [ ] `EmailProcessor` dispatches `send-welcome` and `send-receipt` to their named handlers and everything else to the fallback (assert dispatch precedence in unit tests).
- [ ] `MailerStub` (injectable) records sends in-memory; receipt handler checks/sets a processed marker (in-memory Set keyed by `job.id`) and skips duplicates, returning the original result shape.
- [ ] Waiting jobs from Phase 3 drain once the app boots (journey check).
- [ ] Unit tests: each handler, dispatch precedence, idempotent re-run (same `job.id` twice yields one send).

#### Files to create / modify

`apps/api/src/processors/email.processor.ts`, `apps/api/src/processors/mailer.stub.ts`, `processors/processors.module.ts`, specs

#### Agent prompt

````
You are a senior NestJS engineer implementing typed queue consumers.

PROJECT: nest-queue-example, Phase 4 Task 4.1 of 6 (FIRST). The library dispatches
@Process('name') first (most specific), then the unnamed @Process() fallback. Delivery
is at-least-once: handlers must be idempotent; the canonical pattern is an
already-processed marker keyed by job.id.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.2 to §6.4, §10.0
- docs/TECHNICAL_SPECIFICATION.md §7 rows 34, 35, 36, 41

TASK
Create the branch (`git switch -c feat/phase-04-workers-events`), then:
1. processors/mailer.stub.ts: injectable MailerStub recording { to, template, at }
   entries (cap 500) with a list() accessor.
2. processors/email.processor.ts: @Processor('email', { concurrency: 3 }) with
   @Process('send-welcome'), @Process('send-receipt') (idempotency marker: an in-memory
   Set<string> of job ids; a comment explains the at-least-once contract and that real
   apps persist the marker), and a fallback @Process() logging unknown names to the
   audit trail service.
3. processors/processors.module.ts registering both + the audit processor from Phase 2.
4. Unit tests: handler behavior, dispatch precedence (welcome does not hit fallback),
   duplicate job.id sends once.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files;
  @fileoverview + @layer; functions <= 50 lines.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot: the waiting email jobs from Phase 3 drain; MailerStub list shows receipts.
- `pnpm --filter @nest-queue-example/api test` green.

Completion Protocol: standard 5 steps (phase file, plan §1 P4 row, tasks README,
completion log), commit `feat(api): email processor with dispatch and idempotency (4.1)`.
````

---

### Task 4.2: Webhook processor: concurrency, limiter, failure injection, backoff

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.1

#### Description

The retry theater (rows 37, 39, 40): `@Processor('webhooks', { concurrency: 5, limiter: { max: 2, duration: 1000 } })`; the handler fails deterministically `WEBHOOK_FAILURES` times per job (tracked by `job.attemptsMade`) then succeeds, making exponential backoff observable; `POST /orders` gains webhook fan-out.

#### Acceptance criteria

- [ ] `WebhookProcessor` registered with concurrency 5 and limiter 2/s; a timeless comment explains both knobs.
- [ ] Handler throws while `job.attemptsMade < env.WEBHOOK_FAILURES`, then succeeds recording the delivery in an in-memory `WebhookLog`.
- [ ] `POST /orders` also enqueues `webhooks/order-created` (attempts inherited from module defaults).
- [ ] Unit tests: failure-then-success sequence via mocked `job.attemptsMade`, limiter/concurrency options asserted on the decorator metadata or registration call.

#### Files to create / modify

`apps/api/src/processors/webhook.processor.ts`, `webhook-log.service.ts`, `orders/orders.service.ts` (fan-out), specs

#### Agent prompt

````
You are a senior NestJS engineer making retries and rate limits observable.

PROJECT: nest-queue-example, Phase 4 Task 4.2 of 6 (MIDDLE). Module defaults give
attempts 4 with exponential backoff 1500ms. job.attemptsMade counts prior attempts, so
"fail while attemptsMade < N" yields exactly N failures then success. Failure injection
must be deterministic (env WEBHOOK_FAILURES, default 2), never random.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.3 (WorkerOptions), §6.7 (concurrency guidance)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 37, 39, 40; §12 scenario 2

TASK
1. processors/webhook.processor.ts: @Processor('webhooks', { concurrency: 5, limiter:
   { max: 2, duration: 1000 } }); @Process('order-created') throws
   `new Error('injected failure ' + job.attemptsMade)` while attemptsMade <
   WEBHOOK_FAILURES, then records { orderId, attempts: job.attemptsMade + 1, at } into
   WebhookLog (injectable, cap 500, list()).
2. OrdersService.place(): add the webhooks/order-created enqueue.
3. Unit tests: N failures then success; the recorded attempts equals N + 1; options
   asserted.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot with WEBHOOK_FAILURES=2, place an order, wait ~5s: WebhookLog shows attempts 3;
  `GET /admin/jobs/webhooks/<id>` shows attemptsMade 2 before success (timeline).

Completion Protocol: standard 5 steps, id 4.2, commit
`feat(api): webhook processor with limiter and deterministic retries (4.2)`.
````

---

### Task 4.3: Report processor: progress (number + object) + lock tuning; concurrency-warning proof

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1

#### Description

Rows 38, 42, 43: a long-running `reports` job emitting `updateProgress(10..100)` and one object form `{ stage, pct }`, registered with a raised `lockDuration`; plus the unit test pinning the audit processor's missing-concurrency warning fallback.

#### Acceptance criteria

- [ ] `ReportProcessor`: `@Processor('reports', { concurrency: 2, lockDuration: 60_000 })`; handler simulates staged work (`setTimeout` steps), calls `updateProgress` with numbers and one object, returns a summary result.
- [ ] `POST /reports` enqueues a report job.
- [ ] Unit test proves the library's warning + `DEFAULT_WORKER_CONCURRENCY` fallback fires for the audit processor (spy on the logger or registration path; row 38).
- [ ] Unit tests for the report handler progress sequence (mock `job.updateProgress`).

#### Files to create / modify

`apps/api/src/processors/report.processor.ts`, `reports.controller.ts`, specs

#### Agent prompt

````
You are a senior NestJS engineer instrumenting long-running jobs.

PROJECT: nest-queue-example, Phase 4 Task 4.3 of 6 (MIDDLE). job.updateProgress accepts
a number or a JSON object; @OnWorkerEvent('progress') consumers arrive in task 4.4.
lockDuration must exceed the handler's worst case so healthy jobs are never stalled.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.5.1 (progress), §6.3 (lockDuration),
  §6.7 (the warning fallback)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 38, 42, 43

TASK
1. processors/report.processor.ts: @Processor('reports', { concurrency: 2,
   lockDuration: 60000 }); @Process('generate') runs 4 staged steps (~500ms each),
   updateProgress(25/50/75) plus one object { stage: 'render', pct: 90 }, returns
   { reportId, durationMs }.
2. reports.controller.ts: POST /reports enqueues reports/generate.
3. Unit tests: progress call sequence asserted; audit-processor warning fallback pinned
   (mock/spy proving the library warned and used DEFAULT_WORKER_CONCURRENCY when no
   concurrency was passed).

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot, POST /reports, `GET /admin/jobs/reports/<id>` mid-run shows progress advancing.

Completion Protocol: standard 5 steps, id 4.3, commit
`feat(api): report processor with progress and lock tuning (4.3)`.
````

---

### Task 4.4: Event decorators bridged to the SSE stream

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.1

#### Description

Rows 44, 45: `@OnWorkerEvent` listeners (completed, failed, progress, active: full `Job` fields) and `@OnQueueEvent` listeners (global, serialized payloads, lazy `QueueEvents` connection) feed a ring buffer exposed as `GET /events/stream` (SSE) and `GET /events/recent`.

#### Acceptance criteria

- [ ] `events/` module: `EventFeed` service (ring buffer cap 200, RxJS Subject for live push), `worker-events` listeners on the email processor class (completed/failed/progress/active) capturing `job.data`, `attemptsMade`, `returnvalue`, and `queue-events` listeners (completed/failed/drained on `webhooks`) capturing `jobId` + string `returnvalue` with a `getJob` fallback lookup demonstrated once.
- [ ] Feed entries are discriminated (`source: 'worker' | 'global'`) so the UI can badge them (and the serialized-vs-full contrast is visible).
- [ ] `GET /events/stream` is a NestJS `@Sse()` endpoint replaying the last 20 then live entries; `GET /events/recent` returns the buffer.
- [ ] Unit tests: listeners push correctly shaped entries; buffer caps; SSE controller maps entries to MessageEvents.

#### Files to create / modify

`apps/api/src/events/*` (module, feed service, listeners, controller), `processors/email.processor.ts` (event methods), specs

#### Agent prompt

````
You are a senior NestJS engineer bridging queue events to Server-Sent Events.

PROJECT: nest-queue-example, Phase 4 Task 4.4 of 6 (MIDDLE). @OnWorkerEvent methods live
on the @Processor class and receive the FULL Job (completed(job), failed(job|undefined,
err), progress(job, progress), active(job)). @OnQueueEvent methods receive serialized
payloads ({ jobId, returnvalue } with lowercase returnvalue as a STRING); the library
lazily opens ONE QueueEvents connection per queue only when such a listener exists.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.5 (both decorators, exact signatures)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 44, 45; §13.2 events page contract

TASK
1. events/event-feed.service.ts: ring buffer (cap 200) + RxJS Subject; push({ source,
   queue, event, jobId, data?, returnvalue?, attemptsMade?, at }).
2. Add @OnWorkerEvent('completed'|'failed'|'progress'|'active') methods to
   EmailProcessor pushing worker-sourced entries with full-Job fields.
3. events/queue-events.listener.ts: a @Processor-less injectable with
   @OnQueueEvent('completed'|'failed'|'drained') for the webhooks queue pushing
   global-sourced entries; on completed, demonstrate the getJob(jobId) fallback once
   (entry gains resolvedData when the job still exists).
4. events/events.controller.ts: @Sse('events/stream') replaying last 20 + live;
   GET /events/recent returns the buffer.
5. Unit tests for the service, listeners, and controller mapping.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot, `curl -N :3080/events/stream` in one terminal, place an order in another:
  worker and global entries appear live with distinct source values.

Completion Protocol: standard 5 steps, id 4.4, commit
`feat(api): worker and queue event bridge with sse stream (4.4)`.
````

---

### Task 4.5: Stalled-recovery demo + graceful-shutdown demo script

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 4.2

#### Description

Rows 42 (stalled side), 63: a documented, reproducible stalled-job demonstration (short lock + hard exit + recovery by the restarted worker) and `scripts/demo-shutdown.mjs` sending SIGTERM mid-job to show the bounded drain.

#### Acceptance criteria

- [ ] `POST /demos/stall` enqueues a `demos` job whose handler sleeps beyond a deliberately short `lockDuration` (5s) configured on the demos processor; README documents the journey: kill the app mid-job (`docker`-free: plain process kill), restart, watch the job recover via the events feed (stalled then completed elsewhere).
- [ ] `scripts/demo-shutdown.mjs`: boots the api as a child process, enqueues a slow job, sends SIGTERM, prints the drain log lines and the exit code; documented in the README.
- [ ] Both demos referenced from the plan's scenario list; nothing flaky lands in unit tests (these are manual/e2e journeys; e2e hardening comes in Phase 8).

#### Files to create / modify

`apps/api/src/demos/*`, `scripts/demo-shutdown.mjs`, `README.md` (journeys section)

#### Agent prompt

````
You are a senior NestJS engineer scripting operational demonstrations.

PROJECT: nest-queue-example, Phase 4 Task 4.5 of 6 (MIDDLE). At-least-once semantics:
a worker that dies mid-job lets the job stall (after lockDuration) and be re-run on
restart. Graceful shutdown drains in-flight jobs within drainTimeoutMs before closing.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §10 (semantics + shutdown)
- docs/TECHNICAL_SPECIFICATION.md §12 scenario 8; §7 rows 42, 63

TASK
1. demos/ module: @Processor('demos', { concurrency: 1, lockDuration: 5000,
   stalledInterval: 5000 }); @Process('stall') sleeps 20s then records completion;
   POST /demos/stall enqueues it. Timeless comments explain the deliberately short lock.
2. scripts/demo-shutdown.mjs (zero-dep, node:child_process): start the built api with
   a .env, wait for ready, POST a report job, send SIGTERM after 1s, stream stdout,
   assert exit 0 within drainTimeoutMs + margin, print PASS/FAIL.
3. README "Operational journeys": the stall recovery walkthrough and the shutdown script.

Constraints:
- English only; no em dashes; timeless comments; deterministic timings with margins.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `node scripts/demo-shutdown.mjs` prints PASS.
- Manual stall journey behaves as documented (job completes after restart).

Completion Protocol: standard 5 steps, id 4.5, commit
`feat(api): stalled recovery and graceful shutdown demos (4.5)`.
````

---

### Task 4.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.2 to 4.5

#### Description

Standard phase close: re-verify all consumer-side journeys, update dashboards, PR with Copilot review, squash-merge on green.

#### Acceptance criteria

- [ ] All 4.1 to 4.5 verifications re-run green (including the SSE journey and the shutdown script).
- [ ] Matrix rows 34 to 45 evidenced in the PR body (46 lands in Phase 8 e2e; noted).
- [ ] Dashboards updated; PR merged squash with branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

````
You are the phase-close auditor for Phase 4 of nest-queue-example.

CURRENT PHASE: 4 (workers-events), Task 4.6 of 6 (LAST).

PRECONDITIONS: tasks 4.1 to 4.5 done on branch feat/phase-04-workers-events.

REQUIRED READING (only these)
- docs/tasks/phase-04-workers-events.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P4 DoD, §6 Update protocol

TASK
Re-run every verification from 4.1 to 4.5 (boot journeys, SSE stream, shutdown script;
fix reds with normal commits). Update dashboards (phase file, plan §1 P4 row, tasks
README). Open the PR: `gh pr create --title "feat(api): phase 4, workers, events and
operational demos"` with the matrix evidence table (rows 34 to 45; row 46 deferred to
the e2e phase, stated). Request the GitHub Copilot code review (gh pr edit
--add-reviewer copilot-pull-request-reviewer[bot] or via the UI); address EVERY
finding; merge only with CI green via `gh pr merge --squash --delete-branch`; verify
branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P4 ✅ 6/6.

Completion Protocol: append `- 4.6 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P4 complete`.
````

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->
