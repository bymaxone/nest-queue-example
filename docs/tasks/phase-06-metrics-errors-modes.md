# Phase 6: metrics-errors-modes

> **Status**: 🔄 In Progress · **Progress**: 1 / 5 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P6)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §7.1, §7.3, §7.6; matrix rows 7, 8, 9, 28 to 30, 33, 66, 67, 68

## Context

Every feature area now works on the default configuration. This phase completes the operational envelope: the cached `MetricsService` surface, the full error catalog through the error explorer, the alternate connection configurations (Mode A shared client, options-style Mode B) with the per-role retry-policy proof, and the optional OpenTelemetry integration.

## Rules-of-phase

1. Error-explorer endpoints trigger REAL library errors; nothing is simulated by constructing envelopes manually.
2. Connection-mode switches are env-driven and mutually exclusive; the diagnostics endpoint is the single source of truth about the active mode.
3. `bullmq-otel` enters `apps/api` dependencies only in this phase and loads lazily behind the flag; when the flag is off it must not load (asserted).
4. Never echo connection credentials anywhere (diagnostics, errors, logs).

## Reference docs

- Library spec §2.2/§2.3 (modes + retry policy), §9 (metrics), §12 (error catalog), §4.1 (`telemetry`).
- Spec §9.1 (factory branches), §12 scenario 9.

## Task index

| ID  | Task                                                                   | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 6.1 | Branch + `MetricsService` surface + readiness composition              | ✅ Done | P0       | S    | Phase 5    |
| 6.2 | Error explorer: the full reproducible catalog                          | 📋 ToDo | P0       | M    | Phase 5    |
| 6.3 | Mode A shared client + options-style Mode B + retry-policy diagnostics | 📋 ToDo | P0       | M    | Phase 5    |
| 6.4 | Optional telemetry (`bullmq-otel`) behind `QUEUE_OTEL`                 | 📋 ToDo | P1       | S    | 6.3        |
| 6.5 | Phase close: audit, dashboards, PR with Copilot review                 | 📋 ToDo | P0       | S    | 6.2 to 6.4 |

## Tasks

### Task 6.1: Branch + `MetricsService` surface + readiness composition

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 5

#### Description

Rows 28 to 30, 33: expose the cached metrics surface (`get`, `getAll`, `invalidate`) and rebuild `/health/ready` on it (the library-documented consumer-side health pattern), making cache freshness observable via `collectedAt`.

#### Acceptance criteria

- [x] Branch `feat/phase-06-metrics-errors-modes` created with `git switch -c`.
- [x] `GET /admin/metrics` returns `MetricsService.getAll()`; `GET /admin/metrics/:queue` returns `get(queue)`; `POST /admin/metrics/invalidate { queue? }` forces refresh.
- [x] Two rapid calls inside the 3s TTL return the same `collectedAt` (cache hit); after invalidate, a new one (asserted in tests).
- [x] `/health/ready` composes `MetricsService` (aggregate active count + Redis reachability) per the library's documented pattern.
- [x] Unit tests for the controller and readiness composition.

#### Files to create / modify

`apps/api/src/admin/metrics.controller.ts`, `health.controller.ts` (rework), specs

#### Agent prompt

```
You are a senior NestJS engineer exposing cached queue metrics.

PROJECT: nest-queue-example, Phase 6 Task 6.1 of 5 (FIRST). MetricsService (enabled,
cacheTtlMs 3000) exposes get(queue), getAll(), invalidate(queue?). QueueMetrics carries
{ queue, counts { waiting, active, completed, failed, delayed, paused }, collectedAt }.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §9.4, §9.5
- docs/TECHNICAL_SPECIFICATION.md §7 rows 28 to 30, 33

TASK
Create the branch (`git switch -c feat/phase-06-metrics-errors-modes`), then implement
the metrics endpoints and the readiness rework per the acceptance criteria. The cache
behavior test freezes time or spies the underlying getMetrics to count Redis roundtrips.

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot: two `curl :3080/admin/metrics/email` within 3s share collectedAt; POST
  invalidate then GET yields a fresh one. /health/ready still 200 with Redis up,
  503 when stopped.

Completion Protocol: standard 5 steps (phase file, plan §1 P6 row, tasks README,
completion log), commit `feat(api): cached metrics surface and readiness composition (6.1)`.
```

