# Phase 5: flows-schedulers-dynamic

> **Status**: 🔄 In Progress · **Progress**: 1 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P5)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §7.4 rows 47 to 49, §7.5; matrix rows 47 to 62

## Context

The consumer side works job by job. This phase covers structured work: BullMQ Flows through `FlowService` (with the three failure-propagation postures), Job Schedulers (the only recurring-jobs API the library exposes), and runtime worker management (dynamic per-tenant workers plus the sandboxed CPU-bound processor).

## Rules-of-phase

1. Never call any repeatable-jobs legacy API; schedulers only (`upsertJobScheduler` / `removeJobScheduler` / `getJobSchedulers`).
2. Scheduler registration is boot-time (`OnApplicationBootstrap`), idempotent by `schedulerId`; a reboot must not duplicate schedulers.
3. Flow child failure semantics are demonstrated, not patched around: the stuck-parent variant stays stuck by design and the UI/docs say so.
4. The sandboxed processor file is a built artifact with no NestJS imports; everything it needs arrives via `job.data`.

## Reference docs

- Library spec §7 (flows), §8 (schedulers), §6.6/§6.8 (registry + sandboxed).
- Spec §12 scenarios 4 to 7.

## Task index

| ID  | Task                                                               | Status  | Priority | Size | Depends on    |
| --- | ------------------------------------------------------------------ | ------- | -------- | ---- | ------------- |
| 5.1 | Branch + fulfillment flow (fan-out/fan-in, nested) + tree endpoint | ✅ Done | P0       | M    | Phase 4       |
| 5.2 | Failure-propagation variants + `addBulk`                           | 📋 ToDo | P0       | M    | 5.1           |
| 5.3 | Boot schedulers + management endpoints + validation errors         | 📋 ToDo | P0       | M    | Phase 4       |
| 5.4 | Dynamic per-tenant workers via `WorkerRegistry`                    | 📋 ToDo | P0       | S    | Phase 4       |
| 5.5 | Sandboxed invoice processor (`registerSandboxed`)                  | 📋 ToDo | P0       | M    | 5.4           |
| 5.6 | Phase close: audit, dashboards, PR with Copilot review             | 📋 ToDo | P0       | S    | 5.2, 5.3, 5.5 |

## Tasks

### Task 5.1: Branch + fulfillment flow (fan-out/fan-in, nested) + tree endpoint

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 4

#### Description

Rows 50, 51, 56: the fulfillment flow (`ship-order` parent; `reserve-stock` + `charge-payment` children; an `invoice` child with two nested `fetch-data` grandchildren), processors for each node queue, and `GET /flows/:rootId/tree` reading the live tree via `getProducer`.

#### Acceptance criteria

- [x] Branch `feat/phase-05-flows-schedulers-dynamic` created with `git switch -c`.
- [x] `flows/fulfillment.service.ts` builds the `FlowJob` tree; `POST /flows/fulfillment` (variant `default`) runs it; node processors (`fulfillment`, `stock`, `payments`, `invoices-data` queues) record execution order in an in-memory `FlowTrace`.
- [x] Parent completes only after every descendant (assert order in the trace).
- [x] `GET /flows/:rootId/tree` returns the tree with per-node `{ name, queue, status }` via the producer (row 56).
- [x] Unit tests: tree construction shape, trace ordering with mocked processors.

#### Files to create / modify

`apps/api/src/flows/*` (module, service, controller, trace, node processors), specs

#### Agent prompt

```
You are a senior NestJS engineer orchestrating BullMQ flows.

PROJECT: nest-queue-example, Phase 5 Task 5.1 of 6 (FIRST). FlowService (enabled via
flows.enabled) exposes add(flow), addBulk, getProducer. A parent becomes processable
only after ALL descendants complete.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §7.1 to §7.3
- docs/TECHNICAL_SPECIFICATION.md §7 rows 50, 51, 56; §12 scenario 4

TASK
Create the branch (`git switch -c feat/phase-05-flows-schedulers-dynamic`), then:
1. flows/fulfillment.service.ts: buildFulfillmentFlow(orderId) returning the FlowJob
   tree (ship-order on 'fulfillment'; children reserve-stock on 'stock', charge-payment
   on 'payments', render-invoice on 'fulfillment' with children fetch-lines +
   fetch-customer on 'invoices-data'); run() calling flowService.add.
2. Node processors (one class per queue, concurrency 2) recording { node, at } into an
   injectable FlowTrace (cap 500).
3. flows/flows.controller.ts: POST /flows/fulfillment { orderId, variant: 'default' },
   GET /flows/:rootId/tree walking the JobNode tree via getProducer + job.getState().
4. Unit tests: tree shape, trace order (children before parent), controller mapping.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot, POST /flows/fulfillment, poll the tree endpoint: leaves complete first, then
  render-invoice, then ship-order; FlowTrace confirms the order.

Completion Protocol: standard 5 steps (phase file, plan §1 P5 row, tasks README,
completion log), commit `feat(api): fulfillment flow with live tree endpoint (5.1)`.
```

