# nest-queue-example

Reference implementation of [`@bymax-one/nest-queue`](https://github.com/bymaxone/nest-queue), a
NestJS 11 wrapper over BullMQ. This repository is a pnpm workspace with two applications:

- `apps/api`: a NestJS 11 backend that wires the library end to end (module registration,
  producers, workers, flows, schedulers, metrics, error handling) against a real Redis instance.
- `apps/web`: a Next.js 16 dashboard that observes and drives the API, consuming the library's
  `./shared` subpath only.

The library is always consumed as an external package, resolved through its built `dist/` and
`exports` map, never as a workspace member and never through a `tsconfig` path alias.

See [`docs/TECHNICAL_SPECIFICATION.md`](./docs/TECHNICAL_SPECIFICATION.md) for the full
architecture, feature coverage matrix, and design decisions, and
[`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) for the phased build plan.

## Requirements

- Node.js >= 24
- pnpm >= 10 (`packageManager` is pinned in `package.json`)
- Docker (for the local Redis stack)

## Getting started

```bash
pnpm install
pnpm lint
pnpm typecheck
```

`apps/` is populated starting in the library-consumption phase; a clean checkout of this
repository at the repo-foundation stage contains only the workspace tooling and CI.

## Local infra

Redis is the only external service this example needs.

```bash
docker compose up -d
docker compose exec redis redis-cli ping   # expect: PONG
```

Copy `.env.example` to `.env` and adjust as needed. Applications load configuration through
Node's native `--env-file` flag; there is no `dotenv` dependency anywhere in this repository.

```bash
node --env-file=.env dist/main.js
```

Tear the stack down with `docker compose down` (add `-v` to also drop the Redis volume).
