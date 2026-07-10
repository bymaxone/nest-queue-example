# nest-queue-example

Reference implementation of [`@bymax-one/nest-queue`](https://github.com/bymaxone/nest-queue), a
NestJS 11 wrapper over BullMQ. This repository is a pnpm workspace that builds out two
applications across the phased plan; they land in later phases, not at this repo-foundation stage:

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
Each application documents its own start command as it lands in a later phase.

Tear the stack down with `docker compose down` (add `-v` to also drop the Redis volume).

## Connection modes

The library accepts the Redis connection three ways, selected by two environment variables.
`GET /admin/diagnostics` is the single source of truth for the active mode and proves the
per-role retry policy: the Queue/FlowProducer role keeps ioredis' default `maxRetriesPerRequest`
(20, fail-fast so `enqueue` never blocks during an outage) while Worker/QueueEvents roles are
forced to `null` (required for BullMQ's blocking commands). The connection URL, host, and
password are a credential surface and never appear in any response.

| Recipe                                                                | Resolved mode  | `connection` in `/admin/diagnostics`                                        |
| --------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| _default_ (`QUEUE_CONNECTION_MODE=own`, `QUEUE_CONNECTION_STYLE=url`) | `mode-b-owned` | `style: "url"`, `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null`     |
| `QUEUE_CONNECTION_STYLE=options`                                      | `mode-b-owned` | `style: "options"`, `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null` |
| `QUEUE_CONNECTION_MODE=shared`                                        | `mode-a-byo`   | `queueRoleMaxRetries: 20`, `workerRoleMaxRetries: null`                     |

In Mode A (`shared`) the app owns an ioredis client and hands it to the library as `{ client }`
(the shape a `@bymax-one/nest-cache` host would produce); the library uses it as-is for the
Queue role and never closes it, so the app closes it on shutdown. Modes B (`url`/`options`) let
the library open and close its own connection.

```bash
pnpm --filter @nest-queue-example/api build
QUEUE_CONNECTION_MODE=shared node apps/api/dist/main.js &   # or QUEUE_CONNECTION_STYLE=options
curl -s http://localhost:3080/admin/diagnostics
```

## Operational journeys

These reproduce two at-least-once behaviors the library handles. Both need a running Redis
and the built API (`pnpm --filter @nest-queue-example/api build`). Set `REDIS_URL` if your
Redis is not on `localhost:6379`.

### Stalled-job recovery

A `demos` job sleeps far longer than its deliberately short `lockDuration` (5s). A live
worker renews the lock and the job completes normally; if the worker is killed mid-job, the
lock expires and the restarted worker detects the stalled job and re-runs it.

```bash
# Terminal 1: start the API and watch the event stream
node apps/api/dist/main.js &
curl -N http://localhost:3080/events/stream

# Terminal 2: enqueue the slow job, then kill the API mid-job (before ~20s)
curl -X POST http://localhost:3080/demos/stall
kill <api-pid>            # plain process kill; no Docker needed

# Restart the API; within ~10s the stream shows the demos job: stalled, active, completed
node apps/api/dist/main.js
```

The feed entries for the `demos` queue show the recovery timeline (`active` then `stalled`
then `completed`) as the restarted worker picks the job back up.

### Graceful shutdown

`scripts/demo-shutdown.mjs` boots the built API, enqueues a slow report job, sends `SIGTERM`
mid-job, and asserts the process drains the in-flight work and exits cleanly within the drain
budget.

```bash
pnpm --filter @nest-queue-example/api build
node scripts/demo-shutdown.mjs        # prints PASS on a clean drained shutdown
```

The script exits non-zero on failure, so it can gate a pipeline. Override `DEMO_PORT`,
`REDIS_URL`, or `QUEUE_PREFIX` via environment variables.