---

### Task 5.2: Failure-propagation variants + `addBulk`

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.1

#### Description

Rows 52 to 55: the three postures side by side. Variant `stuck`: a child exhausts retries WITHOUT `failParentOnFailure`; the parent stays `waiting-children` (documented pitfall). Variant `failParent`: the same child with `failParentOnFailure: true` fails the root. Variant `ignoreDependency`: the parent proceeds despite the failed optional child. Plus `POST /flows/fulfillment/bulk` via `addBulk`.

#### Acceptance criteria

- [ ] `variant` extends to `stuck | failParent | ignoreDependency`; failure injection: the `charge-payment` child throws always when `orderId` starts with `fail-` (deterministic, attempts capped at 1 for the demo variants).
- [ ] `stuck`: after child failure, tree endpoint shows the parent in `waiting-children` and the docs/UI copy explains why this is BullMQ's default.
- [ ] `failParent`: root reaches `failed` with the child's failure reason.
- [ ] `ignoreDependency`: root completes; the failed child is visible in the tree.
- [ ] `POST /flows/fulfillment/bulk { orderIds }` uses `addBulk` (row 55).
- [ ] Unit tests: flow-definition flags per variant asserted; bulk order preserved.

#### Files to create / modify

`apps/api/src/flows/fulfillment.service.ts`, `flows.controller.ts`, node processor (failure injection), specs

#### Agent prompt

```
You are a senior NestJS engineer demonstrating flow failure semantics honestly.

PROJECT: nest-queue-example, Phase 5 Task 5.2 of 6 (MIDDLE). BullMQ default: a
retry-exhausted child does NOT fail its parent; the parent waits in waiting-children
indefinitely. failParentOnFailure: true on a child propagates the failure up.
ignoreDependencyOnFailure: true lets the parent proceed.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §7.1 (the pitfall callout), §7.2
- docs/TECHNICAL_SPECIFICATION.md §7 rows 52 to 55

TASK
1. Extend buildFulfillmentFlow with the variant parameter mapping exactly:
   stuck (no flags), failParent (failParentOnFailure: true on charge-payment),
   ignoreDependency (ignoreDependencyOnFailure: true on charge-payment). Demo variants
   set opts.attempts: 1 on the failing child so outcomes are fast and deterministic.
2. payments processor: throw when job.data.orderId startsWith 'fail-'.
3. POST /flows/fulfillment/bulk { orderIds: string[] } via flowService.addBulk.
4. Unit tests: per-variant flag placement in the FlowJob tree; bulk mapping.

Constraints:
- Do NOT auto-recover the stuck parent; the pitfall is the demonstration. Document it
  in a timeless comment and in the endpoint's response copy.
- English only; no em dashes; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Three POSTs with orderId 'fail-1' and each variant, then the tree endpoint:
  stuck -> parent waiting-children; failParent -> parent failed; ignoreDependency ->
  parent completed with failed child visible.

Completion Protocol: standard 5 steps, id 5.2, commit
`feat(api): flow failure-propagation variants and bulk flows (5.2)`.
```

---

### Task 5.3: Boot schedulers + management endpoints + validation errors

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 4

#### Description

Rows 57 to 62: three boot-registered schedulers (nightly cron with tz, 6-field seconds heartbeat, interval with offset and limit), the management endpoints, and the four `queue.invalid_repeat_options` validation triggers.

#### Acceptance criteria

- [ ] `schedulers/boot-schedulers.service.ts` (`OnApplicationBootstrap`) upserts: `nightly-cleanup` (`0 3 * * *`, `America/Sao_Paulo`) on `maintenance`; `demo-heartbeat` (`*/30 * * * * *`) on `monitoring`; `metrics-snapshot` (`every: 300000, offset: 15000, limit: 100`) on `monitoring`; templates carry names + data.
- [ ] Reboot idempotency: a second bootstrap run yields the same three schedulers, no duplicates (`getJobSchedulers` count stable; asserted in a unit/integration test).
- [ ] `GET /schedulers?queue=` (paginated), `PUT /schedulers/:queue/:id` (upsert from body), `DELETE /schedulers/:queue/:id` (returns `{ removed }`).
- [ ] Validation triggers: PUT with both `pattern`+`every`, neither, `every: 0`, and unparseable cron each return the `queue.invalid_repeat_options` envelope (400).
- [ ] Heartbeat processor records ticks so the scheduler clock is observable.