---

### Task 6.2: Error explorer: the full reproducible catalog

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 5

#### Description

Rows 66, 67: `POST /errors/trigger/:code` provokes every catalog code reproducible inside a running app (`queue_not_found`, `job_not_found`, `invalid_job_data` via the zod-checked enqueue, `invalid_repeat_options` x4, `bulk_enqueue_failed`, `invalid_options` via an isolated module compile, `duplicate_processor` via an isolated module compile); each response is the library's untouched envelope. Boot-time codes (`connection_invalid`, `connection_timeout`, `connection_requires_null_retries`, `shutdown_timeout_exceeded`) are documented here and asserted in the Phase 8 e2e specs.

#### Acceptance criteria

- [ ] `GET /errors/catalog` returns the full `QUEUE_ERROR_CODES` map with HTTP statuses and a `reproducibleHere: boolean` flag per code.
- [ ] `POST /errors/trigger/:code` supports every `reproducibleHere` code by invoking the real failing operation; responses carry the stable envelope with correct HTTP status.
- [ ] `duplicate_processor` and `invalid_options` triggers compile a throwaway Nest module in-process (isolated `Test.createTestingModule`-style bootstrap inside the service) so the main app stays healthy.
- [ ] Unit tests: every trigger path asserts `error.code`, HTTP status, and envelope shape.

#### Files to create / modify

`apps/api/src/errors/error-explorer.controller.ts`, `error-explorer.service.ts`, `errors.module.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer building a living error catalog.

PROJECT: nest-queue-example, Phase 6 Task 6.2 of 5 (MIDDLE). QueueException produces
{ error: { code, message, details } } with an HTTP status derived from the code. The
twelve queue.* codes and their statuses live in QUEUE_ERROR_CODES / the library's
§12.2 table. Errors must be provoked for real, never fabricated.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §12 (catalog + statuses)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 66, 67; §18 note 4

TASK
1. errors/error-explorer.service.ts: one trigger method per reproducible code:
   queue_not_found (metrics on an unknown queue), job_not_found (getJob with a fake id),
   invalid_job_data (the zod-validated enqueue endpoint given a bad payload),
   invalid_repeat_options (the four §8.5 variants), bulk_enqueue_failed (1001 jobs),
   duplicate_processor + invalid_options (bootstrap a throwaway testing module wired
   wrong, capture the thrown QueueException, rethrow it).
2. GET /errors/catalog (full map + reproducibleHere flags + where the non-reproducible
   ones are covered: the e2e suite). POST /errors/trigger/:code.
3. Unit tests per trigger asserting code, status, envelope.

Constraints:
- Let library exceptions propagate untouched (a Nest exception filter must not rewrap).
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `for c in queue_not_found job_not_found bulk_enqueue_failed; do curl -s -X POST
  :3080/errors/trigger/$c | jq .error.code; done` prints the three codes.
- GET /errors/catalog lists 12 codes.

Completion Protocol: standard 5 steps, id 6.2, commit
`feat(api): error explorer covering the reproducible catalog (6.2)`.
```

---

### Task 6.3: Mode A shared client + options-style Mode B + retry-policy diagnostics

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 5

#### Description

Rows 7, 8, 9: complete the `buildQueueOptions` union. `QUEUE_CONNECTION_MODE=shared` registers an app-owned ioredis provider and passes `{ client }` (Mode A, the shape a `@bymax-one/nest-cache` host would produce); `QUEUE_CONNECTION_STYLE=options` exercises the `{ options }` branch; the diagnostics endpoint reports `maxRetriesPerRequest` per connection role, proving the queue-role default vs worker-role `null` split.

