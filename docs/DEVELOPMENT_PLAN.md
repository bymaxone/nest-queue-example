# nest-queue-example: Development Plan

> **Status:** 🔄 In execution
> **Last updated:** 2026-07-09
> **Source spec:** [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) (v1.0.0; §7 Feature Coverage Matrix is the completion contract)
> **Scope:** build the reference implementation of `@bymax-one/nest-queue` in 10 phases, one PR per phase, with the GitHub Copilot code review on every PR and CI green from the first commit.

**Status legend:** 📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

---

## 1. Progress dashboard

> **Progress:** 5 / 10 phases complete (50%) · 26 / 53 tasks
> **Active phase:** P5 flows-schedulers-dynamic
> **Blockers:** none

| ID  | Phase                       | Status         | Progress  | Size | Last updated |
| --- | --------------------------- | -------------- | --------- | ---- | ------------ |
| P0  | repo-foundation             | ✅ Done        | 5/5 tasks | M    | 2026-07-09   |
| P1  | library-consumption         | ✅ Done        | 4/4 tasks | S    | 2026-07-09   |
| P2  | api-skeleton-wiring         | ✅ Done        | 5/5 tasks | M    | 2026-07-09   |
| P3  | enqueue-surface-admin-api   | ✅ Done        | 6/6 tasks | L    | 2026-07-09   |
| P4  | workers-events              | ✅ Done        | 6/6 tasks | L    | 2026-07-09   |
| P5  | flows-schedulers-dynamic    | 🔄 In Progress | 0/6 tasks | L    | 2026-07-09   |
| P6  | metrics-errors-modes        | 📋 ToDo        | 0/5 tasks | M    | 2026-07-06   |
| P7  | web-dashboard               | 📋 ToDo        | 0/6 tasks | L    | 2026-07-06   |
| P8  | testing                     | 📋 ToDo        | 0/5 tasks | L    | 2026-07-06   |
| P9  | hardening-release-readiness | 📋 ToDo        | 0/5 tasks | M    | 2026-07-06   |

### External prerequisite (not a phase of this plan)

The library `@bymax-one/nest-queue` is a sibling project with its own roadmap. This example consumes it through a **local file link** (`file:../../../nest-queue`, resolving through the built `dist/`) until the library publishes to npm, at which point P9 flips the dependency to `^0.1.0`. The only hard requirement to start P1 is that the sibling checkout exists and builds (`pnpm --dir ../nest-queue build`).

---

## 2. Dependency graph

```
P0 ──► P1 ──► P2 ──► P3 ──► P4 ──► P5 ──► P6 ──┬──► P8 ──► P9
                                    │           │
                                    └──► P7 ────┘
```

Reading: the backend feature phases (P3 to P6) are strictly sequential, each building on queues and processors from the previous one. The dashboard (P7) needs the API surface stable through P6 (it can start once P5 is merged, consuming P6 endpoints as they land, but its phase-close audit requires P6 merged). Testing (P8) needs both apps complete. Hardening (P9) is last.

## 3. Parallelization notes

- **One phase in flight at a time** is the default. The only sanctioned overlap: P7 (web) may start after P5 merges while P6 runs, because the two phases touch disjoint apps; its close waits for P6.
- **Test suites never run in parallel**: one suite at a time, `maxWorkers: '50%'` baked into every Jest config, `NODE_OPTIONS=--max-old-space-size=4096` as a guard. Unit and e2e never run concurrently, locally or in CI (sequential jobs).
- E2E requires a running Redis (`docker compose up -d` locally; a `redis:7` service container in CI).

## 4. Global conventions (all phases)

