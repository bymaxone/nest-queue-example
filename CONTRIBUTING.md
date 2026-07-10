# Contributing to nest-queue-example

Thanks for your interest. This repository is the canonical reference application for
`@bymax-one/nest-queue`, so contributions are judged by how well they demonstrate the library, not by
generic code churn.

## Reporting security issues

Please do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md) for the private
disclosure process (`support@bymax.one`).

## The bar for a change

> _"Does this make the demonstration of `@bymax-one/nest-queue` clearer or more complete?"_

Changes that clarify a library feature, add a missing demonstration, fix a bug, or improve the docs are
welcome. Generic refactors that obscure how the library is wired will be declined.

## Prerequisites

- Node.js >= 24 and pnpm 10 (`corepack enable`).
- Docker (Docker Compose v2) for the local Redis stack and the e2e suite.

## Getting started

```bash
# Clone + build the sibling library first (consumed pre-publish via file:, must be built before install)
git clone https://github.com/bymaxone/nest-queue.git ../nest-queue
cd ../nest-queue && pnpm install && pnpm build
cd ../nest-queue-example

# Install the workspace (resolves the file: link)
pnpm install

# Bring up Redis
docker compose up -d
```

## Verification, run before every PR

Run the suites one at a time (never unit and e2e concurrently, never fan out parallel test runners):

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm --filter @nest-queue-example/api test:cov   # 100% on all four metrics
pnpm --filter @nest-queue-example/web test:cov   # 100% on all four metrics
pnpm --filter @nest-queue-example/api test:e2e   # real Redis, sequential, after unit
```

The mutation gate (Stryker on `apps/api`, `break 95`) is a local pre-release gate, not a per-PR CI job:
`pnpm --filter @nest-queue-example/api mutation`. See
[docs/mutation_testing_results.md](docs/mutation_testing_results.md).

## Commits, Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`,
enforced locally by commitlint. Use the scopes in `.gitmessage`. Do not add any AI-attribution or
`Co-Authored-By` trailer.

## Pull requests

- Keep the working tree at 100% coverage on both apps; every `it()` carries a scenario comment.
- No suppression comments (`@ts-ignore`, `eslint-disable`, `istanbul ignore`); remove dead branches instead.
- The library stays external: never a `workspace:` dependency, never a `tsconfig` `paths` alias; `apps/web`
  imports the `./shared` subpath only.
- Never log or return the Redis URL, host, or password; keep them out of every response, log line, and SSE
  frame.
- English only; no em dashes in code or docs.
- CI must be green (lint, typecheck, format, build, unit, e2e).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
