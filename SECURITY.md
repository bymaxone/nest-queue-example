# Security Policy

`nest-queue-example` is the public reference application for `@bymax-one/nest-queue`. It handles one
sensitive surface that must never leak: the Redis connection (its URL, host, and password are
credentials). We triage security reports ahead of feature work.

## Supported versions

This repository tracks one library minor at a time (see [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)).
Security fixes land on the tip of the default branch; there are no long-lived release branches to
back-port to.

| Branch / version       | Status                          |
| ---------------------- | ------------------------------- |
| `main` (current minor) | Active, receives security fixes |
| Older tags / forks     | Best effort only                |

A vulnerability in the **library itself** (`@bymax-one/nest-queue`) should be reported against
[its repository](https://github.com/bymaxone/nest-queue), not here. Report it here only if it is
reproducible through this example's own demo code.

## Reporting a vulnerability

**Do not report security issues through public GitHub Issues, Discussions, or pull requests.** Public
reports give attackers a window between disclosure and fix.

Email **support@bymax.one** with `[security] nest-queue-example` in the subject line. If you prefer, you
may instead open a GitHub
[private security advisory](https://github.com/bymaxone/nest-queue-example/security/advisories/new).

### What to include

- A clear description of the vulnerability and its impact.
- Step-by-step reproduction against the default branch.
- The affected surface (an API route, the dashboard, the build/CI, a dependency).
- A suggested fix or mitigation, if you have one.
- Whether you would like to be credited (and how).

## Scope notes

- **The Redis connection is a credential surface.** A report that the connection URL, host, or password
  appears in a log line, an error body, an SSE frame, or an unmasked `/admin/diagnostics` field is in
  scope.
- **No authentication by design.** The demo API is unauthenticated on purpose (queue behavior is the
  focus); a "missing auth" report on the demo endpoints is not a finding. A route that leaks a secret or
  an internal path regardless of auth is a finding.
- **In-memory demo domain.** The Orderly domain uses in-memory repositories and inert sample payloads;
  there is no database and no real user data.
- **Local dev defaults.** The local stack runs a `redis:7-alpine` container bound to the loopback
  interface with no password; those are demo values, not a finding.

We aim to acknowledge a report within a few business days and to keep you updated through resolution.
