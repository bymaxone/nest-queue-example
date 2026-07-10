<p align="center">
  <img src="https://img.shields.io/badge/%40bymax--one-nest--queue--example-000000?style=for-the-badge&logo=nestjs&logoColor=E0234E" alt="nest-queue-example" />
</p>

<h1 align="center">nest-queue-example</h1>

<p align="center">
  <strong>Reference application for <a href="https://github.com/bymaxone/nest-queue"><code>@bymax-one/nest-queue</code></a></strong><br />
  <sub>NestJS 11 · Next.js 16 · React 19 · BullMQ 5 · Redis · Flows · Schedulers · Dynamic workers · SSE</sub>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-queue-example/actions/workflows/ci.yml"><img src="https://github.com/bymaxone/nest-queue-example/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage 100%" />
  <img src="https://img.shields.io/badge/mutation-api%20%E2%89%A595-brightgreen?style=flat-square" alt="mutation api >= 95" />
  <img src="https://img.shields.io/badge/lib-%40bymax--one%2Fnest--queue%20(pre--publish)-6E56CF?style=flat-square" alt="library" />
  <a href="https://github.com/bymaxone/nest-queue-example/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-000000?style=flat-square" alt="license MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24+" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://docs.bullmq.io/"><img src="https://img.shields.io/badge/BullMQ-5-DA3B01?style=flat-square" alt="BullMQ 5" /></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis 7" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" /></a>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-queue">📦 Library</a> ·
  <a href="#-quick-start">🚀 Quick Start</a> ·
  <a href="#-whats-inside">✅ Features</a> ·
  <a href="#-operational-journeys">🎬 Journeys</a> ·
  <a href="#-architecture">🏗️ Architecture</a> ·
  <a href="docs/TECHNICAL_SPECIFICATION.md">📖 Docs</a>
</p>

---

## ✨ Overview

`@bymax-one/nest-queue` is the **what** (a NestJS 11 wrapper over BullMQ); this repository is the
**how**. It is a runnable, production-shaped demo that exercises **every public export** of the library
across a NestJS API and a first-class Next.js queue dashboard. It is three things at once:

- **A runnable demo.** `docker compose up -d` + `pnpm dev` brings up Redis, a NestJS service wired to the
  library, and a Next.js dashboard that fires every queue feature on demand and shows the result: a job
  retrying with exponential backoff, a flow parent stuck behind a failed child, a scheduler ticking every
  30 seconds, a per-tenant worker registered live, a job recovered after a stall.
