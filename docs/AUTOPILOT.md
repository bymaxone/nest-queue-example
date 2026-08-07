# Autopilot Config; nest-queue-example

> Per-project parameters for /bymax-workflow:autopilot. Reviewed and
> approved by the operator before the first run. The planning docs own WHAT
> to build; this file owns HOW the chain runs.

## Identity

- **Project root**: /Users/maximiliano/Documents/MyApps/bymax-one/nest-queue-example
- **GitHub repo**: bymaxone/nest-queue-example (visibility: private)
- **Default branch**: main
- **Product summary**: Reference/dogfood application for `@bymax-one/nest-queue`
  (a NestJS 11 wrapper over BullMQ). A pnpm workspace with two apps; `apps/api`
  (NestJS backend) and `apps/web` (Next.js 16 dashboard); that together exercise
  100% of the library's public API across both subpaths (`.` and `./shared`).
  The one defining constraint: **the library is consumed as an external package**
  through its built `dist/` + `exports` via a `file:` link (later `^0.1.0`),
  never a workspace member and never a `paths` alias. Redis-only, in-memory demo
  domain (order fulfillment), no auth by design.
- **Roadmap file**: docs/DEVELOPMENT_PLAN.md
- **Tasks index**: docs/tasks/README.md
- **Phases**: 10 phases (P0–P9) / 53 tasks (phase files docs/tasks/phase-NN-*.md)

## External preconditions

| Applies to                          | Check (exit 0 = OK)                                                                                 | On failure                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| launch                              | `docker info`                                                                                       | STOP; operator starts Docker (Redis via `docker compose` is needed for `start:dev` smoke, demo scripts, and e2e)                                             |
| phases 1+                           | `test -d ../nest-queue/dist` (sibling `@bymax-one/nest-queue` checked out and built at repo-parent) | mark phase ⛔ blocked on the missing/unbuilt sibling; operator runs `pnpm --dir ../nest-queue build`, STOP                                                    |
| phase 9; dependency-flip step ONLY | `npm view @bymax-one/nest-queue version`                                                            | do NOT block the phase; the file→`^0.1.0` flip is a documented deferred checklist item; run the rest of P9 and record the flip as deferred-until-publication |

**Note:** as of this config the sibling builds (`../nest-queue/dist` present) but
the library is **not** published to npm. P9's DoD is met without the flip; the flip
ships as a follow-up PR when the library publishes.

## Model policy

| Phase | Model   | Rationale                                                                                                                                |
| ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | sonnet  | mechanical scaffold on a fully specified checklist (tooling, ESLint/Prettier, husky, compose, CI YAML)                                   |
| 1     | inherit | first contact with the consumed library; subpath resolution + peer wiring; invented APIs / wrong export shapes are the failure mode     |
| 2     | inherit | first real library runtime wiring (`forRootAsync`, `buildQueueOptions` factory, Mode B url default); config-factory correctness matters |
| 3     | inherit | broad producer API surface (typed enqueue, 4 dedup modes, bulk limits, admin inspection/control); high invented-API risk                |
| 4     | inherit | consumer API surface (worker knobs, both event decorators, progress, retries, stalls, SSE); subtle contract semantics                   |
| 5     | inherit | most complex library surface (flows, failure-propagation variants, schedulers, dynamic `WorkerRegistry`, sandboxed processor)            |
| 6     | inherit | error catalog fidelity, connection modes (A/B/shared), telemetry; precision-sensitive and touches env/connection handling               |
| 7     | sonnet  | UI pages on an established API and the verbatim shared design system; mechanical dashboard work                                         |
| 8     | sonnet  | test authoring against already-built code to 100% coverage + e2e; demanding but mechanical, no new API discovery                        |
| 9     | inherit | final hardening/audit: governance files, mutation gate, full §7 matrix audit, security/public-grade review                               |

Fix sub-agents escalate to `inherit` (strong tier) whenever a phase stalls on
review/CI findings, regardless of the phase's base model.

**Heavy phases** (silent-death watch widened to ~120 min): **P8** (full e2e suite
against real Redis + 100% coverage runs) and **P9** (Stryker mutation testing,
`break 95`).

## Gates

| Gate (local command)                                                                            | Active from                       |
| ----------------------------------------------------------------------------------------------- | --------------------------------- |
| `pnpm typecheck` (zero errors, both apps)                                                       | phase 0                           |
| `pnpm lint` (zero warnings; no `eslint-disable`, no `@ts-ignore`)                               | phase 0                           |
| `pnpm build`                                                                                    | phase 0                           |
| `pnpm --filter api test` (unit; `maxWorkers: '50%'`, thresholds on implemented files)           | phase 2                           |
| `pnpm --filter web test` (unit)                                                                 | phase 7                           |
| Bundle sanity; `./shared`-only proof: no `bullmq`/`ioredis`/`@nestjs` in the web client bundle | phase 7                           |
| `pnpm test:cov` (100% line/branch/function/statement, both apps; hard `coverageThreshold`)     | phase 8                           |
| `pnpm test:e2e` (every documented flow vs real Redis; sequential after unit; needs Docker)      | phase 8                           |
| Stryker mutation (`break 95, high 99, low 95`) on `apps/api`                                    | phase 9 (pre-release, not per-PR) |