#### Acceptance criteria

- [ ] `config/shared-redis.provider.ts`: conditional provider (`SHARED_REDIS` Symbol) creating an app-owned ioredis client only when mode is `shared`, closed on app shutdown by the app (Mode A contract: the lib never closes it).
- [ ] `buildQueueOptions` completes the spec §9.1 union (client vs options vs url); factory unit tests cover all three branches.
- [ ] `GET /admin/diagnostics` gains `connection: { mode, style, queueRoleMaxRetries, workerRoleMaxRetries }` read from the injected `BYMAX_QUEUE_REDIS_CLIENT` and a registered worker's connection (values, not credentials).
- [ ] Boot journeys documented for the three configurations (README matrix).
- [ ] Unit tests: provider conditionality, diagnostics projection.

#### Files to create / modify

`apps/api/src/config/shared-redis.provider.ts`, `config/queue.config.ts` (+ spec), `admin/diagnostics.controller.ts`, `README.md` (connection matrix)

#### Agent prompt

```
You are a senior NestJS engineer completing the connection-mode matrix.

PROJECT: nest-queue-example, Phase 6 Task 6.3 of 5 (MIDDLE). Mode A: the app provides
an ioredis client ({ client }); the lib uses it for the Queue role and duplicates it
with maxRetriesPerRequest: null for Worker/QueueEvents roles; the lib never closes an
injected client. Mode B options-style passes RedisOptions. The per-role retry policy is
the library's signature correctness feature: prove it observably.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §2.2, §2.3 (the roles table), §11.1
- docs/TECHNICAL_SPECIFICATION.md §9.1, §7 rows 7, 8, 9

TASK
1. config/shared-redis.provider.ts: SHARED_REDIS Symbol provider (useFactory over
   APP_ENV) creating ioredis from REDIS_URL only when QUEUE_CONNECTION_MODE=shared,
   with an OnApplicationShutdown hook in the app closing it (comment: Mode A contract,
   the lib does not own it).
2. Complete buildQueueOptions exactly per spec §9.1 (client > options > url precedence);
   extend queue.config.spec.ts to all branches.
3. Diagnostics: report mode/style plus queueRoleMaxRetries (from the injected
   BYMAX_QUEUE_REDIS_CLIENT options) and workerRoleMaxRetries (null expected; read from
   a registered worker connection surface or document the duplicate() override with the
   asserted value from an integration probe).
4. README connection matrix: the three env recipes and what diagnostics should show.

Constraints:
- Never print hosts/passwords; values and roles only.
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Three boots (default url; QUEUE_CONNECTION_STYLE=options; QUEUE_CONNECTION_MODE=shared):
  all healthy, diagnostics reflects each; in every case workerRoleMaxRetries is null and
  queueRoleMaxRetries is not.

Completion Protocol: standard 5 steps, id 6.3, commit
`feat(api): connection mode matrix with retry-policy diagnostics (6.3)`.
```

---

### Task 6.4: Optional telemetry (`bullmq-otel`) behind `QUEUE_OTEL`

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 6.3

#### Description

Row 68: when `QUEUE_OTEL=true`, the options factory attaches a lazily imported `BullMQOtel` telemetry instance; an in-memory span exporter (test-only) proves spans propagate from `enqueue` into the handler. When the flag is off, `bullmq-otel` is never loaded.

#### Acceptance criteria

- [ ] `config/telemetry.config.ts`: `buildTelemetry()` dynamically imports `bullmq-otel` (async factory path); no top-level import anywhere (grep gate).
- [ ] Factory passes `telemetry` only when the flag is on (branch unit-tested both ways).
- [ ] An integration-style test with `@opentelemetry/sdk-trace-node` + in-memory exporter (devDependencies) asserts at least one span for an enqueue-process cycle when enabled.
- [ ] A unit test asserts the module graph does not load `bullmq-otel` when disabled (spy on the dynamic import seam).