- **A knowledge base.** Every public symbol is referenced from real code. The spec's
  [Feature Coverage Matrix](docs/TECHNICAL_SPECIFICATION.md#7-feature-coverage-matrix) (70 rows) is the
  completion contract, audited row by row in [docs/COVERAGE_AUDIT.md](docs/COVERAGE_AUDIT.md): the
  canonical place to learn how to wire `forRootAsync`, the enqueue surface and its four deduplication
  modes, every worker knob, hierarchical flows, recurring schedulers, dynamic and sandboxed workers,
  cached metrics, the stable error envelope, and the three connection modes.
- **A copy-paste reference.** `apps/api/src/config/queue.config.ts` exercises the canonical wiring once, so
  adopting the library is a matter of lifting the block you need.

It is a sibling of [`nest-storage-example`](https://github.com/bymaxone/nest-storage-example) and
[`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and follows the same blueprint,
voice, and quality bar: **100% test coverage**, a **Stryker mutation gate** on `apps/api`, English-only,
and Conventional Commits.

The one defining constraint: the library is consumed as an **external package** through its built `dist/`
and `exports` map via a `file:` link (later `^0.1.0`), never a workspace member and never a `tsconfig`
`paths` alias.

---

## 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-queue-example.git
cd nest-queue-example

# 1) clone + build the sibling library once (consumed pre-publish via a local file: link)
git clone https://github.com/bymaxone/nest-queue.git ../nest-queue
cd ../nest-queue && pnpm install && pnpm build
# then back to this repo:
cd ../nest-queue-example

# 2) install workspace deps (resolves the file: link)
pnpm install

# 3) bring up Redis (redis:7-alpine, healthchecked)
docker compose up -d

# 4) start both apps (two terminals)
pnpm --filter @nest-queue-example/api dev    # NestJS API on http://localhost:3080
pnpm --filter @nest-queue-example/web dev    # Next.js dashboard on http://localhost:3000
```

| Surface                | URL                                         |
| ---------------------- | ------------------------------------------- |
| Dashboard (`apps/web`) | <http://localhost:3000>                     |
| API health             | <http://localhost:3080/health/ready>        |
| Diagnostics            | <http://localhost:3080/admin/diagnostics>   |
| Live event stream      | <http://localhost:3080/events/stream> (SSE) |

The library is **pre-publish**, consumed via a local `file:` link to the sibling `../nest-queue` checkout
until it ships to npm (build it first, step 1). Every environment variable has a safe default (see
[`.env.example`](.env.example)), so the local happy path needs **zero configuration**: with Redis on
`localhost:6379` the apps boot as-is. Copy `.env.example` to `.env` only to override a default.

> Dashboard screenshots are added on the public-visibility flip; see
> [docs/RELEASE_CHECKLISTS.md](docs/RELEASE_CHECKLISTS.md).

---

## 🔥 What's inside

- **Registration + connection:** `forRootAsync` from typed env, the `isGlobal` default, Symbol tokens
  surfaced in diagnostics, `defaultJobOptions` merge, and a `prefix` for multi-tenant key isolation.
- **Enqueue surface:** typed `enqueue` (priority, delay, `jobId` idempotency), all four deduplication modes
  (simple, throttle, debounce, keep-last-if-active) with a dedup inspector, `enqueueBulk`, and the
  `MAX_BULK_SIZE` guard.
- **Inspection + control:** `getJob`, `getJobs` by status with pagination, `pauseQueue` / `resumeQueue`,
  `cleanQueue`, direct and cached `getMetrics`, and a consumer-side `/health/ready` composition.
- **Workers + events:** named vs fallback dispatch, explicit concurrency, a rate limiter, retries with
  exponential backoff, at-least-once idempotency, progress (number + object), the missing-concurrency
  warning, both `@OnWorkerEvent` and `@OnQueueEvent` decorators bridged into a Server-Sent Events feed.
- **Flows + schedulers:** fan-out/fan-in flows with nested children and the three failure-propagation
  variants (stuck parent, `failParentOnFailure`, `ignoreDependencyOnFailure`), `addBulk`, the flow-tree
  read, cron (5-field + tz and 6-field seconds) and `every` schedulers with idempotent boot registration.
- **Dynamic + sandboxed workers:** per-tenant workers registered, listed, and removed at runtime, plus a
  CPU-bound invoice render in a sandboxed processor.
- **Connection modes + errors:** Mode B (`url` / `options`, library-owned) and Mode A (`client`, app-owned
  ioredis), the per-role retry policy in diagnostics, the stable `{ error: { code, message, details } }`
  envelope, and an explorer that reproduces every reproducible `QUEUE_ERROR_CODES` value.
- **The dashboard (`apps/web`):** ten pages over a typed data layer keyed by `JOB_STATUS` and
  `QUEUE_ERROR_CODES` from the `./shared` subpath, with a live SSE feed.
- **Quality bar:** 100% coverage on all four metrics for both apps, route-exhaustive e2e against real
  Redis, and a Stryker mutation gate on `apps/api`.

---

## 🔌 Connection modes

The library accepts the Redis connection three ways, selected by two environment variables.
`GET /admin/diagnostics` is the single source of truth for the active mode and proves the per-role retry
policy: the Queue/FlowProducer role keeps ioredis' default `maxRetriesPerRequest` (20, fail-fast so
`enqueue` never blocks during an outage) while Worker/QueueEvents roles are forced to `null` (required for
BullMQ's blocking commands). The connection URL, host, and password are a credential surface and never
appear in any response.

| Recipe                                                                | Resolved mode  | `connection` in `/admin/diagnostics`                                        |
| --------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| _default_ (`QUEUE_CONNECTION_MODE=own`, `QUEUE_CONNECTION_STYLE=url`) | `mode-b-owned` | `style: "url"`, `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null`     |
| `QUEUE_CONNECTION_STYLE=options`                                      | `mode-b-owned` | `style: "options"`, `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null` |
| `QUEUE_CONNECTION_MODE=shared`                                        | `mode-a-byo`   | `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null`                     |

In Mode A (`shared`) the app owns an ioredis client and hands it to the library as `{ client }` (the shape
a `@bymax-one/nest-cache` host would produce); the library uses it as-is for the Queue role and never
closes it, so the app closes it on shutdown. Modes B (`url` / `options`) let the library open and close its
own connection.

```bash
curl -s http://localhost:3080/admin/diagnostics
# {"mode":"mode-b-owned","prefix":"nqex","flowsEnabled":true,"metricsEnabled":true,
#  "connection":{"mode":"mode-b-owned","style":"url","queueRoleMaxRetries":20,"workerRoleMaxRetries":null}}
```

---

## 🎬 Operational journeys

Each journey strings together a set of coverage-matrix rows. Start both apps (Quick start) and open the
dashboard, or drive the API directly with the commands below. Watch the live feed alongside any journey
with `curl -N http://localhost:3080/events/stream`.

### 1. Place an order

Fans out a typed receipt email, a fulfillment flow, and a webhook delivery.

```bash
curl -s -X POST http://localhost:3080/orders \
  -H 'Content-Type: application/json' \
  -d '{"to":"buyer@example.com","total":42.5,"vip":true}'
```

### 2. Retry theater

The webhook enqueued by an order fails `WEBHOOK_FAILURES` (default 2) times, then succeeds: the exponential
backoff is visible in the events feed and the job's attempts timeline. Place an order (journey 1) and watch
the `webhooks` queue in the feed, or on the dashboard's Jobs page.

### 3. Dedup lab

Fire the same reindex under each of the four deduplication modes and compare the resulting job counts.

```bash
for mode in simple throttle debounce keepLast; do
  curl -s -X POST http://localhost:3080/search/reindex \
    -H 'Content-Type: application/json' \
    -d "{\"term\":\"widgets\",\"mode\":\"$mode\"}"
  echo
done
```

### 4. Flow anatomy

Run the fulfillment flow in its variants side by side: a stuck parent, a failed parent, and a resilient
parent.

```bash
for variant in default stuck failParent ignoreDependency; do
  curl -s -X POST http://localhost:3080/flows/fulfillment \
    -H 'Content-Type: application/json' \
    -d "{\"orderId\":\"order-$variant\",\"variant\":\"$variant\"}"
  echo
done
# then read a flow tree:
curl -s http://localhost:3080/flows/<rootId>/tree
```

### 5. Scheduler clock

A 6-field heartbeat ticks every 30 seconds; re-boot the app and the idempotent upsert proves no duplicate
schedulers appear.

```bash
curl -s http://localhost:3080/schedulers          # list registered schedulers
curl -s http://localhost:3080/schedulers/ticks     # recorded heartbeat ticks
```

### 6. Tenant scaling

Register a premium tenant (higher concurrency) and a free tenant, list them, then remove one live.

```bash
curl -s -X POST http://localhost:3080/workers/tenants \
  -H 'Content-Type: application/json' -d '{"tenantId":"acme","tier":"premium"}'
curl -s -X POST http://localhost:3080/workers/tenants \
  -H 'Content-Type: application/json' -d '{"tenantId":"globex","tier":"free"}'
curl -s http://localhost:3080/workers/tenants
curl -s -X DELETE http://localhost:3080/workers/tenants/globex
```

### 7. CPU offload

Render an invoice through the sandboxed processor; the event loop stays responsive while the hashing loop
runs off-thread.

```bash
curl -s -X POST http://localhost:3080/workers/invoices/render \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"inv-001","lines":["10 widgets","2 gadgets"]}'
curl -s http://localhost:3080/workers/lag           # event-loop lag samples
```

### 8. Stalled-job recovery

A `demos` job sleeps far longer than its deliberately short `lockDuration`. A live worker renews the lock
and the job completes; kill the worker mid-job and the restarted worker detects the stalled job and re-runs
it.

```bash
# Terminal 1: build, start, and watch the feed
pnpm --filter @nest-queue-example/api build
node apps/api/dist/main.js &
curl -N http://localhost:3080/events/stream

# Terminal 2: enqueue the slow job, then kill the API mid-job (before ~20s)
curl -s -X POST http://localhost:3080/demos/stall
kill <api-pid>
# Restart the API; within ~10s the feed shows the demos job: active, stalled, completed
node apps/api/dist/main.js
```

### 9. Break it on purpose

The error explorer reproduces every reproducible catalog code and renders the stable envelope. Inspect the
catalog first, then trigger a code.

```bash
curl -s http://localhost:3080/errors/catalog
curl -s -X POST http://localhost:3080/errors/trigger/queue.bulk_enqueue_failed
# {"error":{"code":"queue.bulk_enqueue_failed","message":"Bulk enqueue failed",
#  "details":{"reason":"batch size exceeds limit","limit":1000,"received":1001}}}
```

### Graceful shutdown

`scripts/demo-shutdown.mjs` boots the built API, enqueues a slow report job, sends `SIGTERM` mid-job, and
asserts the process drains the in-flight work and exits cleanly within the drain budget.

```bash
pnpm --filter @nest-queue-example/api build
node scripts/demo-shutdown.mjs        # prints PASS on a clean drained shutdown
```

---

## 🏗️ Architecture

```
            apps/web (Next.js 16 + React 19): the Queue Dashboard
   Overview · Queue detail · Job detail · Flows · Schedulers · Workers
   Playground · Events (SSE) · Errors · Health
        │  POST /orders /search/* /flows/* /workers/* /admin/*        ▲ GET metrics / SSE stream
        ▼                                                             │
   ┌─────────────────────────────────────────────────────────────────┴──────────────────┐
   │ apps/api (NestJS 11 + Express)                                                        │
   │ BymaxQueueModule.forRootAsync({ useFactory }): config/queue.config.ts (canonical)    │
   │ QueueService · FlowService · WorkerRegistry · MetricsService · processors · listeners │
   │ Stable error envelope · SSE bridge · /admin/diagnostics (masked connection)          │
   └────────────────────────────────────────────┬─────────────────────────────────────────┘
                              BullMQ 5 (via @bymax-one/nest-queue)
                                                 ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ Redis 7 (redis:7-alpine): queues, workers, flows, schedulers,      │
   │  metrics; local dev bound to 127.0.0.1:6379, no password           │
   └─────────────────────────────────────────────────────────────────┘
```

`apps/api` and `apps/web` are independently deployable. `apps/api` declares the five library peers
(`@nestjs/common`, `@nestjs/core`, `bullmq`, `ioredis`, `reflect-metadata`); `apps/web` declares none of
them and imports the library's `./shared` subpath only, so no `bullmq` / `ioredis` / `@nestjs` code ever
reaches the browser bundle.

> **Coverage rule.** Every public export of `@bymax-one/nest-queue` (the `.` and `./shared` subpaths) is
> referenced from at least one file under `apps/`, and each of the spec's 70 matrix rows is traced to code,
> a UI surface, and a test in [docs/COVERAGE_AUDIT.md](docs/COVERAGE_AUDIT.md).

---

## 🧪 Testing

Run the suites **one at a time**: never unit and e2e concurrently, and never fan out parallel test runners
(the locally linked library is duplicated across workers and can exhaust memory). `maxWorkers: '50%'` is
baked into every config, and `NODE_OPTIONS=--max-old-space-size=4096` guards peak heap.

```bash
pnpm --filter @nest-queue-example/api test:cov   # Jest, api unit, 100% (statements/branches/functions/lines)
pnpm --filter @nest-queue-example/web test:cov   # Vitest, web unit, 100%
pnpm --filter @nest-queue-example/api test:e2e   # real Redis, sequential, after unit (needs Docker)

# mutation gate (local pre-release, not a per-PR CI job)
pnpm --filter @nest-queue-example/api mutation   # Stryker on apps/api, break 95
```

E2E stands up its own real Redis; on a machine where `6379` is busy, point it elsewhere with
`E2E_REDIS_URL=redis://127.0.0.1:<port>/0`. CI runs unit and e2e as sequential jobs against a `redis:7`
service container.

---

## 📖 Documentation

| Doc                                                          | What it covers                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [TECHNICAL_SPECIFICATION](docs/TECHNICAL_SPECIFICATION.md)   | Architecture, the 70-row feature matrix, wiring patterns, decisions |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md)                 | The phased build plan, progress dashboard, and quality gates        |
| [Task files](docs/tasks/)                                    | Per-phase task breakdowns with acceptance criteria                  |
| [COVERAGE_AUDIT](docs/COVERAGE_AUDIT.md)                     | Row-by-row evidence for all 70 matrix rows                          |
| [mutation_testing_results](docs/mutation_testing_results.md) | Stryker score, survivors, and documented equivalents                |
| [RELEASE_CHECKLISTS](docs/RELEASE_CHECKLISTS.md)             | The npm-dependency-flip and public-visibility-flip checklists       |

---

## 🧱 Tech stack

| Layer             | Choice                            | Why                                                            |
| ----------------- | --------------------------------- | -------------------------------------------------------------- |
| Queue library     | `@bymax-one/nest-queue`           | The library this repo demonstrates (pre-publish, `file:` link) |
| Backend runtime   | Node.js >= 24                     | Library minimum; native streams and `node:crypto`              |
| Backend framework | NestJS 11 on Express              | Library peer dep                                               |
| Queue engine      | BullMQ 5 + Redis 7                | The library transport; Redis is the only external service      |
| Frontend          | Next.js 16 App Router             | Consumes the library's `./shared` browser subpath only         |
| UI                | React 19 + Tailwind 4 + shadcn/ui | The verbatim Bymax design system (forced dark)                 |
| Tests (api)       | Jest 30 + supertest               | Unit + e2e HTTP surface, 100% coverage                         |
| Tests (web unit)  | Vitest 3 (jsdom)                  | Fast ESM-first runner, 100% coverage                           |
| Tests (e2e)       | Jest + real Redis                 | Route-exhaustive flows against a live queue                    |
| Mutation          | Stryker                           | `break 95` gate on `apps/api`, local pre-release               |
| Container runtime | Docker Compose v2                 | Single-command local Redis                                     |
| Package manager   | pnpm 10                           | Matches the library; first-class workspace support             |

---

## 🤝 Contributing

Issues and PRs are welcome. Because this is a reference application, the bar for changes is:

> _"Does this make the demonstration of `@bymax-one/nest-queue` clearer or more complete?"_

Generic refactors that obscure library usage will be declined. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the full process.

```bash
git clone https://github.com/bymaxone/nest-queue-example.git
cd nest-queue-example
pnpm install                                              # build the sibling ../nest-queue first
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
docker compose up -d
pnpm --filter @nest-queue-example/api dev
```

---

## 🔒 Security policy

Please **do not** open a public issue, discussion, or pull request for a security vulnerability. For a
vulnerability in **this example** (an API route, the dashboard, the build/CI, or a dependency), email
**support@bymax.one** with `[security] nest-queue-example` in the subject line. For a vulnerability in the
**library itself** (`@bymax-one/nest-queue`), report it against
[its repository](https://github.com/bymaxone/nest-queue) instead.

The Redis connection is a credential surface and must never leak in a log, an error body, or an SSE frame;
we triage security reports ahead of feature work. See [SECURITY.md](SECURITY.md) for the full disclosure
process.

---

## 📄 License

[MIT](LICENSE) © [Bymax One](https://bymax.one)

Library source: [`@bymax-one/nest-queue`](https://github.com/bymaxone/nest-queue), MIT.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/bymaxone">Bymax One</a> to demonstrate <a href="https://github.com/bymaxone/nest-queue">@bymax-one/nest-queue</a>.</sub>
</p>
