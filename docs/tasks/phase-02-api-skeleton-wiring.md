# Phase 2: api-skeleton-wiring

> **Status**: 📋 ToDo · **Progress**: 0 / 5 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P2)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §9, §10; matrix rows 1, 4, 5, 6, 10, 11

## Context

Phases 0 and 1 delivered governance and package resolution. This phase turns `apps/api` into a booting NestJS 11 application with `BymaxQueueModule` wired through `forRootAsync`, one smoke queue proving the enqueue-to-process loop, health endpoints, and a real Jest unit setup (removing CI's `--passWithNoTests`).

## Rules-of-phase

1. `process.env` is read exactly once, in `src/config/env.ts` (typed parse with zod); everything else receives parsed config via DI.
2. `buildQueueOptions` (spec §9.1) is a pure function, unit-tested on every branch it has at this point (Mode B url default; other branches join in Phase 6).
3. Jest configs carry `maxWorkers: '50%'`; the coverage threshold applies to implemented files from this phase onward.
4. The library probe from Phase 1 is replaced by real wiring; delete it here.

## Reference docs

- Spec §9 (env table + §9.1 canonical wiring), §10.1 module map, §7 rows listed above.
- Library `../nest-queue/docs/technical_specification.md` §4 (options), §6.2 (@Processor).

## Task index

| ID  | Task                                                             | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 2.1 | Branch + NestJS skeleton + typed env parsing                     | 📋 ToDo | P0       | M    | Phase 1    |
| 2.2 | `buildQueueOptions` factory + `forRootAsync` wiring + unit tests | 📋 ToDo | P0       | M    | 2.1        |
| 2.3 | Audit processor + smoke enqueue endpoint                         | 📋 ToDo | P0       | S    | 2.2        |
| 2.4 | Health endpoints + diagnostics skeleton + CI unit gate for real  | 📋 ToDo | P0       | S    | 2.3        |
| 2.5 | Phase close: audit, dashboards, PR with Copilot review           | 📋 ToDo | P0       | S    | 2.4        |

## Tasks

### Task 2.1: Branch + NestJS skeleton + typed env parsing

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 1

#### Description

Bootstrap NestJS 11 in `apps/api`: `main.ts` (shutdown hooks enabled, CORS from `WEB_ORIGIN`), `AppModule`, and `config/env.ts` parsing every spec §9 variable with zod into a frozen `AppEnv` provided under a Symbol token.

#### Acceptance criteria

- [ ] Branch `feat/phase-02-api-skeleton-wiring` created with `git switch -c`.
- [ ] `apps/api` gains `@nestjs/platform-express` (or fastify per sibling convention: express), `zod`, `nest-cli.json`, `tsconfig.build.json`; `pnpm --filter api build` green.
- [ ] `src/config/env.ts`: zod schema for every §9 variable with defaults; parse-once at bootstrap; exported `APP_ENV` Symbol token + provider; `app.enableShutdownHooks()` in `main.ts`.
- [ ] Bad env (e.g. `QUEUE_DRAIN_TIMEOUT_MS=abc`) fails boot with a readable aggregated error.
- [ ] Phase 1 probes deleted (`library-probe.ts` still present until 2.2 replaces the import usage; delete here if unused).

#### Files to create / modify

`apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/config/env.ts`, `apps/api/nest-cli.json`, `apps/api/tsconfig.build.json`, `apps/api/package.json`

#### Agent prompt

```
You are a senior NestJS engineer bootstrapping the reference api.

PROJECT: nest-queue-example. apps/api consumes @bymax-one/nest-queue via a file: link
(dist + exports). Node >= 24; env loads via --env-file (dotenv is banned).

CURRENT PHASE: 2 (api-skeleton-wiring), Task 2.1 of 5 (FIRST).

PRECONDITIONS: Phase 1 merged (packages + probes exist).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9 (env table), §10.2 house style

TASK
Create the branch (`git switch -c feat/phase-02-api-skeleton-wiring`), then: NestJS 11
skeleton (main.ts with enableShutdownHooks + CORS from WEB_ORIGIN, AppModule),
config/env.ts (zod schema covering EVERY §9 variable with defaults, parsed once,
deep-frozen, provided under an APP_ENV Symbol token), nest-cli.json, build config,
start scripts (start:dev with --env-file=.env).

Constraints:
- process.env is read ONLY inside config/env.ts. Every file: @fileoverview + @layer
  header, imperative JSDoc on exports, functions <= 50 lines.
- English only; no em dashes; timeless comments; TS strict; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-queue-example/api build` exit 0.
- `QUEUE_DRAIN_TIMEOUT_MS=abc pnpm --filter @nest-queue-example/api start` fails fast
  with a readable error naming the variable.

Completion Protocol: standard 5 steps (this file, plan §1 P2 row, tasks README,
completion log), commit `feat(api): nest skeleton with typed env parsing (2.1)`.
```

---

### Task 2.2: `buildQueueOptions` factory + `forRootAsync` wiring + unit tests

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.1

#### Description

Implement spec §9.1: the pure `buildQueueOptions(env)` factory (Mode B url, prefix, defaultJobOptions, flows/metrics enabled, shutdown block) and wire `BymaxQueueModule.forRootAsync` in `AppModule`. Unit-test every current branch of the factory. This covers matrix rows 1, 6, 10, 11 (config side).

#### Acceptance criteria

- [ ] `src/config/queue.config.ts` exports pure `buildQueueOptions(env: AppEnv): BymaxQueueModuleOptions` per spec §9.1 (Mode A/options-style branches arrive in Phase 6; leave documented TODO-free seams, the union just falls through to url).
- [ ] `AppModule` wires `BymaxQueueModule.forRootAsync({ inject: [APP_ENV], useFactory: buildQueueOptions })`.
- [ ] Jest unit config (`jest.config.ts`, `maxWorkers: '50%'`) + tests covering: url connection shape, prefix propagation, defaultJobOptions override, flows/metrics enabled, shutdown values from env.
- [ ] App boots against compose Redis: `pnpm --filter api start:dev` logs a ready state.

#### Files to create / modify

`apps/api/src/config/queue.config.ts`, `apps/api/src/app.module.ts`, `apps/api/jest.config.ts`, `apps/api/src/config/queue.config.spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer wiring a dynamic module through a pure config factory.

PROJECT: nest-queue-example, Phase 2 Task 2.2 of 5 (MIDDLE). Task 2.1 delivered the
skeleton + APP_ENV. The library exposes BymaxQueueModule.forRootAsync (ConfigurableModuleBuilder,
isGlobal default true) taking BymaxQueueModuleOptions.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.1 (the canonical wiring, follow it closely)
- ../nest-queue/docs/technical_specification.md §4.1 (options interface)

TASK
1. config/queue.config.ts: pure buildQueueOptions(env) returning { connection: { url },
   prefix, defaultJobOptions { attempts: 4, backoff exponential 1500 }, flows { enabled:
   true }, metrics { enabled: true, cacheTtlMs: 3000 }, shutdown { drainTimeoutMs,
   drainOnShutdown } } from env.
2. AppModule: BymaxQueueModule.forRootAsync({ inject: [APP_ENV], useFactory:
   buildQueueOptions }).
3. jest.config.ts (ts-jest or SWC per sibling convention, maxWorkers '50%'), and
   queue.config.spec.ts covering every branch and value mapping (each it() with a
   scenario comment).
4. Delete the Phase 1 probe file if still present; real wiring replaces it.

Constraints:
- The factory reads NO process.env (takes AppEnv). 100% coverage on the new file.
- English only; no em dashes; timeless comments; TS strict; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-queue-example/api test -- --coverage` green, queue.config.ts at 100%.
- `docker compose up -d && pnpm --filter @nest-queue-example/api start:dev` boots clean.

Completion Protocol: standard 5 steps, id 2.2, commit
`feat(api): wire BymaxQueueModule via pure options factory (2.2)`.
```

---

### Task 2.3: Audit processor + smoke enqueue endpoint

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.2

#### Description

Prove the enqueue-to-process loop: an `audit` queue with a minimal `@Processor` (deliberately WITHOUT explicit concurrency: it later demonstrates the warning fallback, matrix row 38) and `POST /smoke/audit` that enqueues a typed job. Also proves `isGlobal` (row 4): the smoke module does not import the queue module.

#### Acceptance criteria

- [ ] `processors/audit.processor.ts`: `@Processor('audit')` class, `@Process()` handler appending entries to an in-memory ring buffer; no `concurrency` passed (documented why in a timeless comment: it demonstrates the library's warning fallback).
- [ ] `smoke/smoke.controller.ts` in a feature module that does NOT import `BymaxQueueModule`, injecting `QueueService` (row 4) and enqueuing `audit`/`entry` jobs typed `AuditJobData`.
- [ ] Manual journey green: `curl -X POST :3080/smoke/audit` returns the job id; the ring buffer endpoint shows the processed entry.
- [ ] Unit tests for the processor handler and controller (mocked `QueueService`).

#### Files to create / modify

`apps/api/src/processors/audit.processor.ts`, `apps/api/src/smoke/smoke.module.ts`, `apps/api/src/smoke/smoke.controller.ts`, specs

#### Agent prompt

```
You are a senior NestJS engineer proving an enqueue-to-process loop.

PROJECT: nest-queue-example, Phase 2 Task 2.3 of 5 (MIDDLE). BymaxQueueModule is wired
globally (isGlobal default). The library dispatches @Processor classes discovered at
boot; a processor without explicit concurrency logs a warning and falls back to
DEFAULT_WORKER_CONCURRENCY (this class intentionally exercises that path).

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §6.2 (@Processor), §5.4 (enqueue)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 4, 13, 38

TASK
1. processors/audit.processor.ts: @Processor('audit') with @Process() handler pushing
   { at, payload } into an injectable in-memory AuditTrail service (ring buffer, cap 100).
   Do NOT pass concurrency; explain with a timeless comment that the library warns and
   falls back by design and this class is the living proof.
2. smoke/ module (does NOT import BymaxQueueModule): POST /smoke/audit enqueues a typed
   AuditJobData job via QueueService.enqueue<AuditJobData>('audit', 'entry', ...);
   GET /smoke/audit returns the trail.
3. Unit tests: handler behavior, controller delegation (QueueService mocked).

Constraints:
- Controllers thin; services own logic; explicit constructor injection.
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot + `curl -s -X POST localhost:3080/smoke/audit -d '{"payload":"hi"}' -H
  'content-type: application/json'` returns a job id; `curl localhost:3080/smoke/audit`
  shows the processed entry within 2s.
- `pnpm --filter @nest-queue-example/api test` green.

Completion Protocol: standard 5 steps, id 2.3, commit
`feat(api): audit processor and smoke enqueue loop (2.3)`.
```

---

### Task 2.4: Health endpoints + diagnostics skeleton + CI unit gate for real

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.3

#### Description

`GET /health/live` (process up) and `GET /health/ready` (Redis reachable via a cheap `getMetrics('audit')`), plus the diagnostics endpoint skeleton exposing the library's Symbol tokens (resolved connection mode + options snapshot, matrix row 5). Remove `--passWithNoTests` from CI.

#### Acceptance criteria

- [ ] `/health/live` returns 200 `{ status: 'up' }`; `/health/ready` returns 200 when Redis answers and 503 with a reason when down.
- [ ] `GET /admin/diagnostics` injects `BYMAX_QUEUE_OPTIONS` and `BYMAX_QUEUE_CONNECTION_MODE` tokens and reports `{ mode, prefix, flowsEnabled, metricsEnabled }` (no secrets echoed).
- [ ] `ci.yml` unit job runs the real suite (`--passWithNoTests` removed).
- [ ] Unit tests for both controllers.

#### Files to create / modify

`apps/api/src/admin/health.controller.ts`, `apps/api/src/admin/diagnostics.controller.ts`, `apps/api/src/admin/admin.module.ts`, `.github/workflows/ci.yml`, specs

#### Agent prompt

```
You are a senior NestJS engineer adding health and diagnostics surfaces.

PROJECT: nest-queue-example, Phase 2 Task 2.4 of 5 (MIDDLE). QueueService and the
library Symbol tokens (BYMAX_QUEUE_OPTIONS, BYMAX_QUEUE_CONNECTION_MODE,
BYMAX_QUEUE_REDIS_CLIENT) are available globally.

REQUIRED READING (only these)
- ../nest-queue/docs/technical_specification.md §9 (metrics + health pattern)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 5, 33

TASK
1. admin/ module: health.controller.ts (GET /health/live static up; GET /health/ready
   calls queueService.getMetrics('audit') with a short timeout, 200 on success, 503
   { status: 'down', reason } on failure) and diagnostics.controller.ts (inject the
   Symbol tokens with @Inject; report mode, prefix, flags; never echo connection
   credentials).
2. Edit .github/workflows/ci.yml: the unit job now runs the real suite; remove
   --passWithNoTests and its comment.
3. Unit tests for both controllers (mock QueueService success/failure).

Constraints:
- English only; no em dashes; timeless comments; TS strict; 100% on new files.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Boot: /health/live 200; stop Redis (docker compose stop redis): /health/ready 503;
  start it again: 200.
- CI unit job green on push.

Completion Protocol: standard 5 steps, id 2.4, commit
`feat(api): health and diagnostics endpoints, real unit gate in ci (2.4)`.
```

---

### Task 2.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.4

#### Description

Standard phase close: re-verify 2.1 to 2.4, update dashboards, open the PR, Copilot review to zero findings, squash-merge with CI green, delete the branch.

#### Acceptance criteria

- [ ] All 2.1 to 2.4 verifications re-run green (boot journey included).
- [ ] Dashboards updated (this file, plan §1 P2 row, tasks README).
- [ ] PR merged squash, branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 2 of nest-queue-example.

CURRENT PHASE: 2 (api-skeleton-wiring), Task 2.5 of 5 (LAST).

PRECONDITIONS: tasks 2.1 to 2.4 done on branch feat/phase-02-api-skeleton-wiring.

REQUIRED READING (only these)
- docs/tasks/phase-02-api-skeleton-wiring.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P2 DoD, §6 Update protocol

TASK
Re-run every verification from 2.1 to 2.4 including the boot journey against compose
Redis (fix reds with normal commits). Update dashboards (phase file, plan §1 P2 row,
tasks README). Open the PR: `gh pr create --title "feat(api): phase 2, nest skeleton
and queue module wiring"` with scope + DoD evidence + matrix rows (1, 4, 5, 6, 10, 11,
13, 33, 38 partial). Request the GitHub Copilot code review
(gh pr edit --add-reviewer copilot-pull-request-reviewer[bot] or via the UI); address
EVERY finding; merge only with CI green via `gh pr merge --squash --delete-branch`;
verify branch deletion locally and remotely.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P2 ✅ 5/5.

Completion Protocol: append `- 2.5 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P2 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->
