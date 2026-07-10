# Phase 9: hardening-release-readiness

> **Status**: 🔄 In Progress · **Progress**: 3 / 5 tasks · **Last updated**: 2026-07-10
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P9)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §15, §16; the full §7 matrix

## Context

Everything works and everything is tested. This phase completes governance (the four Copilot review files tailored to the final stack), finishes the README, runs the Stryker pre-release gate on the api, audits all 70 coverage-matrix rows with evidence, and leaves the repository one command away from a clean public debut and one PR away from the npm dependency switch.

## Rules-of-phase

1. Copilot instruction files stay under 4000 characters each (the `.agent.md` is exempt) and every line must be verifiable against a real config in this repo.
2. Stryker is a pre-release gate: `break 95, high 99, low 95`; survivors are hardened or documented as provable equivalents.
3. The dependency flip (file link to `^0.1.0`) happens only when the library is actually on npm; until then it stays a ready-to-run checklist.
4. The matrix audit accepts only verifiable evidence (a route, a file, a spec name, a CI run), never narrative.

## Reference docs

- Spec §15 (gates), §16 (governance), §7 (all rows).
- Sibling Copilot files for shape (not content): any published `@bymax-one` lib repo `.github/`.

## Task index

| ID  | Task                                                      | Status  | Priority | Size | Depends on |
| --- | --------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 9.1 | Branch + the four Copilot review files                    | ✅ Done | P0       | S    | Phase 8    |
| 9.2 | README final + docs cross-check                           | ✅ Done | P0       | M    | Phase 8    |
| 9.3 | Stryker mutation gate on `apps/api`                       | ✅ Done | P0       | L    | Phase 8    |
| 9.4 | Full matrix audit + npm-switch and public-flip checklists | 📋 ToDo | P0       | M    | 9.1 to 9.3 |
| 9.5 | Phase close: audit, dashboards, PR with Copilot review    | 📋 ToDo | P0       | S    | 9.4        |

## Tasks

### Task 9.1: Branch + the four Copilot review files

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 8

#### Description

`.github/copilot-instructions.md`, `.github/instructions/code.instructions.md`, `.github/instructions/tests.instructions.md`, `.github/agents/agent-code-reviewer.agent.md`, each customized to THIS stack (pnpm workspace, NestJS 11 consumer of `@bymax-one/nest-queue`, Next.js 16 + design system, Jest 100%, e2e vs real Redis), never copied verbatim from another repo.

#### Acceptance criteria

