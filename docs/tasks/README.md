# Development Tasks: nest-queue-example

> **Last updated:** 2026-07-10
> **Source roadmap:** [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) · **Spec:** [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md)

Tasks live **one file per phase** in this folder (`phase-NN-<slug>.md`). Each file is self-contained: context, rules-of-phase, reference docs, task index, tasks (each with an executable **Agent prompt** in a 4-backtick fence), and a completion log.

> **The canonical phase status lives in the [plan's Progress dashboard](../DEVELOPMENT_PLAN.md#1-progress-dashboard).** This index only mirrors it: when a phase or task changes state, update the plan dashboard first, then this table.

## Phase files (folder index)

| Phase | File                                                                                   | Tasks       | Status  |
| ----- | -------------------------------------------------------------------------------------- | ----------- | ------- |
| P0    | [`phase-00-repo-foundation.md`](./phase-00-repo-foundation.md)                         | 5 / 5       | ✅ Done |
| P1    | [`phase-01-library-consumption.md`](./phase-01-library-consumption.md)                 | 4 / 4       | ✅ Done |
| P2    | [`phase-02-api-skeleton-wiring.md`](./phase-02-api-skeleton-wiring.md)                 | 5 / 5       | ✅ Done |
| P3    | [`phase-03-enqueue-surface-admin-api.md`](./phase-03-enqueue-surface-admin-api.md)     | 6 / 6       | ✅ Done |
| P4    | [`phase-04-workers-events.md`](./phase-04-workers-events.md)                           | 6 / 6       | ✅ Done |
| P5    | [`phase-05-flows-schedulers-dynamic.md`](./phase-05-flows-schedulers-dynamic.md)       | 6 / 6       | ✅ Done |
| P6    | [`phase-06-metrics-errors-modes.md`](./phase-06-metrics-errors-modes.md)               | 5 / 5       | ✅ Done |
| P7    | [`phase-07-web-dashboard.md`](./phase-07-web-dashboard.md)                             | 6 / 6       | ✅ Done |
| P8    | [`phase-08-testing.md`](./phase-08-testing.md)                                         | 5 / 5       | ✅ Done |
| P9    | [`phase-09-hardening-release-readiness.md`](./phase-09-hardening-release-readiness.md) | 5 / 5       | ✅ Done |
|       | **Total**                                                                              | **53 / 53** | ✅ Done |

## Status legend

📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

Sizes: **XS/S** (< ~100 LoC), **M** (~100 to 250), **L** (~250+). Priorities: **P0** (blocking), **P1** (important), **P2** (nice-to-have).

---

## Agent execution guide

> **Read before executing any task.**

### Token economy

1. **Do not load a whole phase file**: jump to your task block (`Read` with `offset`/`limit`).
2. **Do not load the whole plan or spec**: every task lists REQUIRED READING with exact sections; read only those.
3. **Do not load the library source**: consult the library's `docs/technical_specification.md` sections the task names, or its built `dist/*.d.ts` for signatures.

### Branch and PR flow (mandatory, one PR per phase)

1. The FIRST task of each phase creates the branch: `git switch -c feat/phase-NN-<slug>` (never `git checkout -b`).
2. Every task commits on that branch with Conventional Commits: `<type>(<scope>): <subject> (N.M)`.
3. The LAST task of each phase (phase close) audits the acceptance criteria, updates the dashboards, opens the PR with `gh pr create`, requests the **GitHub Copilot code review**, addresses every finding, and merges only with CI green (`gh pr merge --squash --delete-branch`).
4. **Never** add `Co-Authored-By`, "Generated with", or any AI-attribution line to commits, PR titles, PR bodies, or comments.

### Execution mode

Resolve tasks in dependency order (`Depends on` column), sequentially. After each task, apply the self-update protocol below. A phase closes when all its tasks are done, the plan's Definition of Done holds, and the phase PR is merged.

### Self-update protocol (after every task)

1. Task block `Status` + acceptance-criteria checkboxes.
2. Task index row + the phase header `Progress` counter (`X / Y`).
3. Phase completion log (append `- <id> ✅ <YYYY-MM-DD> <one-line summary>`).
4. The phase row in the [plan dashboard](../DEVELOPMENT_PLAN.md#1-progress-dashboard) (canonical) and this index; recompute overall progress.
5. Conventional commit, no attribution trailers.

### Blocked / review

- Blocked: `Status: ⛔` + `> **Blocker:** ...` under the task header; no destructive commits.
- Acceptance failing after 2 red-green cycles: `Status: 👀` + inline note.

---

## Project-wide constraints (every task)

- **Coverage matrix discipline**: each task names its spec §7 rows; a row counts as covered only with code + UI (where applicable) + a test.
- **The library is external**: resolved through `dist/` + `exports` via the `file:` link (later `^0.1.0`); never a workspace member or `paths` alias.
- **TS strict, no `any`, no suppressions; functions <= 50 lines; files <= 800; `@fileoverview` + `@layer` per file; timeless English comments** (no phase/task references in committed code or `.github` config).
- **Tests**: Jest with `maxWorkers: '50%'`; suites sequential; unit and e2e never concurrent; e2e against real Redis only.
- **Design system**: the dashboard follows [`../design_system.html`](../design_system.html) verbatim (tokens, shell, status mapping); do not invent visuals.
- **No `.gitkeep`; no em dashes** in code or docs.
