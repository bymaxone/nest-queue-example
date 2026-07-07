# Phase 8: testing

> **Status**: 📋 ToDo · **Progress**: 0 / 5 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P8)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §15; matrix rows 2, 3, 23, 46, 63, 64, 67 (e2e-only rows) + test column of every row

## Context

Every feature exists with per-task unit tests. This phase raises the floor to the sibling-example standard: 100% unit coverage on both apps with hard thresholds, an e2e suite covering every documented scenario against real Redis, and CI running it all sequentially with bounded workers.

## Rules-of-phase

1. Coverage reaches 100% by writing missing tests, never by excluding files; the only sanctioned ignores are framework bootstrap lines explicitly listed in the plan (none expected).
2. Suites run sequentially: unit then e2e, `maxWorkers: '50%'`, never two suites at once (locally or in CI).
3. E2E uses the real library against real Redis; app-internal collaborators may be real too (in-memory repos); nothing queue-related is mocked.
4. Every `it()` carries a scenario comment naming the rule it protects.
5. Flake budget zero: timing-sensitive specs (stall, shutdown, schedulers) use generous margins and deterministic seeds.

## Reference docs

- Spec §15 (gates), §12 (the nine scenarios, each becomes at least one e2e spec).
- Library spec §12 (bootstrap error codes covered only here: rows 2, 3, 46, 63, 64, 67).

## Task index

| ID | Task | Status | Priority | Size | Depends on |
|---|---|---|---|---|---|
| 8.1 | Branch + api unit coverage to 100% with hard thresholds | 📋 ToDo | P0 | L | Phase 7 |
| 8.2 | Web unit coverage to 100% with hard thresholds | 📋 ToDo | P0 | M | Phase 7 |
| 8.3 | E2E suite: every scenario + registration/connection/shutdown specs | 📋 ToDo | P0 | L | 8.1 |
| 8.4 | CI: e2e job with Redis service container + coverage gates | 📋 ToDo | P0 | S | 8.3 |
| 8.5 | Phase close: audit, dashboards, PR with Copilot review | 📋 ToDo | P0 | S | 8.2, 8.4 |

## Tasks

### Task 8.1: Branch + api unit coverage to 100% with hard thresholds

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: Phase 7

#### Description

Close every unit gap in `apps/api` (config factory branches, services, processors, listeners, controllers, error mapping) and flip `coverageThreshold` to `100/100/100/100` in `jest.config.ts`.

#### Acceptance criteria

- [ ] Branch `feat/phase-08-testing` created with `git switch -c`.
- [ ] `pnpm --filter api test -- --coverage` reports 100% on all four axes with the hard threshold active (build fails below).
- [ ] No file excluded from collection beyond the config-declared test helpers; `main.ts` covered via a bootstrap seam (`createApp()` extracted if needed).
- [ ] Every `it()` carries a scenario comment (spot-check enforced by review).

#### Files to create / modify

`apps/api/jest.config.ts` (thresholds), missing `*.spec.ts` files across `src/`, possible `main.ts` seam refactor

#### Agent prompt

````
You are a senior TypeScript test engineer driving a NestJS app to 100% coverage.

PROJECT: nest-queue-example, Phase 8 Task 8.1 of 5 (FIRST). All features exist with
partial per-task tests. The sibling-example standard: coverageThreshold 100/100/100/100,
no silent exclusions, main.ts covered through an extracted createApp()/bootstrap seam,
every it() with a scenario comment. maxWorkers '50%'.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 items 3, 5; §5 P8
- apps/api/jest.config.ts (current state)

TASK
Create the branch (`git switch -c feat/phase-08-testing`). Run coverage, enumerate the
gaps, and close them file by file (uncovered branches in the options factory, error
paths in services, listener shapes, controller validation rejects, the sandboxed
function edge cases). Extract a createApp() seam from main.ts if any line resists e2e
coverage attribution. Flip coverageThreshold to 100 on all axes. Do NOT add istanbul
ignore comments; do NOT exclude source files.

