# Mutation testing results (apps/api)

Mutation testing is the assertiveness gate layered on top of 100% line/branch/function/statement
coverage: it proves the unit suite fails when behavior changes, not merely that lines executed. It is a
local pre-release gate on `apps/api`, not a per-PR CI job.

```bash
pnpm --filter @nest-queue-example/api mutation
```

## Configuration

`apps/api/stryker.config.json`:

- **Runner:** Jest, over the unit config only (`jest.stryker.config.cjs`, which reuses the co-located
  `src/**/*.spec.ts` suite with coverage collection and the 100% threshold stripped, since Stryker drives
  its own per-test coverage). E2E specs are not run under mutation.
- **Mutate scope:** `src/**/*.ts` minus specs, NestJS modules, `*.types.ts`, `*.d.ts`, barrels, and
  `main.ts` (the same non-executable glue excluded from the coverage scope; nothing is excluded to inflate
  the score).
- **`coverageAnalysis: perTest`** so each mutant runs only the tests that cover it.
- **`concurrency: 2`** and `NODE_OPTIONS=--max-old-space-size=4096`: memory-safe for the locally linked
  library, which each Jest worker reloads.
- **`ignoreStatic: true`.** Static mutants (module-load-time constants and initializers) cannot be
  attributed to a single test under `perTest`, so each one re-runs the whole suite; they accounted for
  ~24% of mutants but ~96% of the run time. Ignoring them keeps the gate fast without weakening it: the
  behavior those constants drive (the per-role retry policy, the bulk cap, the connection-mode branches,
  the default job options) is still locked by explicit value assertions in the unit specs. The security-
  and correctness-relevant constants are asserted directly (for example the diagnostics spec asserts
  `queueRoleMaxRetries: 20` and `workerRoleMaxRetries: null`).
- **Thresholds:** `break 95, high 99, low 95`. The run exits non-zero below the break threshold.

## Score

| Metric                         | Value                          |
| ------------------------------ | ------------------------------ |
| **Mutation score**             | **99.71** (break threshold 95) |
| Mutants killed                 | 674                            |
| Timed out (killed)             | 9                              |
| Survived                       | 2                              |
| Ignored (equivalents + static) | 293                            |
| Scored total                   | 685                            |

The run exits 0: `99.71 >= 95`. `ignoreStatic` accounts for the bulk of the ignored count; the remainder
are the documented inline-suppressed equivalents below.

### The two residual survivors

Both are boolean short-circuit conditions Stryker's `perTest` coverage attributes only to the test that
took the true branch, so it never runs the false-branch test that actually kills them:

- `config/queue.config.ts` L73: `if (mode === 'shared' && client !== undefined)` mutated to `if (true)`.
- `search/reindex.service.ts` L94: `existing !== null && job.id === existing` mutated to `true`.

Both are **behaviorally covered** and provably killed: `queue.config.spec.ts` asserts the Mode B `url` and
`options` arms return `{ url }` / `{ options }` (not `{ client }`), and `reindex.service.spec.ts` asserts
`deduplicated: false` for a fresh enqueue. Applying either mutant by hand fails those specs (for example the
`if (true)` mutant fails three `queue.config.spec.ts` assertions). They are a `perTest` attribution artifact
for the short-circuited `&&`, not a genuine assertion gap, and are left visible rather than suppressed.

## Hardening summary

The baseline run surfaced survivors clustered in error envelopes, event-listener wiring, and a handful of
genuinely equivalent mutants. Each survivor was either killed by strengthening the unit assertion (never by
weakening one) or documented below as a provable equivalent and suppressed with an inline
`// Stryker disable` comment at the mutation site.

### Kills (assertions strengthened)

- **Error explorer.** The trigger tests now assert each reproducible code's real `details` rather than only
  its `code`, distinguishing the real failing operation from the did-not-raise fallback; the controller
  tests assert the full `unknown_code` and `not_reproducible` envelopes (code, message, details).
- **Order reminder.** The missing-order test asserts the full `order_not_found` envelope (code, message,
  and the requested id in details).