CI job names become contractual once branch protection references them
(`ci.yml`: install, lint, typecheck, build, unit; the e2e job; `redis:7` service
container; is added when the first e2e lands and runs sequentially after unit).

**Expected-skip CI checks**: `codeql.yml` and `scorecard.yml` are committed from
P0 and stay inert while the repo is **private**, but they gate differently and so
report differently:

- `codeql.yml` calls the org's reusable analysis. Its `codeql / Repository visibility`
  job **runs and passes** on every trigger; only `codeql / Analyze (<language>)` skips
  while the repo is private. Expect one green check and one skipped, not two skipped.
- `scorecard.yml` gates on `if: ${{ !github.event.repository.private }}` and reports as
  skipped.

A skipped job counts as pass; never as a failure.

## Invariant greps

```bash
# No placeholder files (global convention).
git ls-files | grep -E '(^|/)\.gitkeep$|(^|/)\.keep$'

# No suppression comments in application code.
grep -rnE '@ts-ignore|@ts-nocheck|eslint-disable' apps/ --include='*.ts' --include='*.tsx'

# The library must be a file:/version link, never a workspace member.
grep -rn '"@bymax-one/nest-queue": *"workspace:' apps/*/package.json

# The library must never be aliased via tsconfig paths.
grep -rn '@bymax-one/nest-queue' apps/*/tsconfig*.json tsconfig*.json

# No plan-phase / task-id references in committed source or .github config
# (doc-section refs like "spec §7" are allowed and not matched here).
grep -rniE 'phase [0-9]|P[0-9]+-[0-9]+|task [0-9]' apps/ .github/ --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.yaml'

# No em dashes in application source.
grep -rn ';' apps/ --include='*.ts' --include='*.tsx'
```

Each command must print nothing.

## Security invariants & review focus

- **Redis connection is a credential surface.** The connection URL/password
  (Mode B url, Mode A shared ioredis) must never be logged raw and must be masked
  in every diagnostics endpoint, error envelope, and UI surface.
- **No secrets, no internal references; public-grade at all times.** Only
  `.env.example` is committed; typed env parsing (`config/env.ts`) is the single
  source; no secret ever reaches a log line, an error body, or the SSE stream.
- **Error envelopes must not leak internals.** The stable `QUEUE_ERROR_CODES`
  envelope surfaces the code + safe message only; no raw stack traces, no Redis
  connection strings, no internal file paths.
- **The web client bundle stays server-free.** No `bullmq`/`ioredis`/`@nestjs`
  code and no server-only config reach the browser bundle; the web app imports
  the library's `./shared` subpath only.

**Per-phase review focus** (security-sensitive phases per the model policy):

- **P2**; env/connection parsing and the `buildQueueOptions` factory: credential
  masking, no secret in boot logs.
- **P6**; connection modes and the error catalog: envelope leakage, masked
  connection options, per-role retry policy correctness.
- **P9**; final public-grade audit: secret scan, internal-reference scan, the
  full §7 matrix evidence, governance files.

## Review bot

- **Reviewer**: `copilot-pull-request-reviewer[bot]` (request with
  `gh pr edit <PR#> --add-reviewer copilot-pull-request-reviewer[bot]`).
- **Review-bot timeout**: 15 minutes; a request pending this long with no review
  submitted is treated as bot-unresponsive: the request is removed, a factual PR
  comment records it, and the gate proceeds CI-only (the implementer's
  zero-findings review floor already ran before the PR).

## Merge policy

- **Method**: squash (delete branch on merge; always)
- **Grace window**: 5 minutes since last push
- **Review-bot timeout**: 15 minutes (see Review bot above)
- **Stall limit**: 3 full fix cycles on the same phase → 🟡/⛔ + notify + STOP

## Custom conventions

- **Library is external, always.** Consumed via `file:../../../nest-queue`
  (resolving through `dist/` + `exports`) until publication, then `^0.1.0` in a
  single P9 flip PR. Never a `workspace:` dependency, never a `paths` alias.
- **Peer discipline.** `apps/api` declares the five peers (`@nestjs/common`,
  `@nestjs/core`, `bullmq`, `ioredis`, `reflect-metadata`); `apps/web` links the
  library WITHOUT those peers and consumes `./shared` types only.
- **Design system is verbatim.** The dashboard follows `docs/design_system.html`
  and the sibling example apps (shell, tokens, status mapping) exactly; do not
  invent visuals; the four design-system files are adapted copies, not redesigns.
- **Test-memory safety.** One suite at a time; `maxWorkers: '50%'` baked into
  every Jest config; `NODE_OPTIONS=--max-old-space-size=4096` as a guard; unit
  and e2e never run concurrently (sequential jobs locally and in CI).
- **No `.gitkeep`/`.keep`, no pre-created empty dirs, no em dashes** in code or
  docs; timeless English comments (no plan-phase/task-id references in committed
  source or `.github` config).
- **Sequencing note.** The plan sanctions P7 (web) starting after P5 merges while
  P6 runs (disjoint apps), but autopilot runs **strictly sequentially**; P7 is
  spawned only after P6 is merged. This is intentional; do not parallelize.