Constraints:
- One suite at a time; never run api and web tests concurrently.
- English only; no em dashes; timeless comments; TS strict; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-queue-example/api test -- --coverage` exits 0 at 100/100/100/100.

Completion Protocol: standard 5 steps (phase file, plan §1 P8 row, tasks README,
completion log), commit `test(api): reach 100 percent unit coverage with hard gates (8.1)`.
````

---

### Task 8.2: Web unit coverage to 100% with hard thresholds

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 7

#### Description

Same standard for `apps/web`: components (cards, badges, timeline, tree, pickers, viewers), hooks (`use-event-stream` with a mocked `EventSource`), and lib modules (api client error mapping, status mapping) to 100% with hard thresholds.

#### Acceptance criteria

- [ ] `pnpm --filter web test -- --coverage` reports 100% on all four axes with the hard threshold active.
- [ ] `use-event-stream` tested with a scripted mock EventSource (open, message, error, reconnect).
- [ ] Api client tested for happy path, envelope errors (typed `ApiError`), and network failure.

#### Files to create / modify

`apps/web/jest.config.ts` (thresholds), missing tests across `components/`, `lib/`, `app/`

#### Agent prompt

````
You are a senior React test engineer driving a Next.js dashboard to 100% coverage.

PROJECT: nest-queue-example, Phase 8 Task 8.2 of 5 (MIDDLE). React Testing Library +
Jest, maxWorkers '50%'. The EventSource hook needs a scripted mock (no real SSE in
unit). Never run this suite while the api suite runs.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 items 3, 5
- apps/web/jest.config.ts (current state)

TASK
Close every coverage gap in apps/web (components, hooks, lib, page-level logic through
component extraction where pages are thin wrappers), then flip coverageThreshold to
100/100/100/100. No istanbul ignores; no file exclusions beyond test helpers.

Constraints:
- English only; no em dashes; scenario comments on every it(); TS strict.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-queue-example/web test -- --coverage` exits 0 at 100/100/100/100.

Completion Protocol: standard 5 steps, id 8.2, commit
`test(web): reach 100 percent unit coverage with hard gates (8.2)`.
````

---

### Task 8.3: E2E suite: every scenario + registration/connection/shutdown specs

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 8.1

#### Description

The e2e suite (`apps/api/test/`, own `jest.e2e.config.ts`) against real Redis covering: the nine §12 scenarios end to end, plus the rows only e2e can prove: `forRoot`/`useClass`/`useExisting` registration (rows 2, 3), `duplicate_processor` (row 46), bootstrap connection errors `connection_invalid`/`connection_timeout`/`connection_requires_null_retries` (row 67 remainder), and shutdown `drainTimeoutMs`/`shutdown_timeout_exceeded` (rows 63, 64).

#### Acceptance criteria

- [ ] `jest.e2e.config.ts` (sequential, `maxWorkers: 1` for e2e, generous timeouts); specs: `orders.e2e-spec`, `dedup.e2e-spec`, `flows.e2e-spec`, `schedulers.e2e-spec`, `workers.e2e-spec`, `events.e2e-spec` (SSE), `errors.e2e-spec`, `registration.e2e-spec` (rows 2, 3, 46), `connection.e2e-spec` (bad url, unreachable host with short timeout, a wrapper client that defeats the null override), `shutdown.e2e-spec` (drain within budget; overrun path with a tight budget).
- [ ] Each §12 scenario maps to at least one named spec block; the mapping table lands in the spec's §7 test column via the PR.
- [ ] Suite green locally three consecutive runs (flake check) with compose Redis.

#### Files to create / modify

`apps/api/test/*`, `apps/api/jest.e2e.config.ts`, `package.json` scripts (`test:e2e`)

#### Agent prompt

````
You are a senior test engineer writing end-to-end queue behavior specs.

PROJECT: nest-queue-example, Phase 8 Task 8.3 of 5 (MIDDLE). Real Redis via docker
compose. E2E boots the real Nest app (supertest for HTTP; EventSource or raw http for
SSE). Isolated Nest apps (Test.createTestingModule with the real BymaxQueueModule) are
used for registration/connection/shutdown specs so the main app spec stays clean.
Timing-sensitive specs need generous margins (stall/shutdown) and unique queue prefixes
per spec file to avoid cross-contamination (use QUEUE_PREFIX per suite).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12 (the nine scenarios), §7 rows 2, 3, 46, 63, 64, 67
- ../nest-queue/docs/technical_specification.md §12.2 (bootstrap codes semantics)

