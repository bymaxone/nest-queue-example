# Phase 1: library-consumption

> **Status**: 🔄 In Progress · **Progress**: 3 / 4 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P1)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §8; matrix rows 69, 70

## Context

Phase 0 delivered a governed, empty workspace. This phase makes both future apps consume `@bymax-one/nest-queue` as an **external package** through its built `dist/` and `exports` map, via a local `file:` link (the library is not yet on npm). Package skeletons only: no NestJS bootstrap, no Next.js scaffold. The deliverable is proof of resolution: a dual-subpath probe in `apps/api` and a `./shared`-only probe in `apps/web`.

## Rules-of-phase

1. The library is NEVER a workspace member and NEVER behind a `paths` alias; it must resolve exactly as an npm consumer resolves it.
2. `apps/api` declares the library's five peers (`@nestjs/common ^11`, `@nestjs/core ^11`, `bullmq ^5`, `ioredis ^5`, `reflect-metadata ^0.2`); `apps/web` declares NONE of them (the zero-dep `./shared` proof).
3. The sibling library must be built before install: `pnpm --dir ../nest-queue build`.
4. Probes are runtime-inert resolution proofs, replaced by real wiring in later phases.

## Reference docs

- Spec §8 Library Consumption, §4.1/§4.2 API inventories.
- Library repo: `../nest-queue/docs/technical_specification.md` §3.2 Subpath exports.

## Task index

| ID  | Task                                                                    | Status  | Priority | Size | Depends on |
| --- | ----------------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 1.1 | Branch + `apps/api` package + library link + peers + dual-subpath probe | ✅ Done | P0       | S    | Phase 0    |
| 1.2 | `apps/web` package + library link (no peers) + `./shared`-only probe    | ✅ Done | P0       | S    | Phase 0    |
| 1.3 | Workspace typecheck gate + single-copy peer verification                | ✅ Done | P0       | XS   | 1.1, 1.2   |
| 1.4 | Phase close: audit, dashboards, PR with Copilot review                  | 📋 ToDo | P0       | S    | 1.3        |

## Tasks

### Task 1.1: Branch + `apps/api` package + library link + peers + dual-subpath probe

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 0

#### Description

Create `apps/api` as a workspace package (no Nest code yet) that consumes the library via `file:../../../nest-queue` plus the five peers, and add `src/library-probe.ts` importing from both `.` and `./shared`.

#### Acceptance criteria

- [x] Branch `feat/phase-01-library-consumption` created with `git switch -c`.
- [x] `apps/api/package.json` declares `"@bymax-one/nest-queue": "file:../../../nest-queue"` and the five peers under `dependencies` (a note records the published end-state `^0.1.0`).
- [x] `apps/api/src/library-probe.ts` imports `BymaxQueueModule`, `QueueService` from `.` and `QUEUE_ERROR_CODES`, `JOB_STATUS`, type `QueueMetrics` from `./shared`, referencing each symbol.
- [x] `pnpm --filter api exec tsc --noEmit` exits 0 (own `tsconfig.json` extending the base).

#### Files to create / modify

`apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/library-probe.ts`

#### Agent prompt