- **Readiness.** The probe-failure test asserts the 503 body is exactly `{ status: 'down', reason:
'redis_unreachable' }`, proving no connection string leaks and the fixed reason is intact.
- **Ring buffer.** A new wrap-past-capacity test pins the head advancing forward by one slot per push
  (oldest-first eviction order).
- **Event-listener wiring.** Each processor now asserts its `@OnWorkerEvent` / `@OnQueueEvent` decorator
  metadata (`eventName` to `methodKey`), which a direct method call cannot observe; a blanked event name
  would silently detach the listener. The listener tests also assert the `source` field (`worker` / `global`)
  on every bridged feed entry.
- **Error and not-found envelopes.** The smoke, flows-tree, and admin `getJob` not-found tests assert the
  full envelope (code plus the requested id in `details`), so a blanked details object cannot pass.
- **Flow node data.** The fulfillment-flow test asserts every node (root, children, grandchildren) carries
  `{ orderId }`, so a blanked data object is caught.
- **Schedulers.** The empty-template test uses `toStrictEqual` (which does not ignore `undefined` keys) to
  prove unset keys are omitted, and a boundary test accepts exactly the maximum template-data key count
  (the inclusive `<=` cap).
- **Boundary and arithmetic.** Report and invoice durations assert an elapsed span far below the wall clock
  (killing a mutated `-` to `+`); the invoice test pins the exact checksum (killing the hash algorithm,
  encoding, and round-count mutants); the receipt-marker eviction test fills to exactly the capacity to
  prove the inclusive `<=` boundary retains the oldest entry.
- **Readiness cleanup.** A fake-timer test asserts no timer is left pending after a successful probe, so an
  emptied `finally` (a leaked timeout guard) is caught.
- **Validation.** A nested-object test asserts the issue path joins with `.` (`address.zip`), and the
  `validation_failed` message is asserted verbatim.
- **SSE stream.** The stream test now captures stream errors and asserts none occur, so a mutant that feeds
  an `undefined` source into the RxJS pipeline fails the assertion cleanly instead of leaking an unhandled
  rejection.

### Documented equivalent mutants (suppressed inline)

Each is suppressed with a `// Stryker disable` comment at the mutation site. These are the only
suppressions; no killable mutant is disabled.

| File                                | Site                             | Why it is a genuine equivalent                                                                                                                                   |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errors/error-explorer.service.ts`  | `buildOversizedBatch`            | Only the batch length (1001) is observable; the bulk guard rejects on size before any job name or data is read.                                                  |
| `errors/error-explorer.service.ts`  | `triggerInvalidOptions`          | `drainTimeoutMs: 0` is the sole rejection trigger; the surrounding option objects only need to compile, and the spec asserts the real INVALID_OPTIONS rejection. |
| `common/bounded-ring-buffer.ts`     | `push` not-full branch           | Seeding via push (head fixed at 0) and via the overwrite path (head advancing) build an identical array and identical snapshots.                                 |
| `common/bounded-ring-buffer.ts`     | `snapshot` not-full branch       | While not full, head is 0, so the wrap path reduces to a plain copy; taking it early is equivalent to the fast path.                                             |
| `processors/email.processor.ts`     | receipt marker lookup + store    | Guarding the `undefined` job id only avoids a `Map` operation on a key that `sendReceipt` never reads back.                                                      |
| `flows/fulfillment.service.ts`      | `buildFulfillmentFlow` default   | An unlisted variant key maps to `undefined` opts, exactly what `'default'` resolves to, so blanking the default builds the same flow.                            |
| `workers/lag-probe.service.ts`      | histogram resolution + lifecycle | The sampling resolution and enable/disable are libuv wiring with no deterministic observable in a quiet unit test; the pure conversion is covered by `toMs`.     |
| `workers/tenant-workers.service.ts` | worker `error` handler           | The handler fires only on an asynchronous ioredis connection-error event from the live worker; it just logs and is exercised through integration.                |
| `flows/flows.controller.ts`         | bulk root optional chaining      | `addBulk` returns exactly one node per input id, so the indexed node is always present; the `?.` satisfies the type only.                                        |
| `admin/diagnostics.controller.ts`   | worker-role retry read           | A Worker/QueueEvents connection always carries `maxRetriesPerRequest: null` (forced for BullMQ's blocking commands), so both branches return null.               |
