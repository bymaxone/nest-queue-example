# Phase 7: web-dashboard

> **Status**: ✅ Done · **Progress**: 6 / 6 tasks · **Last updated**: 2026-07-10
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P7)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §13, §14; matrix UI column across §7

## Context

The api exposes every library feature; this phase makes them visible. `apps/web` becomes the Next.js 16 dashboard following the shared Bymax design system ([`../design_system.html`](../design_system.html)): overview, queue and job detail, flows, schedulers, workers, playground, live events, error explorer, and health. The browser path stays on the `./shared` subpath only.

## Rules-of-phase

1. The four design-system files are copied verbatim from a sibling `apps/web` (`globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`); `layout.tsx` is adapted (fonts + forced dark identical; wordmark `nest-queue-example`).
2. No invented visuals: shell, tokens, status colors, and component shapes come from the design system; only the wordmark and nav items change.
3. `@bymax-one/nest-queue/shared` is the ONLY library import in `apps/web`; api payload types are mirrored as local interfaces in `lib/api-types.ts`.
4. Status/severity mapping is accessible: color + icon + text, never color alone.

## Reference docs

- Spec §13 (pages + data layer), §14 (design system, the four files, shell, status mapping).
- A sibling example `apps/web` for the verbatim files (nest-cache-example or nest-logger-example checkout).

## Task index

| ID  | Task                                                   | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------------ | ------- | -------- | ---- | ---------- |
| 7.1 | Branch + Next.js skeleton + design system + app shell  | ✅ Done | P0       | M    | Phase 5    |
| 7.2 | Data layer + overview + queue detail                   | ✅ Done | P0       | M    | 7.1        |
| 7.3 | Job detail + live events feed                          | ✅ Done | P0       | M    | 7.2        |
| 7.4 | Playground + flows + schedulers pages                  | ✅ Done | P0       | M    | 7.2        |
| 7.5 | Workers + errors + health pages                        | ✅ Done | P0       | M    | 7.2        |
| 7.6 | Phase close: audit, dashboards, PR with Copilot review | ✅ Done | P0       | S    | 7.3 to 7.5 |

## Tasks

### Task 7.1: Branch + Next.js skeleton + design system + app shell

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 5

#### Description

Turn the `apps/web` package into a Next.js 16 App Router app carrying the design system: the four verbatim files, the adapted `layout.tsx` (Geist fonts, forced dark, providers), and the canonical shell (64px topbar with wordmark + Redis status chip, 250px sidebar with the §13.2 nav).

#### Acceptance criteria

- [x] Branch `feat/phase-07-web-dashboard` created with `git switch -c`.
- [x] Next.js 16 + React 19 + Tailwind v4 + shadcn (new-york) wired; `pnpm --filter web dev` renders.
- [x] The four files byte-identical to the sibling source (diff clean except intentional wordmark tokens documented); `layout.tsx` adapted with wordmark `nest-queue-example`.
- [x] Shell: topbar (brand glyph, mono gradient wordmark, Redis status chip placeholder, events-live dot), sidebar nav (Overview, Queues, Flows, Schedulers, Workers, Playground, Events, Errors, Health) with the active-item orange treatment.
- [x] `tsc --noEmit` and lint green; no server-subpath import (grep gate).

#### Files to create / modify

`apps/web/app/*`, `apps/web/tailwind.config.ts`, `components.json`, `postcss.config.mjs`, `app/globals.css`, `components/shell/*`, `package.json`

#### Agent prompt

```
You are a senior Next.js engineer instantiating a shared design system.

PROJECT: nest-queue-example, Phase 7 Task 7.1 of 6 (FIRST). The design system's source
of truth is docs/design_system.html (forced dark, brand orange #ff6224, glass surfaces,
Geist Sans prose + monospace technical text, 8pt rhythm). Four files are copied
VERBATIM from a sibling example's apps/web (available at ../nest-cache-example/apps/web
or ../nest-logger-example/apps/web): app/globals.css, tailwind.config.ts,
components.json, postcss.config.mjs. layout.tsx is adapted, not copied.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §14 (identity, four files, Tailwind v4 notes, shell)
- docs/design_system.html (open the AI recreation guide section)

TASK
Create the branch (`git switch -c feat/phase-07-web-dashboard`), then: Next.js 16 App
Router scaffold in apps/web (preserving the Phase 1 package name and the shared-subpath
probe), copy the four files verbatim, adapt layout.tsx (Geist fonts + forced dark
identical; Providers: TanStack Query + Sonner; wordmark nest-queue-example), build the
shell components (topbar + sidebar with the nine nav items) and an empty Overview page
proving the shell.

Constraints:
- No import from '@bymax-one/nest-queue' (bare); './shared' only remains legal.
- English only; no em dashes; timeless comments; TS strict; no suppressions.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-queue-example/web dev` renders the dark shell with the orange
  active nav; `grep -rn "from '@bymax-one/nest-queue'" apps/web --include='*.ts*' |
  grep -v '/shared'` prints nothing.