#### Files to create / modify

`apps/api/src/schedulers/*` (boot service, controller, heartbeat processor), specs

#### Agent prompt

```
You are a senior NestJS engineer wiring recurring jobs the current-API way.

PROJECT: nest-queue-example, Phase 5 Task 5.3 of 6 (MIDDLE). Only Job Schedulers exist:
upsertJobScheduler(queue, schedulerId, repeat, template) idempotent by schedulerId;
removeJobScheduler; getJobSchedulers(queue, start, end, asc). Cron accepts 5-field and
6-field (seconds) patterns; interval accepts every + offset + limit. Validation errors
surface as queue.invalid_repeat_options (400). Register at OnApplicationBootstrap.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §8 (all subsections)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 57 to 62; §12 scenario 5

TASK
1. schedulers/boot-schedulers.service.ts: OnApplicationBootstrap registering the three
   schedulers from the acceptance criteria (typed templates; a timeless comment explains
   idempotent-by-id boot registration).
2. schedulers/heartbeat.processor.ts on 'monitoring' recording ticks (cap 200).
3. schedulers/schedulers.controller.ts: GET (paginated list), PUT (upsert from a zod
   body accepting either pattern-or-every unions), DELETE.
4. Unit tests: boot registration calls, reboot idempotency (second run, stable count),
   the four validation triggers returning the envelope.

Constraints:
- Never reference or call any addRepeatable/getRepeatableJobs legacy API.
- English only; no em dashes; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot, wait 35s: heartbeat ticks recorded. Restart the app: GET /schedulers?queue=
  monitoring still lists exactly 2 (no duplicates). The four invalid PUTs return 400
  with error.code queue.invalid_repeat_options.

Completion Protocol: standard 5 steps, id 5.3, commit
`feat(api): boot-registered job schedulers with management api (5.3)`.
```

---

### Task 5.4: Dynamic per-tenant workers via `WorkerRegistry`

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 4

#### Description

Rows 47, 48: runtime worker management. `POST /workers/tenants { tenantId, tier }` registers a worker on `notifications:<tenantId>` (concurrency 10 premium, 2 free); `DELETE` unregisters; `GET` lists via `registry.list()`.

#### Acceptance criteria

- [ ] `workers/tenant-workers.service.ts` wraps `WorkerRegistry.register` with the tenant handler (records deliveries per tenant) and tier-mapped concurrency.
- [ ] `POST /workers/tenants`, `DELETE /workers/tenants/:tenantId`, `GET /workers/tenants` (from `list()`), plus `POST /workers/tenants/:tenantId/notify` enqueuing into the tenant queue to prove the dynamic worker consumes.
- [ ] Unregistering stops consumption (subsequent enqueues wait; asserted in test with a re-register draining them).
- [ ] Unit tests: registration config mapping, unregister path, list projection.

#### Files to create / modify

`apps/api/src/workers/tenant-workers.service.ts`, `tenant-workers.controller.ts`, `workers.module.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer managing workers at runtime.

PROJECT: nest-queue-example, Phase 5 Task 5.4 of 6 (MIDDLE). WorkerRegistry (advanced
surface) exposes register({ queueName, handler, options }), unregister(queueName),
list(). Dynamic per-tenant queues follow the pattern notifications:<tenantId>.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.6
- docs/TECHNICAL_SPECIFICATION.md §7 rows 47, 48; §12 scenario 6

TASK
Implement the tenant-workers service + controller per the acceptance criteria: tier
'premium' -> concurrency 10, 'free' -> concurrency 2; handler records { tenantId,
notification, at } into an injectable TenantDeliveries (cap 500); notify endpoint
enqueues into the tenant queue via QueueService.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot: create tenant t1 premium, notify twice, GET deliveries via the trail; DELETE
  the worker, notify once (stays waiting), re-create the worker, delivery drains.
- GET /workers/tenants reflects list() exactly.

Completion Protocol: standard 5 steps, id 5.4, commit
`feat(api): dynamic per-tenant workers via registry (5.4)`.
```

---

### Task 5.5: Sandboxed invoice processor (`registerSandboxed`)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.4

#### Description

Row 49: CPU-bound work out of process. A standalone `invoice.sandboxed.ts` (no NestJS imports) compiled into `dist`, registered at boot via `registerSandboxed` with `concurrency: 2`; `POST /workers/invoices/render` enqueues; the event loop stays responsive during renders.

#### Acceptance criteria

