---
applyTo: 'apps/**/*.ts,apps/**/*.tsx'
---

# Source code standards (apps/api - apps/web)

## TypeScript flags - practical impact (`tsconfig.base.json`)

- **`noUncheckedIndexedAccess`**: `arr[i]` / `record[k]` is `T | undefined`. Guard every index access.
- **`exactOptionalPropertyTypes`**: build objects with **conditional spreads** (`...(v ? { x: v } : {})`); never assign explicit `undefined` to an optional prop (the `telemetry` spread in `buildQueueOptions` is the canonical example).
- **`verbatimModuleSyntax`**: type-only imports MUST use `import type`; type re-exports use `export type`.
- **`noImplicitOverride` / `noFallthroughCasesInSwitch` / `noUnusedLocals` / `noUnusedParameters`**: `override` on Nest lifecycle hooks; no switch fall-through; no dead bindings.

## ESLint (flat, `strictTypeChecked` + `stylisticTypeChecked`) - errors

`no-explicit-any`, `no-floating-promises` (mark fire-and-forget with `void`), `no-misused-promises`, `no-unsafe-*`. **No suppression comments** (`@ts-ignore`, `@ts-expect-error`, `eslint-disable*`) in `apps/`. `no-restricted-imports` bans `dotenv`, `moment`, `lodash`, unprefixed `crypto`, `crypto-js`, `md5`, `bcrypt`, `uuid`, `nanoid`; use `node:*` prefixes and native APIs. Only `*.spec.ts` / `*.e2e-spec.ts` / `test/**` relax `no-unsafe-*` and `no-explicit-any`.

## Backend (NestJS - apps/api)

- DI only; inject via the constructor. Layered: controller -> service -> provider/repository; no cross-feature imports. Controllers are thin (validate, delegate, return); services own logic.
- Validate every request body/query with a **Zod** schema; parse env once with Zod in `config/env.ts` (fail-fast). Nothing outside `config/` touches `process.env`.
- Wire the library through `BymaxQueueModule.forRootAsync({ useFactory, inject })`; the factory delegates to the pure `buildQueueOptions(env, sharedClient?)` in `config/queue.config.ts`. The library ships no controllers - the Orderly demo controllers map onto `QueueService` / `FlowService` / `WorkerRegistry` / `MetricsService`.
- **Connection is a credential surface.** Preserve the per-role retry policy (Queue/FlowProducer keep ioredis default `maxRetriesPerRequest`, Worker/QueueEvents forced to `null`). Never log or return the URL/host/password; mask it in `/admin/diagnostics`.
- Error responses use the stable `{ error: { code, message, details } }` envelope with a `QUEUE_ERROR_CODES` code; never leak a stack, connection string, or internal path. Call `enableShutdownHooks()` so the bounded drain runs on `SIGTERM`.
- `@fileoverview` + `@layer` header per file; functions <= 50 lines; files <= 800.

## Frontend (Next.js 16 App Router - apps/web)

- Import library types/constants from `@bymax-one/nest-queue/shared` **only** - never the `.` server root. `apps/web` declares none of the server peers.
- `'use client'` only on leaf components, never in `layout.tsx`. Server state via **TanStack Query** (metrics poll aligned to the 3s cache TTL); the live feed uses native `EventSource` against `/events/stream`.
- Status = colour **+** icon **+** text (`lib/queue-status.ts` maps `JOB_STATUS`), never colour alone. The design-system files are **byte-identical** to the sibling copy - never re-styled.

## Security & timeless comments

CORS is an explicit allow-list (`WEB_ORIGIN`). Never log secrets, the Redis URL/password, or a raw connection string; keep them out of every response, log line, and SSE frame. Comments are English and timeless - no planning-stage references in code.
