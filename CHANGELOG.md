# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Reference implementation of `@bymax-one/nest-queue`: a pnpm workspace with a NestJS 11 API
  (`apps/api`) and a Next.js 16 dashboard (`apps/web`) exercising the full public API across both
  the `.` and `./shared` subpaths.
- Orderly demo domain: typed enqueue, all four deduplication modes, bulk enqueue with the size guard,
  inspection and control admin API, cached metrics, health composition, and the stable error envelope.
- Workers and events: every worker knob, both event decorators, progress, retries with backoff, the
  stalled-recovery demo, and the Server-Sent Events feed.
- Flows and schedulers: fan-out/fan-in flows with the three failure-propagation variants, boot-time
  scheduler registration, dynamic per-tenant workers, and the sandboxed invoice processor.
- Connection modes: Mode B (`url` / `options`, library-owned) and Mode A (`client`, app-owned ioredis)
  with the per-role retry policy surfaced in diagnostics.
- Quality bar: 100% unit coverage on both apps, e2e over every documented flow against real Redis, and
  a Stryker mutation gate on `apps/api`.
- Governance: TypeScript strict base, ESLint flat config, Prettier, husky + commitlint + lint-staged,
  MIT license, day-one CI workflows, and the GitHub Copilot code-review configuration.