- [ ] `workers/invoice.sandboxed.ts`: default-export async function over `SandboxedJob` doing deterministic CPU work (e.g. iterative hashing of `job.data.lines`), returning `{ invoiceId, checksum, durationMs }`; ZERO NestJS imports; documented constraints (no DI, serializable data only).
- [ ] Build wiring guarantees the compiled `.js` lands in `dist` and the registration resolves it via a URL relative to the compiled module (works in dev and build).
- [ ] Boot registration via `registerSandboxed({ queueName: 'invoices', processorFile, options: { concurrency: 2 } })`; `useWorkerThreads` exposed through env `INVOICE_WORKER_THREADS` (default false).
- [ ] `POST /workers/invoices/render { invoiceId, lines }` enqueues; an event-loop-lag probe endpoint shows lag stays low during a render (demonstration, not a benchmark).
- [ ] Unit tests: the sandboxed function's logic (imported directly), registration options.

#### Files to create / modify

`apps/api/src/workers/invoice.sandboxed.ts`, `sandboxed-bootstrap.service.ts`, `invoices.controller.ts`, build config touch-ups, specs

#### Agent prompt

```
You are a senior Node.js engineer offloading CPU work to sandboxed processors.

PROJECT: nest-queue-example, Phase 5 Task 5.5 of 6 (MIDDLE). Sandboxed processors are
FILE-based: a default-export async function receiving SandboxedJob, run in a separate
process (or worker thread), with NO NestJS DI; register via
WorkerRegistry.registerSandboxed({ queueName, processorFile, options }). The file must
be a built artifact reachable at runtime.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.8
- docs/TECHNICAL_SPECIFICATION.md §7 row 49; §18 note 1

TASK
1. workers/invoice.sandboxed.ts: pure default-export doing iterative sha256 hashing
   over job.data.lines (node:crypto), returning { invoiceId, checksum, durationMs }.
   Header comment documents the sandbox constraints (no DI; everything via job.data).
2. sandboxed-bootstrap.service.ts (OnApplicationBootstrap): registerSandboxed with the
   compiled file URL (new URL('./invoice.sandboxed.js', import.meta.url) or the CJS
   equivalent matching the build output), concurrency 2, useWorkerThreads from env.
3. invoices.controller.ts: POST /workers/invoices/render; GET /workers/lag returning a
   simple event-loop-delay sample (node:perf_hooks monitorEventLoopDelay).
4. Verify the build emits the sandboxed file where the URL points; adjust tsconfig
   include if needed.
5. Unit tests: hashing determinism, registration options (registry mocked).

Constraints:
- The sandboxed file imports NOTHING from @nestjs/* or the app; node builtins only.
- English only; no em dashes; timeless comments; TS strict; 100% on unit-testable files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot (built mode), POST a render with 200 lines: completes with a checksum;
  GET /workers/lag during the render stays under ~50ms mean.

Completion Protocol: standard 5 steps, id 5.5, commit
`feat(api): sandboxed invoice processor with build wiring (5.5)`.
```

---

### Task 5.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 5.2, 5.3, 5.5

#### Description

Standard phase close: re-verify flows, schedulers, dynamic and sandboxed workers, update dashboards, PR with Copilot review, squash-merge on green.

#### Acceptance criteria

- [ ] All 5.1 to 5.5 verifications re-run green (including reboot idempotency and the three flow variants).
- [ ] Matrix rows 47 to 62 evidenced in the PR body.
- [ ] Dashboards updated; PR merged squash with branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 5 of nest-queue-example.

CURRENT PHASE: 5 (flows-schedulers-dynamic), Task 5.6 of 6 (LAST).

PRECONDITIONS: tasks 5.1 to 5.5 done on branch feat/phase-05-flows-schedulers-dynamic.

REQUIRED READING (only these)
- docs/tasks/phase-05-flows-schedulers-dynamic.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P5 DoD, §6 Update protocol

TASK
Re-run every verification from 5.1 to 5.5 (flow variants, scheduler reboot idempotency,
tenant worker lifecycle, sandboxed render; fix reds with normal commits). Update
dashboards (phase file, plan §1 P5 row, tasks README). Open the PR: `gh pr create
--title "feat(api): phase 5, flows, schedulers and runtime workers"` with the matrix
evidence table (rows 47 to 62). Request the GitHub Copilot code review (gh pr edit
--add-reviewer copilot-pull-request-reviewer[bot] or via the UI); address EVERY
finding; merge only with CI green via `gh pr merge --squash --delete-branch`; verify
branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P5 ✅ 6/6.

Completion Protocol: append `- 5.6 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P5 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 5.1 ✅ 2026-07-09 fulfillment flow (fan-out/fan-in + nested invoice branch), node processors with FlowTrace, and the live tree endpoint via getProducer