```
You are a senior TypeScript engineer wiring an app to consume an unpublished library.

PROJECT: nest-queue-example. The library @bymax-one/nest-queue lives as a sibling
checkout at ../nest-queue (relative to this repo root), dual ESM+CJS via tsup, subpaths
`.` (server: NestJS module, services, decorators) and `./shared` (zero-dependency types
and constants). It declares @nestjs/common ^11, @nestjs/core ^11, bullmq ^5, ioredis ^5,
reflect-metadata ^0.2 as PEER dependencies and is not yet on npm.

CURRENT PHASE: 1 (library-consumption), Task 1.1 of 4 (FIRST).

PRECONDITIONS
- Phase 0 merged: workspace root, lint, CI exist. apps/ is empty.
- The sibling library builds: run `pnpm --dir ../nest-queue build` if dist/ is missing.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8 Library Consumption, §4.1, §4.2

TASK
Create the branch (`git switch -c feat/phase-01-library-consumption`), then the
apps/api package skeleton: package.json (name @nest-queue-example/api, private) with the
file: link and the five peers under dependencies, tsconfig.json extending
../../tsconfig.base.json, and src/library-probe.ts importing from BOTH subpaths and
referencing every imported symbol (runtime-inert; JSDoc explains it is a resolution
proof replaced by real wiring later).

Constraints:
- The library resolves through dist/ + exports; never a workspace member, never a paths
  alias. Do not add any other dependency.
- English only; no em dashes; timeless comments; TS strict, no any, no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `node -p "require('./apps/api/package.json').dependencies['@bymax-one/nest-queue']"`
  prints file:../../../nest-queue.
- `pnpm install` exits 0; `pnpm --filter @nest-queue-example/api exec tsc --noEmit` exits 0.

Completion Protocol:
1. Status ✅ in this file (block + index) + header progress. 2. Tick checkboxes.
3. Update plan §1 P1 row + tasks README. 4. Append completion-log line.
5. Commit: `feat(api): consume nest-queue via file link with dual-subpath probe (1.1)`.
```

---

### Task 1.2: `apps/web` package + library link (no peers) + `./shared`-only probe

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 0

#### Description

Create `apps/web` as a workspace package (no Next.js yet) consuming the library via the same `file:` link, declaring NO Nest/bullmq/ioredis peers, with a probe importing exclusively from `./shared` (matrix row 69).

#### Acceptance criteria

- [x] `apps/web/package.json` declares only the library link (plus typescript devDep); zero Nest/bullmq/ioredis entries.
- [x] `apps/web/lib/queue-shared-probe.ts` imports `JOB_STATUS`, `QUEUE_ERROR_CODES`, types `JobStatus`, `QueueMetrics` from `@bymax-one/nest-queue/shared` only; no import from the bare subpath.
- [x] `pnpm --filter web exec tsc --noEmit` exits 0 with no peers present.

#### Files to create / modify

`apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/lib/queue-shared-probe.ts`

#### Agent prompt

```
You are a senior TypeScript engineer proving a zero-dependency browser path.

PROJECT: nest-queue-example. @bymax-one/nest-queue exposes `./shared` with zero
dependencies (JOB_STATUS, QUEUE_ERROR_CODES, JobStatus/QueueMetrics/
JobSchedulerRepeatOptions types). The future dashboard must never pull NestJS, bullmq,
or ioredis into the browser bundle; this task creates that proof.

CURRENT PHASE: 1 (library-consumption), Task 1.2 of 4 (MIDDLE).

PRECONDITIONS: Task 1.1 done on branch feat/phase-01-library-consumption.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8 (item 3), §4.2

TASK
Create the apps/web package skeleton: package.json (name @nest-queue-example/web,
private) with ONLY the library file: link (plus typescript as devDependency),
tsconfig.json extending the base, and lib/queue-shared-probe.ts importing exclusively
from @bymax-one/nest-queue/shared, referencing every symbol (runtime-inert, documented).

Constraints:
- The probe MUST NOT import from '@bymax-one/nest-queue' (bare subpath); the absence of
  Nest/bullmq/ioredis in package.json IS the proof, do not add them.
- English only; no em dashes; timeless comments; TS strict; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `grep -n "from '@bymax-one/nest-queue'" apps/web/lib/queue-shared-probe.ts` prints nothing.
- `node -e "const d=require('./apps/web/package.json').dependencies||{};
  ['bullmq','ioredis','@nestjs/common','@nestjs/core','reflect-metadata']
  .forEach(p=>{if(d[p])throw new Error('web must not declare '+p)})"` exits 0.
- `pnpm install && pnpm --filter @nest-queue-example/web exec tsc --noEmit` exits 0.