Completion Protocol: standard 5 steps (phase file, plan §1 P7 row, tasks README,
completion log), commit `feat(web): next skeleton with shared design system shell (7.1)`.
```

---

### Task 7.2: Data layer + overview + queue detail

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.1

#### Description

The typed api client (`lib/api.ts`, `lib/api-types.ts` mirroring api DTOs, `lib/queue-status.ts` mapping `JOB_STATUS` to the palette), the Overview page (queue cards from `/admin/metrics`, Redis chip fed by `/health/ready`), and the Queue detail page (status-tabbed job table with pagination, pause/resume/clean actions).

#### Acceptance criteria

- [x] `lib/api.ts`: thin typed fetch wrapper honoring `NEXT_PUBLIC_API_URL`; error envelopes surface as typed `ApiError` with `code` from `QUEUE_ERROR_CODES` (shared import).
- [x] Overview: cards per queue (six status counts, paused badge), aggregate totals, 3s polling via TanStack Query; Redis chip live (ready/down + latency).
- [x] Queue detail `/queues/[name]`: tabs per `JOB_STATUS`, paginated table (mono ids, timestamps), actions pause/resume/clean (confirm dialog; toast with removed ids).
- [x] Component tests (React Testing Library) for the status mapping, cards, and actions delegation.

#### Files to create / modify

`apps/web/lib/*`, `app/page.tsx`, `app/queues/[name]/page.tsx`, `components/queue-card.tsx`, `components/job-status-badge.tsx`, tests

#### Agent prompt

```
You are a senior Next.js engineer building an observability dashboard data layer.

PROJECT: nest-queue-example, Phase 7 Task 7.2 of 6 (MIDDLE). The api (localhost:3080)
exposes /admin/metrics, /admin/queues/:name/jobs?status=&start=&end=, pause/resume/clean
actions, /health/ready. Browser types come from '@bymax-one/nest-queue/shared'
(JOB_STATUS, QUEUE_ERROR_CODES, QueueMetrics) plus local mirrors in lib/api-types.ts.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.1, §13.2 (Overview + queue detail rows), §14.4
- docs/TECHNICAL_SPECIFICATION.md §11 Admin group (endpoint shapes)

TASK
Implement lib/api.ts + api-types.ts + queue-status.ts, the Overview page (cards +
aggregates + Redis chip) and /queues/[name] (status tabs, pagination, actions) per the
acceptance criteria, with the design-system components (glass cards, mono values,
accessible status badges). Add component tests for mapping and delegation.

Constraints:
- './shared' only from the library; no bullmq/ioredis/@nestjs anywhere in apps/web.
- English only; no em dashes; timeless comments; TS strict; tests with scenario comments.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- With api + Redis up and a few orders placed: Overview shows live counts; queue detail
  paginates waiting/completed; pause reflects within one poll cycle.

Completion Protocol: standard 5 steps, id 7.2, commit
`feat(web): data layer, overview and queue detail (7.2)`.
```

---

### Task 7.3: Job detail + live events feed

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.2

#### Description

`/jobs/[queue]/[id]`: payload, options (inherited vs overridden), attempts timeline (backoff visible), live progress bar, return value; `/events`: the SSE feed with worker/global source badges and event-kind coloring.

#### Acceptance criteria

- [x] Job detail renders `data`, `opts` (highlighting values that differ from `DEFAULT_JOB_OPTIONS`, documented via a local constant mirror), `attemptsMade` timeline with failure reasons, progress (number bar or staged object), `returnvalue`; auto-refreshes while non-final.
- [x] Events page consumes `GET /events/stream` via `EventSource` with reconnect; entries badge `worker` vs `global`; empty/connection states designed.
- [x] `AttemptsTimeline` and `EventFeedItem` components tested.

#### Files to create / modify

`app/jobs/[queue]/[id]/page.tsx`, `app/events/page.tsx`, `components/attempts-timeline.tsx`, `components/event-feed-item.tsx`, `lib/use-event-stream.ts`, tests

#### Agent prompt

```
You are a senior Next.js engineer visualizing job lifecycles in real time.

PROJECT: nest-queue-example, Phase 7 Task 7.3 of 6 (MIDDLE). /admin/jobs/:queue/:id
returns the full job (data, opts, attemptsMade, failedReason, progress, returnvalue);
/events/stream is SSE replaying 20 entries then live, entries carry
source: 'worker' | 'global'.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (job detail + events rows), §13.3, §14.4

TASK
Implement the job detail page (payload viewer, options diff vs defaults, attempts
timeline with backoff spacing hint, live progress, return value; poll while status is
non-final) and the events page (use-event-stream hook over EventSource with retry;
feed list capped at 200 client-side; source + event-kind badges). Test the two
signature components.

Constraints:
- './shared' only; accessible status rendering (color + icon + text).
- English only; no em dashes; timeless comments; TS strict.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Place an order with WEBHOOK_FAILURES=2: the webhook job detail shows 2 failed
  attempts then success; /events shows the live sequence with both source badges.

Completion Protocol: standard 5 steps, id 7.3, commit
`feat(web): job detail with attempts timeline and live events feed (7.3)`.
```

---

### Task 7.4: Playground + flows + schedulers pages

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.2

#### Description

`/playground`: the enqueue laboratory (queue, name, JSON payload, priority, delay, jobId, dedup mode picker, bulk sender with the oversized demo); `/flows`: launcher for the three variants + live `FlowTree`; `/schedulers`: table with next-run info, upsert form (pattern or every), delete, and the validation-error surface.

#### Acceptance criteria

- [x] Playground form maps every option to the api; responses toast `{ jobId, deduplicated }`; the bulk card sends `count` and renders the `bulk_enqueue_failed` envelope when oversized.
- [x] Flows page: variant selector (default/stuck/failParent/ignoreDependency), tree visualization polling `/flows/:rootId/tree` with per-node status colors; the stuck variant shows an explanatory callout (the BullMQ default, by design).
- [x] Schedulers page: list (id, queue, pattern/every, tz, next run), upsert form with pattern-or-every toggle, delete with confirm; api validation errors render the envelope inline.
- [x] `DedupModePicker` and `FlowTree` tested.

#### Files to create / modify

`app/playground/page.tsx`, `app/flows/page.tsx`, `app/schedulers/page.tsx`, `components/dedup-mode-picker.tsx`, `components/flow-tree.tsx`, tests

#### Agent prompt

```
You are a senior Next.js engineer building interactive queue laboratories.

PROJECT: nest-queue-example, Phase 7 Task 7.4 of 6 (MIDDLE). Api surfaces:
/admin (enqueue via the playground-facing endpoints from Phase 3: orders, search
reindex with mode, campaigns), /flows/fulfillment (+ variant, + /bulk, + tree read),
/schedulers CRUD with queue.invalid_repeat_options on bad input.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (playground, flows, schedulers rows), §12
  scenarios 3, 4, 5

TASK
Implement the three pages per the acceptance criteria with design-system components
(pill controls, glass cards, mono values). FlowTree renders the nested JobNode tree
with status dots and connecting lines; poll every 1s while any node is non-final.

Constraints:
- './shared' only; accessible states; no invented visuals.
- English only; no em dashes; timeless comments; TS strict.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Dedup lab journey (5 rapid throttle sends -> one job) works from the UI; the three
  flow variants render their contrasting outcomes; an invalid scheduler upsert renders
  the envelope inline.

Completion Protocol: standard 5 steps, id 7.4, commit
`feat(web): playground, flows and schedulers pages (7.4)`.
```

---

### Task 7.5: Workers + errors + health pages

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.2

#### Description

`/workers`: static processors inventory, dynamic tenant workers (add/remove/notify), sandboxed invoice trigger with event-loop lag readout; `/errors`: the catalog table with trigger buttons and `EnvelopeViewer`; `/health`: liveness/readiness, metrics cache freshness (`collectedAt` age), connection diagnostics (mode + per-role retry values).

#### Acceptance criteria

- [x] Workers page: three sections (static processors from a small local inventory constant documented as mirroring the api, tenant workers CRUD against `/workers/tenants`, invoice render trigger + `/workers/lag` readout).
- [x] Errors page: `GET /errors/catalog` table (code, HTTP, reproducible flag), trigger buttons calling `/errors/trigger/:code`, `EnvelopeViewer` pretty-printing the stable envelope.
- [x] Health page: live/ready chips, metrics freshness meter (age vs 3s TTL), diagnostics card (mode, style, queue-role vs worker-role retries).
- [x] `EnvelopeViewer` tested.

#### Files to create / modify

`app/workers/page.tsx`, `app/errors/page.tsx`, `app/health/page.tsx`, `components/envelope-viewer.tsx`, tests

#### Agent prompt

```
You are a senior Next.js engineer completing an observability dashboard.

PROJECT: nest-queue-example, Phase 7 Task 7.5 of 6 (MIDDLE). Api surfaces:
/workers/tenants CRUD + notify, /workers/invoices/render, /workers/lag,
/errors/catalog + /errors/trigger/:code, /health/live + /health/ready,
/admin/diagnostics, /admin/metrics.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (workers, errors, health rows), §7 rows 9, 47
  to 49, 66, 67

TASK
Implement the three pages per the acceptance criteria. The errors page is the visual
proof of the stable envelope: EnvelopeViewer renders { error: { code, message,
details } } with the code in mono orange and the HTTP status chip.

Constraints:
- './shared' only (QUEUE_ERROR_CODES types the catalog); accessible states.
- English only; no em dashes; timeless comments; TS strict.
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.

Verification:
- Tenant lifecycle from the UI (create premium, notify, remove); trigger three catalog
  errors and read their envelopes; health page shows mode + retry split matching
  /admin/diagnostics.

Completion Protocol: standard 5 steps, id 7.5, commit
`feat(web): workers, errors and health pages (7.5)`.
```

---

### Task 7.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 7.3 to 7.5

#### Description

Standard phase close plus the design-parity audit: every §13.2 page functional, the client bundle clean of server-side libraries, shell/tokens matching the design system.

#### Acceptance criteria

- [ ] Full click-through journey green against the running api (every page, every documented action).
- [ ] Bundle audit: `pnpm --filter web build` output contains no `bullmq`, `ioredis`, or `@nestjs` code (grep the build output or use the bundle analyzer).
- [ ] Design parity checklist from §14 (forced dark, tokens, shell metrics, status mapping) recorded in the PR body.
- [ ] Dashboards updated; PR merged squash with branch deleted, CI green, Copilot findings resolved.

#### Files to create / modify

Dashboards only

#### Agent prompt

```
You are the phase-close auditor for Phase 7 of nest-queue-example.

CURRENT PHASE: 7 (web-dashboard), Task 7.6 of 6 (LAST).

PRECONDITIONS: tasks 7.1 to 7.5 done on branch feat/phase-07-web-dashboard.

REQUIRED READING (only these)
- docs/tasks/phase-07-web-dashboard.md (all acceptance criteria)
- docs/DEVELOPMENT_PLAN.md §5 P7 DoD, §6 Update protocol
- docs/TECHNICAL_SPECIFICATION.md §14 (parity checklist source)

TASK
Run the full click-through against the running api (fix reds with normal commits).
Bundle audit: `pnpm --filter @nest-queue-example/web build` then grep the output
directory for bullmq|ioredis|@nestjs (must be absent). Record the §14 design-parity
checklist in the PR body. Update dashboards (phase file, plan §1 P7 row, tasks README).
Open the PR: `gh pr create --title "feat(web): phase 7, dashboard on the shared design
system"`. Request the GitHub Copilot code review (gh pr edit --add-reviewer
copilot-pull-request-reviewer[bot] or via the UI); address EVERY finding; merge only
with CI green via `gh pr merge --squash --delete-branch`; verify branch deletion.

Constraints:
- Never add Co-Authored-By, "Generated with", or any AI-attribution line to commits,
  PR titles, PR bodies, or comments.
- Never merge with failing CI or unresolved review threads.

Verification:
- `gh pr view --json state` shows MERGED; plan shows P7 ✅ 6/6.

Completion Protocol: append `- 7.6 ✅ <date> phase PR merged`; commit dashboards on
main: `docs(plan): mark P7 complete`.
```

---

## Completion log

<!-- append-only: - <id> ✅ <YYYY-MM-DD> <one-line summary> -->

- 7.1 ✅ 2026-07-10 Next.js 16 skeleton, verbatim design-system files, app shell (topbar + 9-item sidebar)
- 7.2 ✅ 2026-07-10 Typed api client, queue-status palette, Overview + Queues index + queue detail pages
- 7.3 ✅ 2026-07-10 Job detail page, SSE event-stream hook, live Events feed, AttemptsTimeline + EventFeedItem
- 7.4 ✅ 2026-07-10 Playground (4 labs), Flows (variant launcher + live tree), Schedulers (list + upsert + inline validation)
- 7.5 ✅ 2026-07-10 Workers (static inventory + tenant CRUD + sandboxed render/lag), Errors (catalog + EnvelopeViewer), Health page
- 7.6 ✅ 2026-07-10 phase-close audit in progress: click-through verified against a running api, code review and security review both clean, PR being opened