- [x] Branch `feat/phase-09-hardening-release-readiness` created with `git switch -c`.
- [x] The three instruction files < 4000 chars each (3949 / 3506 / 2732); every rule verifiable against a real repo config (`package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `apps/api/jest.config.cjs`, `apps/web/vitest.config.ts`).
- [x] The reviewer agent file covers: coverage-matrix discipline, library-external rule (no workspace/paths), `./shared`-only in web, timeless comments, no suppressions, sequential test rule, design-system parity, and flags any AI-attribution line.
- [x] Files reference no plan phases or task ids (timeless).

#### Files to create / modify

`.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `.github/agents/agent-code-reviewer.agent.md`

#### Agent prompt

```
You are a senior engineer authoring GitHub Copilot code-review configuration.

PROJECT: nest-queue-example, Phase 9 Task 9.1 of 5 (FIRST). Copilot review files must
be stack-true: every line verifiable against a real config in THIS repo. Under 4000
chars each (agent file exempt). Timeless: no plan/phase/task references.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §15, §16
- package.json, tsconfig.base.json, eslint.config.mjs, apps/*/jest.config.ts (verify
  every rule you write against these)

TASK
Create the branch (`git switch -c feat/phase-09-hardening-release-readiness`), then
write the four files: repo-wide context (what the repo is, the external-library rule,
the shared-subpath rule, the design system), code instructions (TS strict specifics,
size limits, header conventions, banned imports), tests instructions (100% thresholds,
scenario comments, sequential suites, real-Redis e2e), and the reviewer agent checklist
(including "flag any Co-Authored-By or AI-attribution line" and "flag any plan-stage
reference in code").

Constraints:
- English only; no em dashes; each instruction file < 4000 chars (verify with wc -c).
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `wc -c .github/copilot-instructions.md .github/instructions/*.md` all < 4000.
- Spot-check three rules against their configs.

Completion Protocol: standard 5 steps (phase file, plan §1 P9 row, tasks README,
completion log), commit `docs(repo): add copilot review configuration (9.1)`.
```

---

### Task 9.2: README final + docs cross-check

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 8

#### Description

The public face: README with what/why, quick start (compose + env + two terminals), the nine journeys, the connection-mode matrix, the coverage-matrix pointer, dashboard screenshots placeholders (added when public), and a docs cross-check (spec/plan/tasks internally consistent, no stale claims).

#### Acceptance criteria

- [x] README sections: About (the library + the example contract), Quick start, Journeys (§12, each with commands), Connection matrix, Architecture sketch, Testing (how to run each suite sequentially), Docs index, License note.
- [x] Every command in the README executed once during this task (copy-paste truth): health, diagnostics, place-order, reindex, flows, and error-trigger journeys verified live against a dedicated Redis; test suites run in the phase-wide gates.
- [x] Docs cross-check: spec §7 row locations match real files (rows 14, 44, 45, 52, 56, 69 corrected); plan §1 counters match task files (53 total); README links resolve (COVERAGE_AUDIT, RELEASE_CHECKLISTS, mutation_testing_results land in this same phase PR).

#### Files to create / modify

`README.md`, small doc fixes surfaced by the cross-check

#### Agent prompt

```
You are a senior technical writer finalizing a reference repository README.

PROJECT: nest-queue-example, Phase 9 Task 9.2 of 5 (MIDDLE). The README is the public
face: professional, precise, every command copy-paste true.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §1, §11, §12 (source for About + Journeys)
- docs/DEVELOPMENT_PLAN.md §1 (counters for the cross-check)

TASK
Write the README per the acceptance criteria, executing every command as you document
it (compose up, env copy, api dev, web dev, one journey per section, test suites
sequentially). Then cross-check the three docs: every §7 matrix "where it lives" path
exists; plan counters match the task files; relative links resolve.

Constraints:
- English only; no em dashes; no internal references (vault, private repos, local
  absolute paths); the file: link workflow is documented as the pre-publish state.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- A fresh-clone dry run of the Quick start succeeds; `grep -rn '](\.\./' README.md
  docs/*.md` targets all resolve.

Completion Protocol: standard 5 steps, id 9.2, commit
`docs(repo): final readme and documentation cross-check (9.2)`.
```

---

### Task 9.3: Stryker mutation gate on `apps/api`

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: Phase 8

#### Description

The pre-release assertiveness gate: Stryker over `apps/api/src` with `break 95, high 99, low 95`; run the baseline, harden survivors in one concentrated pass, document provable equivalents, and record the final score.

#### Acceptance criteria

- [x] `stryker.config.json` scoped to `apps/api/src` (jest runner, `ignoreStatic: true` decision documented in `docs/mutation_testing_results.md`).
- [x] Baseline run recorded; survivors triaged: killed by new tests (the majority) or documented as provable equivalents with inline `// Stryker disable` reasoning.
- [x] Final score **99.71** with the `break 95` threshold active (exit 0); results summary committed to `docs/mutation_testing_results.md`.
- [x] Runtime bounded: single Stryker process, `concurrency: 2`, `NODE_OPTIONS=--max-old-space-size=4096`.

#### Files to create / modify

`apps/api/stryker.config.json` (or root-scoped), hardening tests, `docs/mutation_testing_results.md`

#### Agent prompt

```
You are a senior test engineer running a mutation-testing hardening session.

PROJECT: nest-queue-example, Phase 9 Task 9.3 of 5 (MIDDLE). Stryker with the Jest
runner over apps/api/src. Thresholds break 95, high 99, low 95. This is a one-time
pre-release gate, not a per-PR job. Memory-safe: one Stryker process, capped
concurrency, no parallel suites.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §15 (the gate row)
- apps/api/jest.config.ts

TASK
1. Configure Stryker (jest runner, mutate apps/api/src, coverageAnalysis perTest,
   concurrency bounded to half the cores).
2. Baseline run; export the survivor list.
3. Harden: for each survivor, either write the killing test (preferred) or document a
   provable equivalent in docs/mutation_testing_results.md (mutant, location, why
   equivalent).
4. Final run must clear break 95; commit the summary (score, killed, survived,
   equivalents) to docs/mutation_testing_results.md.

Constraints:
- Never weaken an assertion to kill a mutant; never exclude files to inflate the score.
- English only; no em dashes; scenario comments on new tests.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- The final Stryker run exits 0 with score >= 95; the results doc matches the run.

Completion Protocol: standard 5 steps, id 9.3, commit
`test(api): mutation hardening to the 95 gate (9.3)`.
```

---

### Task 9.4: Full matrix audit + npm-switch and public-flip checklists

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.1 to 9.3

#### Description

The completion contract: audit all 70 spec §7 rows with evidence (file, route, spec name, or CI run per row) into `docs/COVERAGE_AUDIT.md`; write the two ready-to-run checklists: the npm dependency flip (file link to `^0.1.0`, one PR, install + full pipeline) and the public-visibility flip (`gh repo edit --visibility public`, verify CodeQL/Scorecard activate, README badges).

#### Acceptance criteria

- [ ] `docs/COVERAGE_AUDIT.md`: 70 rows, each with status (✅ or gap) and evidence pointer; zero unexplained gaps (a documented gap references the limitation note that sanctions it).
- [ ] Any gap found is fixed in this task (small) or filed as an explicit follow-up in the audit with rationale.
- [ ] `docs/RELEASE_CHECKLISTS.md`: the npm-switch steps and the public-flip steps, each command-exact.

#### Files to create / modify

`docs/COVERAGE_AUDIT.md`, `docs/RELEASE_CHECKLISTS.md`, small gap fixes

#### Agent prompt

```
You are the completeness auditor of a reference implementation.

PROJECT: nest-queue-example, Phase 9 Task 9.4 of 5 (MIDDLE). The spec §7 Feature
Coverage Matrix (70 rows) is the contract: every row needs verifiable evidence.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §7 (all rows), §18 (sanctioned limitations)

TASK
1. Walk all 70 rows; for each, verify the claimed location exists and works (route
   curl, file presence, spec name in the e2e suite, CI log). Record row, status,
   evidence in docs/COVERAGE_AUDIT.md.
2. Fix small gaps inline; document any sanctioned gap against its §18 note.
3. Write docs/RELEASE_CHECKLISTS.md: NPM SWITCH (edit both package.json deps to
   ^0.1.0, pnpm install, full local pipeline, one PR titled chore(repo): consume
   published nest-queue) and PUBLIC FLIP (gh repo edit bymaxone/nest-queue-example
   --visibility public, confirm codeql/scorecard runs trigger, add badges).

Constraints:
- Evidence must be reproducible; no narrative-only entries.
- English only; no em dashes.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `grep -c '^| ' docs/COVERAGE_AUDIT.md` >= 70; zero rows marked unexplained.

Completion Protocol: standard 5 steps, id 9.4, commit
`docs(repo): coverage audit and release checklists (9.4)`.
```

---

### Task 9.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 9.4

#### Description

The final phase close: dashboards to done, the last PR with the Copilot review, and the plan marked complete. The repository is finished pending only the external events (library publish, visibility flip) covered by the checklists.

#### Acceptance criteria

- [ ] All 9.1 to 9.4 verifications re-run green.
- [ ] Dashboards: plan §1 shows 10/10 phases, 53/53 tasks; tasks README total row done.
- [ ] PR merged squash with branch deleted, CI green, Copilot findings resolved.
- [ ] Final state note in the plan header: complete, awaiting the two external checklists.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 9, the final phase of nest-queue-example.

CURRENT PHASE: 9 (hardening-release-readiness), Task 9.5 of 5 (LAST).

PRECONDITIONS: tasks 9.1 to 9.4 done on branch feat/phase-09-hardening-release-readiness.

REQUIRED READING (only these)
- docs/tasks/phase-09-hardening-release-readiness.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P9 DoD, §6 Update protocol

TASK
Re-run every verification from 9.1 to 9.4 (fix reds with normal commits). Update all
dashboards to final state (plan header: Status complete, 10/10 phases, 53/53 tasks;
note that the npm-switch and public-flip checklists in docs/RELEASE_CHECKLISTS.md are
the only remaining, externally-gated actions). Open the PR: `gh pr create --title
"docs(repo): phase 9, hardening and release readiness"` with the mutation score, the
audit summary, and the checklists pointer. Request the GitHub Copilot code review
(gh pr edit --add-reviewer copilot-pull-request-reviewer[bot] or via the UI); address
EVERY finding; merge only with CI green via `gh pr merge --squash --delete-branch`;
verify branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows 10/10 phases complete.

Completion Protocol: append `- 9.5 ✅ <date> final phase PR merged`; commit dashboards
on main: `docs(plan): mark P9 complete, roadmap done`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 9.1 ✅ 2026-07-10 four Copilot review files authored, stack-true and under the 4000-char limit
- 9.2 ✅ 2026-07-10 final README plus governance files; spec section 7 path drift fixed, docs cross-checked
- 9.3 ✅ 2026-07-10 Stryker mutation gate on apps/api at 99.71 (break 95), survivors killed or documented as equivalents
