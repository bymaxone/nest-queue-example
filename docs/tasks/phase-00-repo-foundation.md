# Phase 0: repo-foundation

> **Status**: ✅ Done · **Progress**: 5 / 5 tasks (merged in PR #1) · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P0)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §5, §6, §16

## Context

The repository contains only `docs/` on an empty `main`. This phase produces a green, governed, application-free workspace: pnpm workspace root, lint/format/commit governance, the Redis compose stack, and CI that gates this very phase's PR. Conditional workflows (CodeQL, Scorecard) ship now but stay inert while the repository is private.

## Rules-of-phase

1. No application code: `apps/` stays empty (and therefore uncommitted) until Phase 1.
2. `ci.yml` job names are contractual once branch protection references them; choose them deliberately.
3. Public-only features guard with `if: ${{ !github.event.repository.private }}` so they skip cleanly while private.
4. No `.gitkeep`; a directory exists only when a real file lands in it.
5. All configs are real and enforced from day one (a lint rule added now must pass now).

## Reference docs

- Plan §5 P0 (Goal, Scope, DoD), §4 Global conventions.
- Spec §5 Tech Stack, §6 Repository Layout, §16 CI and Repository Governance.

## Task index

| ID  | Task                                                                           | Status    | Priority | Size | Depends on |
| --- | ------------------------------------------------------------------------------ | --------- | -------- | ---- | ---------- |
| 0.1 | Branch + workspace root + base tsconfig + README skeleton                      | ✅ Done   | P0       | S    | none       |
| 0.2 | ESLint flat config + Prettier + husky + commitlint + lint-staged               | ✅ Done   | P0       | S    | 0.1        |
| 0.3 | docker-compose Redis stack + `.env.example`                                    | ✅ Done   | P0       | S    | 0.1        |
| 0.4 | CI workflows: `ci.yml` + conditional `codeql.yml`/`scorecard.yml` + dependabot | ✅ Done   | P0       | M    | 0.2        |
| 0.5 | Phase close: audit, dashboards, PR with Copilot review                         | 👀 Review | P0       | S    | 0.1 to 0.4 |

## Tasks

### Task 0.1: Branch + workspace root + base tsconfig + README skeleton

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: none

#### Description

Create the phase branch and the pnpm workspace skeleton: private root `package.json` with fan-out scripts, `pnpm-workspace.yaml` targeting `apps/*`, a strict base `tsconfig`, `.npmrc` with `engine-strict=true`, `.gitignore`, and a README skeleton that states what the repository is and links the spec.

#### Acceptance criteria

- [x] Branch `feat/phase-00-repo-foundation` created with `git switch -c`.
- [x] Root `package.json`: `"private": true`, `"engines": { "node": ">=24" }`, scripts `lint`, `typecheck`, `build`, `test` that fan out via `pnpm -r --workspace-concurrency=1`.
- [x] `pnpm-workspace.yaml` lists `apps/*`.
- [x] `tsconfig.base.json`: `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022, NodeNext.
- [x] `.npmrc` contains `engine-strict=true`; `.gitignore` covers node_modules, dist, coverage, .env.
- [x] README states purpose (reference implementation of `@bymax-one/nest-queue`) and links `docs/TECHNICAL_SPECIFICATION.md`.

#### Files to create / modify

`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.npmrc`, `.gitignore`, `README.md`

#### Agent prompt

```
You are a senior TypeScript platform engineer bootstrapping a pnpm workspace.

PROJECT: nest-queue-example, the reference implementation of @bymax-one/nest-queue
(BullMQ 5 wrapper for NestJS 11). pnpm workspace; NestJS 11 api + Next.js 16 web arrive
in later phases. Node >= 24.

CURRENT PHASE: 0 (repo-foundation), Task 0.1 of 5 (FIRST).

PRECONDITIONS
- Repo root contains only docs/ and .git on branch main.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §5 Tech Stack, §6 Repository Layout
- docs/DEVELOPMENT_PLAN.md §4 Global conventions

TASK
Create the phase branch and the workspace skeleton described in the acceptance criteria.

DELIVERABLES
1. Branch: `git switch -c feat/phase-00-repo-foundation` (NEVER `git checkout -b`).
2. `package.json` (root): private, engines node >=24, packageManager pnpm, scripts
   lint/typecheck/build/test fanning out with `pnpm -r --workspace-concurrency=1 run <script>`.
3. `pnpm-workspace.yaml`: packages: ["apps/*"].
4. `tsconfig.base.json`: strict + noImplicitAny + noUncheckedIndexedAccess +
   exactOptionalPropertyTypes, target ES2022, module NodeNext.
5. `.npmrc` (engine-strict=true), `.gitignore`, `README.md` skeleton (purpose + spec link).

Constraints:
- English only. No .gitkeep. No em dashes anywhere. Timeless comments (no phase/task refs
  in committed files). TS strict, no any, no suppression comments.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `git branch --show-current` prints feat/phase-00-repo-foundation.
- `pnpm install` exits 0 (empty workspace is fine).
- `node -p "require('./package.json').private"` prints true.

Completion Protocol:
1. Set this task's Status to ✅ in docs/tasks/phase-00-repo-foundation.md (block + index).
2. Tick all acceptance checkboxes; bump the header Progress counter.
3. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 and docs/tasks/README.md.
4. Append to Completion log: `- 0.1 ✅ <date> <summary>`.
5. Commit: `chore(repo): scaffold pnpm workspace root (0.1)`.
```

---

### Task 0.2: ESLint flat config + Prettier + husky + commitlint + lint-staged

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1

#### Description

Wire the lint/format/commit governance used across the sibling examples: ESLint flat config (typescript-eslint strict, import ordering, banned imports: `dotenv`, `moment`, `lodash`), Prettier, husky hooks (`pre-commit` lint-staged, `commit-msg` commitlint with Conventional Commits), and `.gitmessage`.

#### Acceptance criteria

- [x] `eslint.config.mjs` (flat) with typescript-eslint strict and `no-restricted-imports` banning `dotenv`, `moment`, `lodash`.
- [x] `prettier` config + `.prettierignore`; `pnpm lint` and `pnpm format:check` green.
- [x] `.husky/pre-commit` runs lint-staged; `.husky/commit-msg` runs commitlint; `commitlint.config.cjs` extends `@commitlint/config-conventional`.
- [x] `.gitmessage` documents `<type>(<scope>): <subject> (N.M)` with scopes `api, web, repo, ci, docs`.
- [x] A deliberately bad commit message is rejected locally (verified once, then amended).

#### Files to create / modify

`eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `.husky/*`, `commitlint.config.cjs`, `.gitmessage`, root `package.json` (devDeps + lint-staged block + `prepare` script)

#### Agent prompt

```
You are a senior TypeScript tooling engineer wiring repository governance.

PROJECT: nest-queue-example (pnpm workspace, empty of apps). Governance mirrors the
sibling Bymax example repos: ESLint flat + Prettier + husky + commitlint + lint-staged.

CURRENT PHASE: 0 (repo-foundation), Task 0.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 0.1 merged into the phase branch: workspace root exists.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 Global conventions
- docs/TECHNICAL_SPECIFICATION.md §16

TASK
Install and configure ESLint (flat, typescript-eslint strict, import order, banned
imports dotenv/moment/lodash), Prettier, husky (pre-commit -> lint-staged,
commit-msg -> commitlint), commitlint (conventional), lint-staged, .gitmessage.

DELIVERABLES: the files in "Files to create / modify" above, all enforced (hooks
actually installed via the package.json `prepare: husky` script).

Constraints:
- English only; no em dashes; timeless comments; no suppression comments.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm lint` exits 0. `pnpm exec commitlint --from HEAD~1` passes for your commit.
- `echo "bad message" | pnpm exec commitlint` exits non-zero.

Completion Protocol: same 5 steps as Task 0.1, with id 0.2 and commit
`chore(repo): add lint, format and commit governance (0.2)`.
```

---

### Task 0.3: docker-compose Redis stack + `.env.example`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1

#### Description

Provide the only external service the example needs: `redis:7-alpine` with a healthcheck, plus a documented `.env.example` seeded with the spec §9 variables and their defaults.

#### Acceptance criteria

- [x] `docker-compose.yml`: service `redis` (`redis:7-alpine`), port 6379, `redis-cli ping` healthcheck, named volume.
- [x] `docker compose up -d` reaches `healthy`; `docker compose exec redis redis-cli ping` prints PONG.
- [x] `.env.example` lists every spec §9 variable with default and one-line comment; README gains a "Local infra" section (`docker compose up -d`, Node `--env-file`).

#### Files to create / modify

`docker-compose.yml`, `.env.example`, `README.md` (section)

#### Agent prompt

```
You are a senior platform engineer adding local infrastructure.

PROJECT: nest-queue-example. The api (later phases) runs BullMQ against a real Redis;
docker compose provides it. dotenv is banned: apps load env via Node's --env-file.

CURRENT PHASE: 0 (repo-foundation), Task 0.3 of 5 (MIDDLE).

PRECONDITIONS: Task 0.1 done (workspace root exists).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9 Configuration and Environment
- docs/DEVELOPMENT_PLAN.md §5 P0 scope

TASK
Create docker-compose.yml (redis:7-alpine + healthcheck + volume) and .env.example
covering every §9 variable with defaults and one-line comments. Add the README
"Local infra" section.

Constraints:
- English only; no em dashes; no secrets (defaults only); timeless comments.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `docker compose up -d && docker compose ps` shows redis healthy.
- `docker compose exec redis redis-cli ping` prints PONG.
- `grep -c '^[A-Z]' .env.example` >= 10 (all §9 vars present).

Completion Protocol: same 5 steps, id 0.3, commit
`chore(repo): add redis compose stack and env example (0.3)`.
```

---

### Task 0.4: CI workflows: `ci.yml` + conditional `codeql.yml`/`scorecard.yml` + dependabot

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.2

#### Description

CI from day one: `ci.yml` runs install, lint, typecheck, build, and unit (with `--passWithNoTests` until Phase 2 removes it) on every PR and push to main. `codeql.yml` and `scorecard.yml` ship now but guard every job with `if: ${{ !github.event.repository.private }}`, so they skip while the repo is private and activate automatically on the visibility flip. Dependabot covers npm + github-actions weekly.

#### Acceptance criteria

- [x] `.github/workflows/ci.yml`: jobs `install`, `lint`, `typecheck`, `build`, `unit` (sequential needs-chain; pnpm cache; Node 24; unit uses `--passWithNoTests` with a comment pointing to its removal).
- [x] `.github/workflows/codeql.yml` and `.github/workflows/scorecard.yml` exist, SHA-pinned actions, least-privilege `permissions:`, every job guarded by `if: ${{ !github.event.repository.private }}`.
- [x] `.github/dependabot.yml`: npm (root + future apps via wildcard) and github-actions, weekly.
- [x] Workflows are lint-clean (`actionlint` if available) and reference only job names intended to be contractual.

#### Files to create / modify

`.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml`, `.github/dependabot.yml`

#### Agent prompt

```
You are a senior CI engineer creating the pipeline that gates every future PR.

PROJECT: nest-queue-example (pnpm workspace; apps arrive later). The repository is
PRIVATE today and will go public later: public-only features must ship now but skip
cleanly while private.

CURRENT PHASE: 0 (repo-foundation), Task 0.4 of 5 (MIDDLE).

PRECONDITIONS: Tasks 0.1 to 0.3 done on the phase branch.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §16 CI and Repository Governance
- docs/DEVELOPMENT_PLAN.md §5 P0

TASK
Create ci.yml (install -> lint -> typecheck -> build -> unit, sequential, pnpm cache,
Node 24, unit with --passWithNoTests for now), conditional codeql.yml and scorecard.yml
(every job: if: ${{ !github.event.repository.private }}; SHA-pinned actions;
least-privilege permissions), and dependabot.yml (npm + github-actions, weekly).

Constraints:
- Job names are contractual: install, lint, typecheck, build, unit (e2e joins in Phase 8).
- English only; no em dashes; timeless comments in YAML (no phase refs; the
  passWithNoTests comment says "removed when the first real test lands", not "Phase 2").
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `git push -u origin feat/phase-00-repo-foundation` then `gh run watch` (or open a draft
  PR): ci.yml runs green; codeql/scorecard show skipped while private.

Completion Protocol: same 5 steps, id 0.4, commit
`ci(repo): add ci pipeline and conditional public-only workflows (0.4)`.
```

---

### Task 0.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 👀 Review
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1 to 0.4

#### Description

Audit every Phase 0 acceptance criterion against the working tree, update all dashboards, open the phase PR, request the GitHub Copilot code review, address every finding, and merge with CI green.

> **Note:** the implementer's mandate for this run ends at opening the PR and requesting
> the review. Waiting for CI/review, addressing findings, and merging are handled in a
> separate follow-up pass.

#### Acceptance criteria

- [x] Every acceptance criterion of tasks 0.1 to 0.4 re-verified (commands actually run).
- [x] Dashboards updated: this file header + index, plan §1 row P0, tasks README index.
- [x] PR opened with `gh pr create` (professional English title/body, no attribution), Copilot review requested.
- [ ] All findings addressed; merged with `gh pr merge --squash --delete-branch` only after CI green; local branch pruned.

#### Files to create / modify

Dashboards only (this file, `../DEVELOPMENT_PLAN.md`, `README.md` index)

#### Agent prompt

```
You are the phase-close auditor for Phase 0 of nest-queue-example.

CURRENT PHASE: 0 (repo-foundation), Task 0.5 of 5 (LAST).

PRECONDITIONS: tasks 0.1 to 0.4 report done on branch feat/phase-00-repo-foundation.

REQUIRED READING (only these)
- docs/tasks/phase-00-repo-foundation.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P0 Definition of Done, §6 Update protocol

TASK
1. Re-run every verification command from tasks 0.1 to 0.4; fix anything red before
   proceeding (fixes are normal commits on this branch).
2. Update dashboards: this phase file (Status ✅ In the header once merged, Progress 5/5),
   plan §1 P0 row, tasks README index row.
3. `gh pr create --title "feat(repo): phase 0, repository foundation and CI" --body <<summary
   of scope, DoD evidence, checklist>>`. Request the GitHub Copilot code review on the PR
   (gh pr edit --add-reviewer copilot-pull-request-reviewer[bot] or via the UI). Address
   EVERY finding (all severities), re-request review after fixes.
4. Merge only when: CI green, review findings resolved. Use
   `gh pr merge --squash --delete-branch`. Verify `git ls-remote --heads origin
   feat/phase-00-repo-foundation` prints nothing.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state,mergedAt` shows MERGED; plan dashboard shows P0 ✅ 5/5.

Completion Protocol: append `- 0.5 ✅ <date> phase PR merged` to the Completion log and
commit the dashboard updates on main: `docs(plan): mark P0 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 0.1 ✅ 2026-07-09 pnpm workspace root, base tsconfig, npmrc, gitignore, README scaffolded
- 0.2 ✅ 2026-07-09 ESLint flat config, Prettier, husky, commitlint and lint-staged wired
- 0.3 ✅ 2026-07-09 Redis compose stack (healthcheck verified PONG) and .env.example added
- 0.4 ✅ 2026-07-09 ci.yml (install/lint/typecheck/build/unit), conditional codeql/scorecard, dependabot added
- 0.5 ✅ 2026-07-09 phase PR #1 merged green (CI passing, 5 Copilot findings fixed in 6b94177, all threads resolved)