1. **English** everywhere: code, comments, JSDoc, identifiers, commits (Conventional Commits, scope examples: `api`, `web`, `repo`, `ci`, `docs`).
2. **TypeScript strict** with `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; zero `any`; zero suppression comments (`@ts-ignore`, `eslint-disable`).
3. **Clean Code:** functions <= 50 lines, files <= 800 (200 to 400 typical), `@fileoverview` + `@layer` header per file, imperative JSDoc on every export.
4. **Timeless comments:** never reference plan phases or task ids in committed source or `.github` config; doc-section references (`spec §7`) are fine.
5. **Coverage 100%** (line/branch/function/statement) on both apps once the testing phase lands; every `it()` carries a scenario comment.
6. **The library resolves as an external package** through `dist/` + `exports`; never a workspace member, never a `paths` alias (spec §8).
7. **One PR per phase** on `feat/phase-NN-<slug>` (created with `git switch -c`, never `git checkout -b`); `gh pr create`; request the GitHub Copilot code review; address every finding; squash-merge only with CI green; delete the branch.
8. **No AI attribution** in commits, PR titles, PR bodies, or comments, ever.
9. **No `.gitkeep`**, no pre-created empty directories, no em dashes in code or docs.
10. **Coverage matrix discipline:** every task names the spec §7 rows it implements; a row is only "covered" when code + UI (where applicable) + a test exist.

---

## 5. Phase detail

### P0: repo-foundation (M)

- **Goal:** a green, governed, empty workspace: tooling, Redis infra, and CI gating the very first PR.
- **Scope (in):** pnpm workspace root (`private: true`, engines Node >= 24), base `tsconfig`, ESLint flat config + Prettier, husky + commitlint + lint-staged + `.gitmessage`, `docker-compose.yml` (redis:7-alpine + healthcheck), `.npmrc` (engine-strict), README skeleton, `.github/`: `ci.yml` (install, lint, typecheck, build, unit placeholder), `codeql.yml` + `scorecard.yml` **conditional on the repo being public** (`if: ${{ !github.event.repository.private }}`), dependabot.
- **Scope (out):** any application code; the Copilot review files (P9 tailors them to the final stack).
- **Definition of Done:**
  - `pnpm install && pnpm lint && pnpm typecheck` green on a clean clone.
  - `docker compose up -d` yields a healthy Redis.
  - The phase PR itself runs `ci.yml` and merges green; conditional workflows show as skipped, not failed.
- **References:** spec §5, §6, §16. Tasks: `docs/tasks/phase-00-repo-foundation.md`.

### P1: library-consumption (S)

- **Goal:** both apps' packages consume `@bymax-one/nest-queue` through the published surface, with subpath probes proving resolution.
- **Scope (in):** `apps/api` and `apps/web` package skeletons (no runtime code yet), library file link + the five peers in `apps/api` (`@nestjs/common`, `@nestjs/core`, `bullmq`, `ioredis`, `reflect-metadata`), link WITHOUT peers in `apps/web`, dual-subpath probe (api) and `./shared`-only probe (web), workspace `pnpm typecheck` gate.
- **Scope (out):** NestJS bootstrap, Next.js scaffold (P2 and P7).
- **Definition of Done:**
  - `pnpm typecheck` exits 0 across the workspace; api probe resolves `.` + `./shared`; web probe resolves `./shared` with zero Nest/bullmq/ioredis deps declared.
  - Peers resolve to a single copy (`pnpm why`).
- **References:** spec §8; matrix rows 69, 70. Tasks: `docs/tasks/phase-01-library-consumption.md`.

### P2: api-skeleton-wiring (M)

- **Goal:** a booting NestJS app with the library wired via `forRootAsync`, one smoke queue, and health endpoints.
- **Scope (in):** `apps/api` NestJS 11 skeleton (`main.ts`, `AppModule`), typed env parsing (`config/env.ts`), `buildQueueOptions` factory (spec §9.1) with Mode B url default, first processor (`audit` queue) + smoke enqueue endpoint, `GET /health/live` + `GET /health/ready`, diagnostics endpoint skeleton (tokens probe), Jest unit config (`maxWorkers: '50%'`, thresholds enforced on implemented files).
- **Definition of Done:**
  - `pnpm --filter api start:dev` boots against compose Redis; smoke job enqueues and completes.
  - Config factory unit-tested on every branch it has so far; CI runs unit tests for real (placeholder removed).
- **References:** spec §9, §10; matrix rows 1, 4, 5, 6, 10, 11. Tasks: `docs/tasks/phase-02-api-skeleton-wiring.md`.

### P3: enqueue-surface-admin-api (L)

- **Goal:** every producer-side feature of the library exposed through the Orderly demo domain and the admin API.
- **Scope (in):** orders module (in-memory repo), typed `enqueue` (priority, delay, `jobId` idempotency), all four deduplication modes + dedup inspector, `enqueueBulk` + oversized-bulk error, inspection/control admin API (`getJob`, `getJobs` with status pagination, `pauseQueue`, `resumeQueue`, `cleanQueue`, `getMetrics` direct), `queue.job_not_found` / `queue.queue_not_found` surfacing.
- **Definition of Done:** matrix rows 12 to 27 and 31, 32 covered by working endpoints with unit tests; e2e-style manual journey documented.
- **References:** spec §7.2, §7.3, §11. Tasks: `docs/tasks/phase-03-enqueue-surface-admin-api.md`.

### P4: workers-events (L)

- **Goal:** the consumer side: processors with every worker knob, both event decorators, progress, retries, stalls, and the SSE feed.
- **Scope (in):** email processor (named vs fallback dispatch, at-least-once idempotency marker), webhook processor (concurrency 5, limiter 2/s, failure injection + exponential backoff), report processor (progress number + object, tuned `lockDuration`), audit processor left without explicit concurrency (warning + fallback proof), `@OnWorkerEvent` + `@OnQueueEvent` listeners bridged to `GET /events/stream` (SSE), stalled-recovery demo, graceful-shutdown demo script.
- **Definition of Done:** matrix rows 34 to 46 covered; the retry theater and stalled demos reproducible via documented commands.
- **References:** spec §7.4, §12 scenarios 2, 8. Tasks: `docs/tasks/phase-04-workers-events.md`.

### P5: flows-schedulers-dynamic (L)

- **Goal:** hierarchical jobs, recurring jobs, and runtime worker management.
- **Scope (in):** fulfillment flow (fan-out/fan-in + nested children), the three failure-propagation variants (`waiting-children` pitfall, `failParentOnFailure`, `ignoreDependencyOnFailure`), `addBulk`, flow tree read endpoint (via `getProducer`), boot-time scheduler registration (cron 5-field + tz, 6-field seconds, `every` + `offset` + `limit`), scheduler management endpoints (`getJobSchedulers`, `removeJobScheduler`), scheduler validation error paths, `WorkerRegistry` dynamic per-tenant workers (register/unregister/list) and the sandboxed invoice processor (`registerSandboxed`, built artifact wiring).
- **Definition of Done:** matrix rows 47 to 62 covered; the three flow variants visibly contrast; re-boot proves scheduler idempotency.
- **References:** spec §7.4 rows 47 to 49, §7.5, §12 scenarios 4 to 7. Tasks: `docs/tasks/phase-05-flows-schedulers-dynamic.md`.

### P6: metrics-errors-modes (M)

- **Goal:** the operational envelope: cached metrics, the full error catalog, connection modes, telemetry.
- **Scope (in):** `MetricsService` wiring (TTL cache, `getAll`, `invalidate`) + readiness composition, error explorer covering every reproducible `QUEUE_ERROR_CODES` member with the stable envelope, Mode A via app-owned ioredis provider behind `QUEUE_CONNECTION_MODE=shared`, per-role retry-policy diagnostics, `connection.options` style branch, optional `bullmq-otel` telemetry behind `QUEUE_OTEL` with an in-memory span assertion.
- **Definition of Done:** matrix rows 7, 8, 9, 28 to 30, 33, 66, 67, 68 covered; diagnostics endpoint proves the retry policy split.
- **References:** spec §7.1, §7.3, §7.6, §9.1. Tasks: `docs/tasks/phase-06-metrics-errors-modes.md`.

### P7: web-dashboard (L)

- **Goal:** the Next.js 16 dashboard: every feature visible, in the shared design system.
- **Scope (in):** Next.js skeleton + the four design-system files + adapted shell (wordmark `nest-queue-example`, Redis status chip), typed api client (`./shared` types only), all pages of spec §13.2 (overview, queue detail, job detail, flows, schedulers, workers, playground, events, errors, health), the signature components (§13.3), SSE consumption.
- **Definition of Done:** every §13.2 page functional against the running api; the client bundle contains no `bullmq`/`ioredis`/`@nestjs` code; design parity with siblings (shell, tokens, status mapping).
- **References:** spec §13, §14; matrix rows across the board (UI column). Tasks: `docs/tasks/phase-07-web-dashboard.md`.

### P8: testing (L)

- **Goal:** the safety net: 100% unit coverage on both apps and e2e over every documented flow.
- **Scope (in):** api unit suite to 100% (config factory branches, services, listeners, error mapping), web unit suite to 100% (components, lib), e2e suite against real Redis covering every §12 scenario plus registration/shutdown/connection specs, CI e2e job (service container) added sequentially after unit, coverage gates flipped to hard thresholds in every config.
- **Definition of Done:** `pnpm test:cov` 100% both apps; `pnpm test:e2e` green locally and in CI; suites sequential; every matrix row now has its test reference filled.
- **References:** spec §15; matrix rows 2, 3, 23, 46, 63, 64, 67 (e2e-only rows). Tasks: `docs/tasks/phase-08-testing.md`.

### P9: hardening-release-readiness (M)

- **Goal:** governance completion and the npm/public switch readiness.
- **Scope (in):** the four Copilot review files tailored to this stack, README final (journeys, quick start, coverage matrix pointer), Stryker mutation pre-release gate (`break 95`) on `apps/api`, the dependency-flip checklist (file link to `^0.1.0` in one PR when the library publishes), the visibility-flip checklist (verify codeql/scorecard activate), final matrix audit (all 70 rows verified with evidence).
- **Definition of Done:** mutation score >= 95 documented; matrix audit table committed; repo is one `gh repo edit --visibility public` away from a clean public debut.
- **References:** spec §15, §16; the full §7 matrix. Tasks: `docs/tasks/phase-09-hardening-release-readiness.md`.

---

## 6. Update protocol

1. On any phase status change, update the §1 dashboard row (status, progress, last updated) and the header counters (phases, tasks, active phase, blockers).
2. On task completion, follow the Completion Protocol embedded in the task file (task block, task index, phase header progress, this dashboard, completion log).
3. This file is the **canonical dashboard**; `docs/tasks/README.md` only mirrors it. Update this file first.
4. Phase rows move to ✅ only when the phase PR is **merged** with CI green and every acceptance criterion audited; use 🟡 Partial when merged with a documented gap.
5. Commit dashboards updates as `docs(plan): update P<N> status to <status>`.
6. Changing the phase decomposition requires updating §1, §2, §3, and §5 in the same edit.