#### Files to create / modify

`apps/api/src/config/telemetry.config.ts`, `queue.config.ts` (async branch), `package.json` (bullmq-otel dep + otel devDeps), specs

#### Agent prompt

```
You are a senior Node.js observability engineer wiring optional OpenTelemetry.

PROJECT: nest-queue-example, Phase 6 Task 6.4 of 5 (MIDDLE). The library accepts a
BullMQ Telemetry instance (typically new BullMQOtel(...) from bullmq-otel) and attaches
it to every Queue/Worker so trace context propagates from enqueue() into handlers.
bullmq-otel is optional: it must load ONLY when QUEUE_OTEL=true.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §4.1 (telemetry option)
- docs/TECHNICAL_SPECIFICATION.md §7 row 68; §17 (no collector ships)

TASK
1. config/telemetry.config.ts: export async buildTelemetry(): Promise<Telemetry> doing
   `const { BullMQOtel } = await import('bullmq-otel')` and constructing it; the
   dynamic import lives behind an injectable seam so tests can spy it.
2. Make the options factory async-capable for this branch (forRootAsync factories may
   be async): spread { telemetry } only when env.QUEUE_OTEL.
3. Add bullmq-otel to apps/api dependencies; otel sdk-trace-node + in-memory exporter
   as devDependencies.
4. Tests: flag-off never triggers the import (spy); flag-on integration test records
   >= 1 span across an enqueue-process cycle on a throwaway queue.

Constraints:
- No top-level `import ... from 'bullmq-otel'` anywhere:
  `grep -rn "from 'bullmq-otel'" apps/api/src` must return nothing.
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- The grep gate above passes; `pnpm --filter @nest-queue-example/api test` green with
  the span assertion running against compose Redis.

Completion Protocol: standard 5 steps, id 6.4, commit
`feat(api): optional bullmq-otel telemetry behind env flag (6.4)`.
```

---

### Task 6.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 6.2 to 6.4

#### Description

Standard phase close: re-verify metrics caching, the error catalog, the three connection configurations, and the telemetry flag; dashboards; PR with Copilot review; squash-merge on green.

#### Acceptance criteria

- [ ] All 6.1 to 6.4 verifications re-run green (three-boot connection journey included).
- [ ] Matrix rows 7, 8, 9, 28 to 30, 33, 66, 67 (reproducible part), 68 evidenced in the PR body.
- [ ] Dashboards updated; PR merged squash with branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 6 of nest-queue-example.

CURRENT PHASE: 6 (metrics-errors-modes), Task 6.5 of 5 (LAST).

PRECONDITIONS: tasks 6.1 to 6.4 done on branch feat/phase-06-metrics-errors-modes.

REQUIRED READING (only these)
- docs/tasks/phase-06-metrics-errors-modes.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P6 DoD, §6 Update protocol

TASK
Re-run every verification from 6.1 to 6.4 including the three-boot connection matrix
(fix reds with normal commits). Update dashboards (phase file, plan §1 P6 row, tasks
README). Open the PR: `gh pr create --title "feat(api): phase 6, metrics, error catalog
and connection modes"` with the matrix evidence table. Request the GitHub Copilot code
review (gh pr edit --add-reviewer copilot-pull-request-reviewer[bot] or via the UI);
address EVERY finding; merge only with CI green via
`gh pr merge --squash --delete-branch`; verify branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P6 ✅ 5/5.

Completion Protocol: append `- 6.5 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P6 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 6.1 ✅ 2026-07-09 Cached metrics controller (getAll / get / invalidate) with allow-list guard; `/health/ready` recomposed on MetricsService (cached reachability probe + active-count aggregate); shared `assertKnownQueue` guard extracted.