TASK
Implement the spec files from the acceptance criteria. connection.e2e-spec provokes:
connection_invalid (malformed url), connection_timeout (unroutable host, expect the
fail-fast within the library's documented timeout), connection_requires_null_retries
(a duplicate()-defeating wrapper client in Mode A). shutdown.e2e-spec: normal drain
(slow job finishes, exit clean) and overrun (drainTimeoutMs 100 with a 5s job:
expect the documented overrun behavior). registration.e2e-spec: forRoot sync, useClass,
useExisting, and duplicate @Processor expecting queue.duplicate_processor.

Constraints:
- maxWorkers 1 for e2e; run AFTER the unit suites, never alongside.
- English only; no em dashes; scenario comments; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `docker compose up -d && pnpm --filter @nest-queue-example/api test:e2e` green three
  consecutive runs.

Completion Protocol: standard 5 steps, id 8.3, commit
`test(api): e2e suite covering every documented scenario (8.3)`.
````

---

### Task 8.4: CI: e2e job with Redis service container + coverage gates

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 8.3

#### Description

Extend `ci.yml`: the `unit` job now enforces both apps' 100% thresholds; a new `e2e` job (needs: unit) runs against a `redis:7` service container. Job order stays strictly sequential.

#### Acceptance criteria

- [ ] `ci.yml` `unit` job runs `pnpm -r --workspace-concurrency=1 test -- --coverage` (thresholds enforced by the configs).
- [ ] New `e2e` job: `needs: unit`, `services: redis: image: redis:7-alpine` with health checks, runs `pnpm --filter api test:e2e`.
- [ ] Total pipeline stays sequential (install, lint, typecheck, build, unit, e2e); job names unchanged for the existing five.
- [ ] Pipeline green on the phase branch.

#### Files to create / modify

`.github/workflows/ci.yml`

#### Agent prompt

````
You are a senior CI engineer adding an e2e stage with a service container.

PROJECT: nest-queue-example, Phase 8 Task 8.4 of 5 (MIDDLE). ci.yml has install ->
lint -> typecheck -> build -> unit. Job names are contractual; extend, do not rename.

REQUIRED READING (only these)
- .github/workflows/ci.yml (current)
- docs/TECHNICAL_SPECIFICATION.md §16

TASK
1. unit job: run the workspace coverage suites sequentially
   (pnpm -r --workspace-concurrency=1 test -- --coverage).
2. Add the e2e job: needs: unit; services.redis (redis:7-alpine, healthcheck via
   redis-cli ping options); env REDIS_URL=redis://localhost:6379/0; run the api e2e
   script. Keep NODE_OPTIONS=--max-old-space-size=4096 on test jobs.

Constraints:
- Sequential only; never parallelize the two suites.
- English only; no em dashes; timeless YAML comments.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Push: the six-job pipeline runs green end to end on the phase branch.

Completion Protocol: standard 5 steps, id 8.4, commit
`ci(repo): enforce coverage gates and add e2e stage (8.4)`.
````

---

### Task 8.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 8.2, 8.4

#### Description

Standard phase close: coverage numbers and the scenario-to-spec mapping in the PR body, dashboards, Copilot review, squash-merge on green.

#### Acceptance criteria

- [ ] Both coverage reports at 100% attached (summary text) to the PR body; e2e green in CI.
- [ ] Scenario-to-spec mapping table (nine scenarios + six e2e-only rows) in the PR body.
- [ ] Dashboards updated; PR merged squash with branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

````
You are the phase-close auditor for Phase 8 of nest-queue-example.

CURRENT PHASE: 8 (testing), Task 8.5 of 5 (LAST).

PRECONDITIONS: tasks 8.1 to 8.4 done on branch feat/phase-08-testing.

REQUIRED READING (only these)
- docs/tasks/phase-08-testing.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P8 DoD, §6 Update protocol

TASK
Re-run both coverage suites (sequentially) and the e2e suite locally; capture the
summary lines. Update dashboards (phase file, plan §1 P8 row, tasks README). Open the
PR: `gh pr create --title "test(repo): phase 8, full coverage and e2e suite"` with the
coverage summaries and the scenario-to-spec mapping table. Request the GitHub Copilot
code review (gh pr edit --add-reviewer copilot-pull-request-reviewer[bot] or via the
UI); address EVERY finding; merge only with CI green (all six jobs) via
`gh pr merge --squash --delete-branch`; verify branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P8 ✅ 5/5.

Completion Protocol: append `- 8.5 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P8 complete`.
````

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->