Completion Protocol: standard 5 steps, id 1.2, commit
`feat(web): consume nest-queue shared subpath with zero-dep probe (1.2)`.
```

---

### Task 1.3: Workspace typecheck gate + single-copy peer verification

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: XS
- **Depends on**: 1.1, 1.2

#### Description

Close the resolution proof: workspace-wide `pnpm typecheck` green, peers resolving to a single copy, and matrix rows 69/70 recorded as covered.

#### Acceptance criteria

- [x] `pnpm typecheck` exits 0 across both packages from a clean `pnpm install`.
- [x] `pnpm why bullmq` / `pnpm why ioredis` show a single resolved copy (via `apps/api`).
- [x] Re-exported BullMQ types compile in the api probe (extend it with `type { Job }` from the server subpath: row 70).

#### Files to create / modify

`apps/api/src/library-probe.ts` (row 70 extension only)

#### Agent prompt

```
You are a senior TypeScript engineer closing a package-resolution gate.

PROJECT: nest-queue-example, Phase 1 Task 1.3 of 4 (MIDDLE). Tasks 1.1/1.2 wired both
apps to @bymax-one/nest-queue (api: `.` + `./shared` + five peers; web: `./shared` only).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §7 rows 69, 70; §8

TASK
1. Extend apps/api/src/library-probe.ts with a type-level use of a re-exported BullMQ
   type (import type { Job } from '@bymax-one/nest-queue'; declare a typed alias) for
   matrix row 70.
2. Run the full gate: clean `pnpm install`, `pnpm typecheck`, `pnpm why bullmq`,
   `pnpm why ioredis`. Fix in 1.1/1.2 scope if anything is red; do not relax tsconfig,
   do not add aliases, do not suppress.

Constraints:
- English only; no em dashes; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm typecheck` exit 0; `pnpm why bullmq` shows exactly one version, resolved under
  apps/api.

Completion Protocol: standard 5 steps, id 1.3, commit
`test(repo): close dual-subpath resolution gate (1.3)`.
```

---

### Task 1.4: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.3

#### Description

Audit Phase 1 acceptance criteria, update dashboards, open the phase PR, request the GitHub Copilot review, address all findings, merge with CI green.

#### Acceptance criteria

- [ ] All 1.1 to 1.3 verifications re-run green.
- [ ] Dashboards updated (this file, plan §1 P1 row, tasks README).
- [ ] PR merged squash with branch deleted after Copilot findings resolved and CI green.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 1 of nest-queue-example.

CURRENT PHASE: 1 (library-consumption), Task 1.4 of 4 (LAST).

PRECONDITIONS: tasks 1.1 to 1.3 done on branch feat/phase-01-library-consumption.

REQUIRED READING (only these)
- docs/tasks/phase-01-library-consumption.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P1 DoD, §6 Update protocol

TASK
Re-run every verification from tasks 1.1 to 1.3 (fix reds with normal commits). Update
dashboards (phase file header/index, plan §1 P1 row, tasks README row). Open the PR:
`gh pr create --title "feat(repo): phase 1, library consumption and subpath proofs"`
with a body summarizing scope, DoD evidence and the matrix rows covered (69, 70).
Request the GitHub Copilot code review (gh pr edit --add-reviewer
copilot-pull-request-reviewer[bot] or via the UI); address EVERY finding; merge only
with CI green via `gh pr merge --squash --delete-branch`; verify the branch is gone
remotely and locally.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P1 ✅ 4/4.

Completion Protocol: append `- 1.4 ✅ <date> phase PR merged` to the Completion log;
commit dashboards on main: `docs(plan): mark P1 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 1.1 ✅ 2026-07-09 apps/api consumes nest-queue via file link with the five peers; dual-subpath probe typechecks
- 1.2 ✅ 2026-07-09 apps/web consumes the zero-dependency shared subpath only; no server peers declared or resolved
- 1.3 ✅ 2026-07-09 workspace typecheck green; five peers resolve to a single copy (ioredis pinned to bullmq's exact version via root override); Job re-export compiles (row 70)
