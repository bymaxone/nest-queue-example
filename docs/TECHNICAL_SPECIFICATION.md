# nest-queue-example: Technical Specification

> **Version:** 1.0.0
> **Last updated:** 2026-07-06
> **Status:** Draft for implementation
> **Type:** Reference implementation (dogfood app) for [`@bymax-one/nest-queue`](https://github.com/bymaxone/nest-queue)
> **Visibility:** private today, planned public. Everything in this repo is written public-grade from day one; CI features that only run on public repositories (CodeQL, OpenSSF Scorecard) ship conditionally and activate automatically when the repository goes public.

---

## Table of Contents

1. [Purpose and Audience](#1-purpose-and-audience)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Architecture at a Glance](#3-architecture-at-a-glance)
4. [The Library Under Test: `@bymax-one/nest-queue`](#4-the-library-under-test-bymax-onenest-queue)
5. [Tech Stack](#5-tech-stack)
6. [Repository Layout](#6-repository-layout)
7. [Feature Coverage Matrix](#7-feature-coverage-matrix)
8. [Library Consumption](#8-library-consumption)
9. [Configuration and Environment](#9-configuration-and-environment)
10. [Backend Design: `apps/api`](#10-backend-design-apps-api)
11. [Demo Domain and REST API](#11-demo-domain-and-rest-api)
12. [Demonstration Scenarios](#12-demonstration-scenarios)
13. [Frontend Design: `apps/web`](#13-frontend-design-apps-web)
14. [Design System](#14-design-system)
15. [Quality Gates](#15-quality-gates)
16. [CI and Repository Governance](#16-ci-and-repository-governance)
17. [What is NOT in Scope](#17-what-is-not-in-scope)
18. [Known Limitations](#18-known-limitations)

---

## 1. Purpose and Audience

`nest-queue-example` is the canonical reference implementation of **`@bymax-one/nest-queue`**, the BullMQ 5 wrapper for NestJS 11. It exists for three audiences:

1. **Library consumers.** Every public feature of the library appears here in realistic, copy-ready form: module registration, both connection modes, every `QueueService` helper, every decorator, flows, job schedulers, dynamic and sandboxed workers, metrics, graceful shutdown, and every error path. If you want to know "how do I use X", the answer is a file in this repo.
2. **Library maintainers.** The example is the dogfood harness: it consumes the library exactly the way a real application does (through the built `dist/` and the `exports` map, never through `src/`), so a broken subpath, a bad `.d.ts`, or a regressed default is caught here before a release ships.
3. **Agent-driven development.** The docs in this folder (spec, plan, task files) are written so autonomous coding agents can build the entire application phase by phase with no additional context.

The guiding rule: **if the library documents a behavior, this example demonstrates it; if the example cannot demonstrate it, the library docs are wrong.** The Feature Coverage Matrix (§7) is the contract that enforces this rule.

## 2. Goals and Non-Goals

### Goals

- Exercise **100% of the public API** of `@bymax-one/nest-queue` across both subpaths (`.` and `./shared`), including every option, every decorator, every service method, and every documented error code.
- Demonstrate the **hard operational lessons** the library encodes: per-role Redis retry policy, at-least-once delivery and idempotent handlers, explicit worker concurrency, graceful shutdown, bounded bulk enqueues, and scheduler idempotency.
- Provide a **realistic demo domain** (an order fulfillment pipeline) so every feature appears in a believable context instead of a synthetic playground.
- Ship a **Next.js 16 dashboard** that visualizes queues, jobs, flows, schedulers, workers, and live events, following the shared Bymax design system so all example apps look like one product.
- Keep the repository **public-grade at all times**: professional docs, no secrets, no internal references, CI green from the first PR.

### Non-Goals

- **Not a queue admin product.** The dashboard is a demonstration surface, not a production BullMQ operations tool (use Taskforce or Bull Board for that).
- **Not a benchmark.** No performance claims; throughput knobs (concurrency, limiter) are demonstrated for correctness, not tuned for records.
- **Not a template.** Backends are derived from the ecosystem backend template, not from this example. This repo optimizes for feature coverage density, not for being a starting point.
- **Not a re-test of BullMQ.** BullMQ's own behavior is trusted; the example tests the library's orchestration of it and the documented contracts.

## 3. Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│ pnpm workspace: nest-queue-example                                   │
│                                                                      │
│  ┌──────────────────────────────┐   ┌──────────────────────────────┐ │
│  │ apps/api (NestJS 11)         │   │ apps/web (Next.js 16)        │ │
│  │                              │   │                              │ │
│  │  @bymax-one/nest-queue  `.`  │   │  @bymax-one/nest-queue       │ │
│  │  BymaxQueueModule            │   │       `./shared` ONLY        │ │
│  │  QueueService / FlowService  │   │  (JOB_STATUS, error codes,   │ │
│  │  MetricsService / Registry   │   │   QueueMetrics types)        │ │
│  │  @Processor / @Process       │   │                              │ │
│  │  @OnWorkerEvent /@OnQueueEvent   │  Dashboard: queues, jobs,    │ │
│  │  SSE event feed              │◄──┤  flows, schedulers, workers, │ │
│  │  REST admin + demo domain    │   │  live events, error explorer │ │
│  └──────────────┬───────────────┘   └──────────────────────────────┘ │
│                 │ ioredis (Mode B by default, Mode A via flag)       │
│                 ▼                                                    │
│           redis:7 (docker compose)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

Key decisions:

1. **Two apps, one workspace.** `apps/api` consumes the server subpath; `apps/web` consumes only the zero-dependency `./shared` subpath, proving the library's layering (no NestJS, no ioredis, no bullmq in the browser path).
2. **The library is external, never a workspace member.** It resolves through its built `dist/` and `package.json#exports`, exactly as a real npm consumer resolves it (§8).
3. **Redis is real.** All runtime behavior (retries, stalls, events, schedulers) runs against a real `redis:7` container; nothing queue-related is mocked outside unit tests.
4. **Events reach the browser via SSE.** Worker-local and global queue events are bridged to a Server-Sent Events endpoint the dashboard consumes; no additional realtime library is introduced.

## 4. The Library Under Test: `@bymax-one/nest-queue`

Summary of the surface this example must cover. The authoritative definition is the library's own `docs/technical_specification.md`; row references in §7 point at its sections.

### 4.1 Public API inventory (server subpath `.`)

| Export                                                                           | Kind                               | Notes                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BymaxQueueModule`                                                               | Dynamic module                     | `forRoot()` / `forRootAsync()` (useFactory, useClass, useExisting), `isGlobal` (default true)                                                                                              |
| `BYMAX_QUEUE_OPTIONS`, `BYMAX_QUEUE_REDIS_CLIENT`, `BYMAX_QUEUE_CONNECTION_MODE` | Symbol tokens                      | Injectable for probes and diagnostics                                                                                                                                                      |
| `QueueService`                                                                   | Service                            | `getOrCreateQueue`, `enqueue`, `enqueueBulk`, `upsertJobScheduler`, `removeJobScheduler`, `getJobSchedulers`, `getJob`, `getJobs`, `getMetrics`, `pauseQueue`, `resumeQueue`, `cleanQueue` |
| `FlowService`                                                                    | Service (opt-in `flows.enabled`)   | `add`, `addBulk`, `getProducer`                                                                                                                                                            |
| `MetricsService`                                                                 | Service (opt-in `metrics.enabled`) | `get`, `getAll`, `invalidate`, TTL cache (`cacheTtlMs`, default 5000)                                                                                                                      |
| `WorkerRegistry`                                                                 | Service (advanced)                 | `register`, `registerSandboxed`, `unregister`, `list`                                                                                                                                      |
| `Processor`, `Process`                                                           | Decorators                         | Queue processor class + job handler methods (named filter with fallback dispatch)                                                                                                          |
| `OnWorkerEvent`, `OnQueueEvent`                                                  | Decorators                         | Worker-local (full `Job`) vs global (`QueueEvents`, serialized payloads, lazy dedicated connection)                                                                                        |
| `QueueException`, `QUEUE_ERROR_CODES`, `QUEUE_ERROR_MESSAGES`                    | Errors                             | Stable error envelope `{ error: { code, message, details } }`                                                                                                                              |
| `DEFAULT_JOB_OPTIONS`, `DEFAULT_WORKER_CONCURRENCY`                              | Constants                          | attempts 3, exponential backoff 2000ms, retention 24h/1000 completed and 7d/5000 failed; concurrency 2                                                                                     |
| Re-exported BullMQ types                                                         | Types                              | `Job`, `JobsOptions`, `Queue`, `Worker`, `FlowProducer`, `FlowJob`, `JobNode`, `JobSchedulerJson`, `Telemetry`, `SandboxedJob`                                                             |

### 4.2 Public API inventory (shared subpath `./shared`)

| Export                                                   | Kind     | Notes                                                    |
| -------------------------------------------------------- | -------- | -------------------------------------------------------- |
| `JOB_STATUS`                                             | Constant | Job status union values                                  |
| `QUEUE_ERROR_CODES`                                      | Constant | Single source of truth, re-exported by the server barrel |
| `JobStatus`, `QueueMetrics`, `JobSchedulerRepeatOptions` | Types    | Zero-dependency; safe for the browser bundle             |

### 4.3 Behavioral contracts the example must surface

- **Connection modes.** Mode A (`{ client }`, bring your own ioredis) and Mode B (`{ url }` or `{ options }`, the lib opens its own). Per-role retry policy: Queue/FlowProducer connections keep default retries (fail fast); Worker/QueueEvents connections are duplicated with `maxRetriesPerRequest: null`.
- **Delivery semantics.** At-least-once, never exactly-once: handlers must be idempotent; `jobId` and `deduplication` collapse duplicate producers only.
- **Deduplication modes.** Simple (`{ id }`), throttle (`{ id, ttl }`), debounce (`{ id, ttl, extend, replace }` with `delay`), keep-last-if-active (`{ id, keepLastIfActive }`).
- **Job Schedulers, not repeatable jobs.** Only `upsertJobScheduler` / `removeJobScheduler` / `getJobSchedulers`; idempotent by `schedulerId`; cron 5-field and 6-field, `tz`, `every` + `offset`, `limit`, `startDate` / `endDate`; boot-time registration pattern.
- **Workers.** Missing `concurrency` logs a warning and falls back to `DEFAULT_WORKER_CONCURRENCY`; `limiter`, `lockDuration`, `stalledInterval`, `autorun` are all real knobs; one `@Processor` per queue (`queue.duplicate_processor` otherwise).
- **Sandboxed processors.** File-based, out-of-process, no NestJS DI, registered via `WorkerRegistry.registerSandboxed` with optional `useWorkerThreads`.
- **Flows.** A failed child does NOT fail the parent by default (`waiting-children` forever); `failParentOnFailure` and `ignoreDependencyOnFailure` are the explicit levers.
- **Shutdown.** Bounded drain (`drainTimeoutMs`, default 30s), `queue.shutdown_timeout_exceeded` on overrun, `drainOnShutdown` is dev/test only.
- **Error catalog.** Twelve `queue.*` codes with fixed HTTP status mapping (§7 rows 50 to 61).

## 5. Tech Stack

| Layer           | Choice                                        | Version pin                        | Why                                                                                 |
| --------------- | --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Backend         | NestJS                                        | ^11                                | The library's target framework                                                      |
| Queue engine    | BullMQ (via the library)                      | ^5.16                              | Brought in by the library as a peer of the app                                      |
| Redis client    | ioredis                                       | ^5                                 | Library peer dependency                                                             |
| Frontend        | Next.js (App Router)                          | 16.x                               | Sibling-example standard                                                            |
| UI              | React 19, Tailwind v4, shadcn (new-york)      | per design system                  | §14                                                                                 |
| Data fetching   | TanStack Query + native `EventSource` for SSE | latest stable                      | Poll + live feed                                                                    |
| Language        | TypeScript strict                             | ^5.9                               | `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any` |
| Package manager | pnpm workspaces                               | ^10                                | Sibling-example standard                                                            |
| Tests           | Jest (api unit + e2e), Vitest is NOT used     | per repo configs                   | `maxWorkers: '50%'` baked in                                                        |
| Infra           | docker compose: `redis:7-alpine`              |                                    | The only external service                                                           |
| Node            | >= 24                                         | `engines` + `.npmrc engine-strict` | Ecosystem floor                                                                     |

## 6. Repository Layout

```
nest-queue-example/
├── package.json                  # private workspace root, scripts fan out
├── pnpm-workspace.yaml
├── docker-compose.yml            # redis:7-alpine (+ redis-cli healthcheck)
├── .npmrc                        # engine-strict=true
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # lint, typecheck, build, unit, e2e (Redis service container)
│   │   ├── codeql.yml            # conditional: skips while repository is private
│   │   └── scorecard.yml         # conditional: skips while repository is private
│   ├── copilot-instructions.md
│   ├── instructions/             # code + tests instruction files
│   ├── agents/agent-code-reviewer.agent.md
│   └── dependabot.yml
├── docs/
│   ├── TECHNICAL_SPECIFICATION.md   # this file
│   ├── DEVELOPMENT_PLAN.md          # phased plan + canonical dashboard
│   ├── design_system.html           # shared Bymax design system (copied verbatim)
│   └── tasks/                       # one file per phase + README index
├── apps/
│   ├── api/                      # NestJS 11 backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts     # BymaxQueueModule.forRootAsync wiring
│   │   │   ├── config/           # env parsing, queue config factory
│   │   │   ├── orders/           # demo domain: orders + fulfillment
│   │   │   ├── processors/       # email, webhook, report, search, invoice
│   │   │   ├── flows/            # fulfillment flow definitions + endpoints
│   │   │   ├── schedulers/       # boot-time scheduler registration + endpoints
│   │   │   ├── workers/          # dynamic (per-tenant) + sandboxed registration
│   │   │   ├── admin/            # queue admin API (inspect, control, metrics)
│   │   │   ├── events/           # SSE bridge for worker/queue events
│   │   │   └── errors/           # error explorer endpoints
│   │   └── test/                 # e2e specs (real Redis)
│   └── web/                      # Next.js 16 dashboard
│       ├── app/                  # pages per §13.2
│       ├── components/
│       └── lib/                  # api client typed via ./shared only
└── README.md
```

No `.gitkeep` files anywhere; directories exist only when a real file lands in them.

## 7. Feature Coverage Matrix

The contract of this repository. Every row must be traceable to working code, a UI surface, and at least one test. Task files reference rows by number; the phase-close audits verify them. "Lib §" points into the library's `docs/technical_specification.md`.

### 7.1 Module, registration, connection (lib §2, §4)

| #   | Library feature                                                                                  | Example scenario                                                                          | Where it lives                           |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | `forRootAsync` + `useFactory` + `inject`                                                         | Primary wiring from typed env config                                                      | `apps/api/src/app.module.ts`             |
| 2   | `forRoot` (sync)                                                                                 | Covered in unit tests of the config factory (a second Nest app instance in e2e)           | `apps/api/test/registration.e2e-spec.ts` |
| 3   | `useClass` / `useExisting` factories                                                             | Options factory class exercised in e2e registration spec                                  | same as row 2                            |
| 4   | `isGlobal: true` default                                                                         | `QueueService` injected in a feature module that does not import the queue module         | `orders/` module                         |
| 5   | Symbol tokens (`BYMAX_QUEUE_OPTIONS`, `BYMAX_QUEUE_REDIS_CLIENT`, `BYMAX_QUEUE_CONNECTION_MODE`) | Diagnostics endpoint reports resolved mode + options snapshot                             | `admin/diagnostics.controller.ts`        |
| 6   | Mode B: `connection.url`                                                                         | Default boot path (`REDIS_URL`)                                                           | `config/queue.config.ts`                 |
| 7   | Mode B: `connection.options` (host/port/db)                                                      | Alternate branch selected by `QUEUE_CONNECTION_STYLE=options`                             | `config/queue.config.ts`                 |
| 8   | Mode A: `connection.client`                                                                      | App-owned ioredis provider injected when `QUEUE_CONNECTION_MODE=shared`                   | `config/shared-redis.provider.ts`        |
| 9   | Per-role retry policy (queue fail-fast vs worker `null`)                                         | Diagnostics endpoint exposes `maxRetriesPerRequest` per connection role; e2e asserts both | `admin/diagnostics.controller.ts`        |
| 10  | `defaultJobOptions` merge                                                                        | Module sets custom attempts/backoff; job detail UI shows inherited vs overridden options  | `config/queue.config.ts`, web job detail |
| 11  | `prefix` (multi-tenant isolation)                                                                | `QUEUE_PREFIX` env demonstrated + documented; e2e asserts keys carry the prefix           | `config/queue.config.ts`                 |
| 12  | `queueOptions` passthrough                                                                       | Per-queue override via `getOrCreateQueue` overrides argument                              | `admin/queues.service.ts`                |

### 7.2 Enqueue surface (lib §5)

| #   | Library feature                                                 | Example scenario                                                              | Where it lives                 |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| 13  | `enqueue<TData, TResult>` typed                                 | Order placement enqueues typed `send-receipt` email job                       | `orders/orders.service.ts`     |
| 14  | Per-job `priority`                                              | Priority selector in Playground; VIP order emails jump the queue              | `admin/enqueue.controller.ts`  |
| 15  | Per-job `delay`                                                 | Delayed reminder email (visible in `delayed` status)                          | Playground + `orders/`         |
| 16  | `jobId` idempotent insert                                       | `welcome:{userId}`: second enqueue is a no-op; endpoint returns both attempts | `orders/onboarding.service.ts` |
| 17  | Deduplication simple `{ id }`                                   | Search reindex per term while in-flight                                       | `search/reindex.service.ts`    |
| 18  | Deduplication throttle `{ id, ttl }`                            | At most one reindex per term per 5s window                                    | `search/reindex.service.ts`    |
| 19  | Deduplication debounce `{ id, ttl, extend, replace }` + `delay` | Live "settings changed" job keeps only the latest payload                     | `search/reindex.service.ts`    |
| 20  | Deduplication keep-last-if-active                               | Follow-up job auto-created after active completes                             | `search/reindex.service.ts`    |
| 21  | `getDeduplicationJobId` / `removeDeduplicationKey`              | Dedup inspector endpoint (view + clear)                                       | `admin/dedup.controller.ts`    |
| 22  | `enqueueBulk`                                                   | Campaign send: N receipt emails in one roundtrip                              | `orders/campaign.service.ts`   |
| 23  | `MAX_BULK_SIZE` guard (`queue.bulk_enqueue_failed`)             | Bulk of 1001 rejected before anything enqueues                                | error explorer + e2e           |
| 24  | `getOrCreateQueue` caching                                      | Same instance returned across calls (unit-asserted)                           | `admin/queues.service.ts`      |

### 7.3 Inspection, control, metrics (lib §5.7 to §5.9, §9)

| #   | Library feature                      | Example scenario                                                  | Where it lives                |
| --- | ------------------------------------ | ----------------------------------------------------------------- | ----------------------------- |
| 25  | `getJob`                             | Job detail endpoint + UI page                                     | `admin/jobs.controller.ts`    |
| 26  | `getJobs` by status + pagination     | Queue detail lists jobs per status with paging                    | `admin/jobs.controller.ts`    |
| 27  | `getMetrics` (direct)                | Queue cards on the overview page                                  | `admin/metrics.controller.ts` |
| 28  | `MetricsService.get` (TTL cache)     | Health endpoint hits cache; `collectedAt` proves staleness window | `admin/health.controller.ts`  |
| 29  | `MetricsService.getAll`              | Overview aggregates all known queues                              | `admin/metrics.controller.ts` |
| 30  | `MetricsService.invalidate`          | Refresh button forces cache invalidation                          | `admin/metrics.controller.ts` |
| 31  | `pauseQueue` / `resumeQueue`         | Pause/resume buttons on queue detail; paused count visible        | `admin/queues.controller.ts`  |
| 32  | `cleanQueue` (grace, limit, status)  | "Clean completed older than 1m" action returns removed ids        | `admin/queues.controller.ts`  |
| 33  | Health check pattern (consumer-side) | `/health/ready` composes MetricsService per lib §9.5              | `admin/health.controller.ts`  |

### 7.4 Workers, dispatch, events (lib §6)

| #   | Library feature                                                | Example scenario                                                                                | Where it lives                         |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| 34  | `@Processor(queue, options)` + DI                              | `EmailProcessor` injects a mailer stub via constructor                                          | `processors/email.processor.ts`        |
| 35  | `@Process('name')` specific dispatch                           | `send-welcome` vs `send-receipt` handlers                                                       | `processors/email.processor.ts`        |
| 36  | `@Process()` fallback dispatch                                 | Unnamed handler catches every other email job                                                   | `processors/email.processor.ts`        |
| 37  | Explicit `concurrency`                                         | Webhook worker at 5; visible interleaving in events feed                                        | `processors/webhook.processor.ts`      |
| 38  | Missing concurrency warning + fallback                         | One deliberately unconfigured processor; warning asserted in unit test                          | `processors/audit.processor.ts`        |
| 39  | `limiter { max, duration }`                                    | Webhook worker capped at 2/s; feed shows throttling                                             | `processors/webhook.processor.ts`      |
| 40  | Retries + exponential backoff                                  | Failure-injection flag makes webhook fail N times then succeed; attempts timeline in UI         | `processors/webhook.processor.ts`      |
| 41  | At-least-once idempotent handler pattern                       | Receipt handler uses an already-processed marker keyed by `job.id`                              | `processors/email.processor.ts`        |
| 42  | `lockDuration` / `stalledInterval`                             | Long-running report with tuned lock; stalled demo endpoint kills mid-flight and shows recovery  | `processors/report.processor.ts`       |
| 43  | `job.updateProgress` (number + object)                         | Report job emits 10..100 and `{ stage, pct }`                                                   | `processors/report.processor.ts`       |
| 44  | `@OnWorkerEvent` (`completed`, `failed`, `progress`, `active`) | Bridged into the SSE feed with full `Job` fields                                                | `events/worker-events.listener.ts`     |
| 45  | `@OnQueueEvent` (global, serialized) + lazy `QueueEvents`      | Cross-instance feed entries show `jobId` + string `returnvalue`; `getJob` fallback demonstrated | `events/queue-events.listener.ts`      |
| 46  | `queue.duplicate_processor` guard                              | e2e registers a duplicate `@Processor` in an isolated app and expects the error                 | `test/registration.e2e-spec.ts`        |
| 47  | `WorkerRegistry.register` (dynamic)                            | Per-tenant notification workers created from config at runtime                                  | `workers/tenant-workers.service.ts`    |
| 48  | `WorkerRegistry.unregister` / `list`                           | Workers page lists + removes tenant workers                                                     | `workers/tenant-workers.controller.ts` |
| 49  | `registerSandboxed` (+ `useWorkerThreads`)                     | CPU-bound invoice render in a standalone processor file                                         | `workers/invoice.sandboxed.ts`         |

### 7.5 Flows and schedulers (lib §7, §8)

| #   | Library feature                                       | Example scenario                                                                       | Where it lives                          |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| 50  | `FlowService.add` (fan-out/fan-in)                    | Fulfillment flow: reserve-stock + charge-payment children, ship parent                 | `flows/fulfillment.service.ts`          |
| 51  | Nested children                                       | Invoice branch with two data-fetch grandchildren                                       | `flows/fulfillment.service.ts`          |
| 52  | `waiting-children` pitfall                            | Endpoint provokes a child failure WITHOUT `failParentOnFailure`; UI shows parent stuck | `flows/fulfillment.controller.ts`       |
| 53  | `failParentOnFailure: true`                           | Same flow with the flag: parent fails; UI contrast view                                | `flows/fulfillment.service.ts`          |
| 54  | `ignoreDependencyOnFailure: true`                     | Optional-child variant proceeds despite failure                                        | `flows/fulfillment.service.ts`          |
| 55  | `FlowService.addBulk`                                 | Batch of order flows in one roundtrip                                                  | `flows/fulfillment.service.ts`          |
| 56  | `getProducer` escape hatch                            | Advanced endpoint reads the flow tree via producer                                     | `flows/fulfillment.controller.ts`       |
| 57  | `upsertJobScheduler` cron 5-field + `tz`              | Nightly cleanup `0 3 * * *` America/Sao_Paulo                                          | `schedulers/boot-schedulers.service.ts` |
| 58  | Cron 6-field (seconds)                                | Demo heartbeat `*/30 * * * * *`                                                        | `schedulers/boot-schedulers.service.ts` |
| 59  | `every` + `offset` + `limit`                          | Metrics snapshot every 5m, phase-shifted, capped runs                                  | `schedulers/boot-schedulers.service.ts` |
| 60  | Idempotent upsert by `schedulerId`                    | Boot re-registration proves no duplicates (`OnApplicationBootstrap` pattern)           | `schedulers/boot-schedulers.service.ts` |
| 61  | `getJobSchedulers` (paginated) / `removeJobScheduler` | Schedulers page lists + deletes                                                        | `schedulers/schedulers.controller.ts`   |
| 62  | `queue.invalid_repeat_options` validation             | Error explorer triggers: both pattern+every, `every <= 0`, bad cron, past `endDate`    | `errors/error-explorer.controller.ts`   |

### 7.6 Shutdown, errors, telemetry, shared subpath (lib §10, §12, §4.1)

| #   | Library feature                                      | Example scenario                                                                                                | Where it lives                                                       |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 63  | Graceful shutdown (bounded drain)                    | Shutdown demo script: SIGTERM with an in-flight slow job; logs show drain then exit                             | `apps/api` + `scripts/demo-shutdown.mjs`                             |
| 64  | `drainTimeoutMs` + `queue.shutdown_timeout_exceeded` | Tight timeout variant forces the overrun path in e2e                                                            | `test/shutdown.e2e-spec.ts`                                          |
| 65  | `drainOnShutdown` (dev only)                         | Enabled in the compose dev profile; documented DANGER                                                           | `config/queue.config.ts`                                             |
| 66  | `QueueException` envelope                            | All error-explorer responses share `{ error: { code, message, details } }`                                      | `errors/` + web error explorer                                       |
| 67  | Full `QUEUE_ERROR_CODES` catalog (12 codes)          | Error explorer triggers every reproducible code; the two connection-bootstrap codes are covered by e2e variants | `errors/error-explorer.controller.ts`, `test/connection.e2e-spec.ts` |
| 68  | `telemetry` (bullmq-otel) opt-in                     | `QUEUE_OTEL=true` wires `BullMQOtel`; span presence asserted with an in-memory exporter                         | `config/telemetry.config.ts`                                         |
| 69  | `./shared` zero-dependency subpath in the browser    | Web imports `JOB_STATUS`, `QUEUE_ERROR_CODES`, `QueueMetrics` types ONLY from `./shared`                        | `apps/web/lib/queue-shared.ts`                                       |
| 70  | Re-exported BullMQ types resolve                     | `Job`, `FlowJob`, `JobSchedulerJson` used in api typings via the library re-export                              | `apps/api/src/**`                                                    |

## 8. Library Consumption

Identical policy to the sibling examples:

1. **Local file link while unpublished.** `"@bymax-one/nest-queue": "file:../../../nest-queue"` in `apps/api` (and in `apps/web`, which uses only `./shared`). The link resolves through the library's built `dist/` + `exports` map, validating the published surface, never `src/`. The library must be built (`pnpm --dir ../nest-queue build`) before install.
2. **Switch to semver after publish.** When `@bymax-one/nest-queue` lands on npm, the dependency flips to `^0.1.0` in a single dedicated PR (tracked in the plan's final phase).
3. **Peers live in the app.** `apps/api` declares `@nestjs/common ^11`, `@nestjs/core ^11`, `bullmq ^5`, `ioredis ^5`, `reflect-metadata ^0.2` so the linked library resolves every peer to a single copy. `apps/web` declares NONE of them: the zero-dependency `./shared` import resolving without peers is itself a coverage proof (row 69).
4. **Optional peer only when the flag is on.** `bullmq-otel` enters `apps/api` dependencies only for the telemetry scenario (row 68) and is imported lazily behind `QUEUE_OTEL`.
5. **No `paths` aliases, no workspace membership** for the library, ever.

## 9. Configuration and Environment

All env vars are read once in `apps/api/src/config/`; nothing else touches `process.env`.

| Variable                  | Default                    | Purpose                                         |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| `PORT`                    | `3080`                     | API port                                        |
| `REDIS_URL`               | `redis://localhost:6379/0` | Mode B url (row 6)                              |
| `QUEUE_CONNECTION_STYLE`  | `url`                      | `url` or `options` (rows 6, 7)                  |
| `QUEUE_CONNECTION_MODE`   | `own`                      | `own` (Mode B) or `shared` (Mode A, row 8)      |
| `QUEUE_PREFIX`            | `nqex`                     | Redis key prefix (row 11)                       |
| `QUEUE_DRAIN_TIMEOUT_MS`  | `30000`                    | Shutdown drain budget (rows 63, 64)             |
| `QUEUE_DRAIN_ON_SHUTDOWN` | `false`                    | Dev-only queue drain (row 65)                   |
| `QUEUE_OTEL`              | `false`                    | bullmq-otel telemetry (row 68)                  |
| `WEBHOOK_FAILURES`        | `2`                        | Failure-injection count for retry demo (row 40) |
| `WEB_ORIGIN`              | `http://localhost:3000`    | CORS for the dashboard                          |

`apps/web` uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3080`).

### 9.1 The canonical wiring

The single most copied block of this repository. `config/queue.config.ts` is a pure factory, unit-tested on every branch:

```typescript
import type { BymaxQueueModuleOptions } from '@bymax-one/nest-queue'
import type { Redis } from 'ioredis'
import type { AppEnv } from './env'

/**
 * Builds the library options from the parsed environment.
 * Pure function: no process.env access, no side effects, fully unit-testable.
 */
export function buildQueueOptions(env: AppEnv, sharedClient?: Redis): BymaxQueueModuleOptions {
  const connection =
    env.QUEUE_CONNECTION_MODE === 'shared' && sharedClient
      ? { client: sharedClient } // Mode A (row 8)
      : env.QUEUE_CONNECTION_STYLE === 'options'
        ? { options: parseRedisOptions(env.REDIS_URL) } // Mode B options (row 7)
        : { url: env.REDIS_URL } // Mode B url (row 6)

  return {
    connection,
    prefix: env.QUEUE_PREFIX, // row 11
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 1500 }, // row 10
    },
    flows: { enabled: true }, // rows 50 to 56
    metrics: { enabled: true, cacheTtlMs: 3000 }, // rows 28 to 30
    shutdown: {
      drainTimeoutMs: env.QUEUE_DRAIN_TIMEOUT_MS, // rows 63, 64
      drainOnShutdown: env.QUEUE_DRAIN_ON_SHUTDOWN, // row 65
    },
    ...(env.QUEUE_OTEL ? { telemetry: buildTelemetry() } : {}), // row 68
  }
}
```

And the module registration in `app.module.ts`:

```typescript
BymaxQueueModule.forRootAsync({
  inject: [APP_ENV, { token: SHARED_REDIS, optional: true }],
  useFactory: (env: AppEnv, sharedClient?: Redis) => buildQueueOptions(env, sharedClient),
})
```

The `SHARED_REDIS` provider (an app-owned ioredis client) is registered only when `QUEUE_CONNECTION_MODE=shared`, which is exactly the Mode A shape a host using `@bymax-one/nest-cache` would produce (the library spec §11 documents that pairing; this example keeps its dependency surface minimal and documents the substitution).

## 10. Backend Design: `apps/api`

### 10.1 Module map

| Module             | Responsibility                                                     | Coverage rows      |
| ------------------ | ------------------------------------------------------------------ | ------------------ |
| `AppModule`        | `BymaxQueueModule.forRootAsync` wiring, config                     | 1, 6, 7, 8, 10, 11 |
| `OrdersModule`     | Demo domain: place orders, onboarding, campaigns                   | 4, 13 to 16, 22    |
| `ProcessorsModule` | All `@Processor` classes                                           | 34 to 43           |
| `FlowsModule`      | Fulfillment flows + endpoints                                      | 50 to 56           |
| `SchedulersModule` | Boot registration + management endpoints                           | 57 to 62           |
| `WorkersModule`    | Dynamic per-tenant + sandboxed registration                        | 47 to 49           |
| `AdminModule`      | Inspection, control, metrics, health, diagnostics, dedup inspector | 5, 9, 21, 24 to 33 |
| `EventsModule`     | `@OnWorkerEvent` / `@OnQueueEvent` bridge + SSE endpoint           | 44, 45             |
| `ErrorsModule`     | Error explorer (catalog triggers)                                  | 23, 62, 66, 67     |

### 10.2 House style

Controllers are thin (validate, delegate, return); services own logic; every provider uses explicit constructor injection; every file carries `@fileoverview` + `@layer`; functions <= 50 lines; files <= 800 lines; comments explain the why and are timeless. Demo persistence is in-memory repositories (no database: the library is Redis-only and a DB would blur the example's focus).

## 11. Demo Domain and REST API

The demo domain is **Orderly**, a miniature order fulfillment backend. It exists to give every queue feature a believable trigger:

| Endpoint group | Sample routes                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders         | `POST /orders` (enqueues receipt email + fulfillment flow), `POST /orders/:id/remind` (delayed job), `POST /onboarding/:userId` (idempotent `jobId`) |
| Campaigns      | `POST /campaigns/receipts` (bulk), `POST /campaigns/oversized` (bulk-limit error)                                                                    |
| Search         | `POST /search/reindex` (dedup modes via `mode` param)                                                                                                |
| Flows          | `POST /flows/fulfillment` (variants: `default`, `failParent`, `ignoreDependency`), `GET /flows/:rootId/tree`                                         |
| Schedulers     | `GET/PUT/DELETE /schedulers/*`                                                                                                                       |
| Workers        | `GET/POST/DELETE /workers/tenants/*`, `POST /workers/invoices/render` (sandboxed)                                                                    |
| Admin          | `GET /admin/queues`, `GET /admin/queues/:name/jobs?status=&start=&end=`, `POST /admin/queues/:name/pause                                             | resume | clean`, `GET /admin/jobs/:queue/:id`, `GET /admin/metrics`, `POST /admin/metrics/invalidate`, `GET /admin/diagnostics`, `GET /admin/dedup/:queue/:id`, `DELETE /admin/dedup/:queue/:id` |
| Events         | `GET /events/stream` (SSE)                                                                                                                           |
| Errors         | `POST /errors/trigger/:code` (reproducible catalog codes)                                                                                            |
| Health         | `GET /health/live`, `GET /health/ready`                                                                                                              |

## 12. Demonstration Scenarios

Each scenario is a documented journey (README section + dashboard affordance) that strings matrix rows together:

1. **Place an order.** `POST /orders` fans out a typed receipt email, a fulfillment flow, and a search reindex (rows 13, 50, 17). Watch the events feed light up.
2. **Retry theater.** Webhook delivery fails `WEBHOOK_FAILURES` times, then succeeds: exponential backoff visible in the job timeline (rows 39, 40, 44).
3. **Dedup lab.** Fire the same reindex 10 times under each of the four modes and compare the resulting job counts (rows 17 to 21).
4. **Flow anatomy.** Run the three fulfillment variants side by side: stuck parent, failed parent, resilient parent (rows 52 to 54).
5. **Scheduler clock.** Watch the 6-field heartbeat tick every 30s; re-boot the app and prove no scheduler duplicates (rows 58, 60).
6. **Tenant scaling.** Add a premium tenant (concurrency 10) and a free tenant (concurrency 2); the workers page shows both; remove one live (rows 47, 48).
7. **CPU offload.** Render an invoice through the sandboxed processor and observe the event loop staying responsive (row 49).
8. **Pull the plug.** Run the shutdown demo script mid-job and read the drain logs (rows 63, 64).
9. **Break it on purpose.** The error explorer triggers every reproducible catalog code and renders the stable envelope (rows 66, 67).

## 13. Frontend Design: `apps/web`

### 13.1 Data layer

- Typed API client in `lib/api.ts`; response types built ONLY from `./shared` exports plus local interfaces mirroring the api DTOs (row 69).
- TanStack Query for polling reads (metrics every 3s aligned with the cache TTL); native `EventSource` for `/events/stream`.
- `lib/queue-status.ts` maps `JOB_STATUS` to the design-system severity palette (color + icon + text, never color alone).

### 13.2 Pages

| Route                | Content                                                                                            | Rows             |
| -------------------- | -------------------------------------------------------------------------------------------------- | ---------------- |
| `/` Overview         | Queue cards (counts by status, paused badge), aggregate metrics, Redis status chip                 | 27, 29           |
| `/queues/[name]`     | Jobs table per status with pagination; pause/resume/clean actions                                  | 26, 31, 32       |
| `/jobs/[queue]/[id]` | Job detail: data, options (inherited vs overridden), attempts timeline, progress bar, return value | 10, 25, 40, 43   |
| `/flows`             | Flow launcher (3 variants) + live tree visualization with per-node status                          | 50 to 56         |
| `/schedulers`        | Scheduler table (pattern/every, tz, next run), delete action, validation error surface             | 57 to 62         |
| `/workers`           | Static processors, dynamic tenant workers (add/remove), sandboxed invoice trigger                  | 37, 38, 47 to 49 |
| `/playground`        | Enqueue form: queue, name, payload, priority, delay, jobId, dedup mode; bulk sender                | 14 to 23         |
| `/events`            | Live SSE feed with worker vs global event badges                                                   | 44, 45           |
| `/errors`            | Error explorer: trigger buttons + envelope rendering                                               | 66, 67           |
| `/health`            | Liveness/readiness, metrics cache freshness, diagnostics (mode, retry policy)                      | 5, 9, 28, 33     |

### 13.3 Signature components

`QueueCard`, `JobStatusBadge`, `AttemptsTimeline`, `FlowTree`, `DedupModePicker`, `EventFeedItem`, `EnvelopeViewer` (the stable error envelope pretty-printer), `RedisStatusChip`.

## 14. Design System

The dashboard uses the **shared, project-agnostic Bymax design system**; the source of truth is [`docs/design_system.html`](./design_system.html) (copied verbatim from the sibling examples; open in a browser for the full rendered system and the agent recreation guide). **Do not invent a new visual language**: any two Bymax example apps must look like one product.

- **Forced dark**, brand orange `#ff6224`, glass-morphism surfaces, Geist Sans for prose, monospace for headings, metric values, queue names, job ids, and table cells.
- The four files copied verbatim from a sibling `apps/web` (`app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`); `app/layout.tsx` adapted (fonts + forced dark identical, wordmark becomes `nest-queue-example`).
- App shell: 64px topbar + 250px sidebar; topbar carries the wordmark, the Redis status chip, and the live events indicator; active nav uses the left orange border treatment.
- Status mapping: job statuses and event kinds map to the accessible palette (color + icon + text): `completed` green, `failed` red, `active` orange pulse, `waiting` neutral, `delayed` blue, `paused` amber.

## 15. Quality Gates

Mirrors the sibling examples:

| Gate                       | Threshold                                                                                                           | When                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `pnpm typecheck`           | zero errors, both apps                                                                                              | every task                          |
| `pnpm lint`                | zero warnings; no `eslint-disable`, no `@ts-ignore`                                                                 | every task                          |
| Unit coverage              | **100% line/branch/function/statement** on both apps (`coverageThreshold`), every `it()` carries a scenario comment | testing phase onward, then every PR |
| E2E                        | every documented flow against real Redis (service container in CI); suites run sequentially                         | testing phase onward                |
| Jest workers               | `maxWorkers: '50%'` baked into every config; unit and e2e never run concurrently                                    | always                              |
| Mutation testing (Stryker) | `break 95, high 99, low 95`, pre-release gate, not per PR                                                           | hardening phase                     |
| Bundle sanity              | `./shared`-only proof: no `bullmq`/`ioredis`/`@nestjs` in the web client bundle                                     | web phase onward                    |

## 16. CI and Repository Governance

- **`ci.yml` exists from the first PR** (phase 00): install, lint, typecheck, build, unit; the e2e job (Redis `redis:7` service container) is added when the first e2e lands and runs sequentially after unit. Job names are contractual once branch protection references them.
- **Public-only features ship conditionally.** `codeql.yml` and `scorecard.yml` are committed from phase 00 but guard with `if: ${{ !github.event.repository.private }}` so they are inert while the repo is private and activate on the visibility flip, with zero workflow edits.
- **Governance files:** husky + commitlint + lint-staged, `.gitmessage`, dependabot, and the four Copilot review files customized to this stack (each instruction file < 4000 chars except the `.agent.md`).
- **Every phase is one PR** on a `feat/phase-NN-<slug>` branch, opened with `gh pr create`, reviewed by the GitHub Copilot code reviewer (all findings addressed), merged squash with CI green, branch deleted.
- **No AI attribution anywhere**: commits, PR titles, PR bodies, and comments never carry `Co-Authored-By`, "Generated with", or similar lines.

## 17. What is NOT in Scope

| Excluded                             | Why                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Database persistence                 | The library is Redis-only; a DB would blur the focus. In-memory repos suffice for the demo domain           |
| Authentication on the example API    | Orthogonal to queue behavior; the ecosystem auth lib has its own example                                    |
| Production BullMQ dashboard duties   | Bull Board/Taskforce territory; this dashboard is a demonstration surface                                   |
| Horizontal multi-instance deployment | Single api instance; cross-instance semantics are shown via `@OnQueueEvent` and documented, not load-tested |
| Custom telemetry backend             | Row 68 asserts span creation with an in-memory exporter; no collector stack ships here                      |

## 18. Known Limitations

1. **Sandboxed processors need built artifacts.** The invoice processor file must exist as compiled `.js` reachable at runtime; the build wiring is part of the workers phase and documented in the README.
2. **Stalled-job demo is timing-sensitive.** The demo uses a short `lockDuration` and a deliberate hard exit; e2e asserts eventual recovery with generous timeouts to stay flake-free.
3. **Mode A here is app-owned ioredis, not `@bymax-one/nest-cache`.** The canonical Mode A partner is the cache library; to keep this example's dependency surface minimal, Mode A is demonstrated with a local ioredis provider and the cache pairing is documented as a pointer to the library spec (§11 there).
4. **The `queue.invalid_job_data` code** fires only when the consumer wires schema validation; the error explorer demonstrates it through the example's own Zod-checked enqueue endpoint, which is an app-level choice, and the docs say so explicitly.
