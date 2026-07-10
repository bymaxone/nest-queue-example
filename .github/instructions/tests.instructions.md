---
applyTo: '**/*.spec.ts,**/*.test.ts,**/*.test.tsx,**/*.e2e-spec.ts'
---

# Testing standards

## Gates

- **Coverage 100%** (statements/branches/functions/lines), enforced by `coverageThreshold`: Jest for `apps/api` (ESM via `NODE_OPTIONS=--experimental-vm-modules` + `ts-jest`, `tsconfig.spec.json` with decorator metadata off), Vitest + v8 for `apps/web`. `maxWorkers: '50%'` is baked into both configs - run one suite at a time, never fan out parallel test runners (the locally linked library is duplicated across workers and can exhaust memory).
- **Mutation: Stryker `break 95, high 99, low 95`** on `apps/api`, a pre-release gate (not per PR). Write mutation-aware assertions now.
- Unit and e2e **never run concurrently**; e2e runs strictly after unit.

## Structure & naming

```
describe('ClassName')
  describe('#method()')              // '.' for a static method
    it('should <outcome> when <condition>')
```

Every `it` states the behaviour - never `it('works')`. Add a block comment to each test: the scenario + the rule it protects. Test through the public/exported API only.

## Mutation-aware patterns (kill Stryker mutants)

1. Assert the **value**, not existence: `expect(job.attemptsMade).toBe(3)`, not `toBeDefined()`.
2. Cover **both sides** of every `||` / `&&` and every connection-mode / dedup-mode branch.
3. Assert the error **path AND code** independently: check the `QUEUE_ERROR_CODES` key in the envelope, not just a 4xx status.
4. Cover the **acceptance** path of every predicate (the retry policy that stays `20`, the branch that keeps a value), not only rejection.

## NestJS (apps/api)

- **Unit specs** (`*.spec.ts`, co-located under `src/`) construct classes directly - no Nest DI container, no Redis. Cover every branch of `buildQueueOptions`, the services, the event listeners, and the error mapping.
- **E2E** (`*.e2e-spec.ts`, under `test/`) use a real `NestFactory.create` + `supertest` against a **real Redis** (unique container name and port, torn down after). Assert the exception-filter mapping (`QueueException` -> HTTP status + `QUEUE_ERROR_CODES` code), the masked connection in `/admin/diagnostics`, and that **no Redis URL, host, or password** appears in any response or log. Cover the `forRoot` (sync) path, duplicate-processor guard, scheduler idempotency, and the bounded-drain shutdown.

## Frontend (apps/web, Vitest)

- Render leaf components; assert loading / empty / error states and the colour **+** icon **+** text status mapping. Mock the API client; assert the localized copy for each `QUEUE_ERROR_CODES` key. Restore all mocks in `afterEach` - never leak module-level mocks across files. The `./shared` subpath resolves without the server peers; keep it that way.
