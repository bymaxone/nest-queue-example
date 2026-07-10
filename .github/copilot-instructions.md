# nest-queue-example - Repository Instructions

`nest-queue-example` is the **reference/demo app** for `@bymax-one/nest-queue`, a NestJS 11 wrapper over BullMQ, consumed here as an **external package** (never modified in this repo). A `pnpm` workspace: a NestJS API hosting the library and a Next.js dashboard driving every feature. Node `>=24`, `pnpm@10.8.1` (`frozen-lockfile`).

## Apps

- **`apps/api`** - NestJS 11 + Express + BullMQ + ioredis, against a real Redis. Wires `BymaxQueueModule.forRootAsync({ useFactory, inject })` from typed env; hosts the Orderly demo controllers (`/orders`, `/campaigns`, `/search`, `/flows`, `/schedulers`, `/workers`, `/admin/*`, `/events/stream`, `/errors/trigger/:code`, `/health/*`). The library ships no controllers.
- **`apps/web`** - Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn + TanStack Query. Reads the API; imports the library through the isomorphic `./shared` subpath **only** (`JOB_STATUS`, `QUEUE_ERROR_CODES`, `QueueMetrics`, re-exported types).

## Commands

```bash
pnpm install         # frozen lockfile; the library must be built first
pnpm typecheck       # tsc --noEmit, both apps
pnpm lint            # eslint . (flat, strictTypeChecked) + per-app lint
pnpm build           # nest build (api) + next build (web)
pnpm test:cov        # Jest (apps/api) + Vitest (apps/web), 100%
pnpm test:e2e        # api e2e vs real Redis, after unit
docker compose up -d # local redis:7-alpine
```

## Non-negotiable rules

1. **The library is external, always.** It resolves through its built `dist/` + `exports` map via `file:../../../nest-queue` (later `^0.1.0`). Never a `workspace:` member, never a `tsconfig` `paths` alias.
2. **`apps/web` imports `@bymax-one/nest-queue/shared` only** - never the `.` server root, which pulls in Nest/BullMQ/ioredis and breaks the browser bundle. `apps/web` declares none of the server peers; that absence is itself coverage proof.
3. **Peers live in `apps/api`**: `@nestjs/common`, `@nestjs/core`, `bullmq`, `ioredis`, `reflect-metadata` (each a single copy). `bullmq-otel` is optional, lazy behind `QUEUE_OTEL`.
4. **The Redis connection is a credential surface.** The connection URL, host, and password are never logged raw and never appear in a response; `GET /admin/diagnostics` reports the resolved mode and per-role retry policy with the secret masked.
5. **Stable error envelope.** Every error response is `{ error: { code, message, details } }` with a `QUEUE_ERROR_CODES` code and a safe message. No stack trace, connection string, or internal path leaks.
6. **Config is centralized.** All `process.env` access lives in `apps/api/src/config/`; a pure `buildQueueOptions(env)` factory is unit-tested on every branch. Only `.env.example` is committed.
7. **TypeScript strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`. **Zero `any`, zero suppression comments** (`@ts-ignore`, `@ts-expect-error`, `eslint-disable*`).
8. **Quality bar.** 100% coverage (statements/branches/functions/lines) both apps, Stryker `break 95` on `apps/api`, e2e over every documented flow vs real Redis. Suites run sequentially (`maxWorkers: '50%'`); never fan out parallel runners.
9. **Coverage-matrix discipline.** `docs/TECHNICAL_SPECIFICATION.md` section 7 is the completion contract (70 rows); a row counts as covered only with code + UI (where applicable) + a test.
10. **Conventional Commits**; English-only timeless comments (no planning-stage references in code or `.github`); `@fileoverview` + `@layer` per file, JSDoc on every export; booleans `is`/`has`/`should`/`can`; no `.gitkeep`, no em dashes.

## Design system

The shared design files (`app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`, `components/ui/*`) are **verbatim** from a sibling `nest-*-example`. Never re-style them; forced dark, brand orange `#ff6224`. Status = colour **+** icon **+** text, never colour alone.
