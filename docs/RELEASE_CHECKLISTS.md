# Release checklists

Two externally-gated actions remain before this repository has a clean public debut. Each is a
ready-to-run, command-exact checklist; neither is blocked by the other. Run them in either order once the
external precondition holds.

- **NPM switch** flips the library dependency from the local `file:` link to the published semver range.
  Precondition: `@bymax-one/nest-queue` is published to npm.
- **Public flip** makes the repository public and activates the public-only CI workflows.
  Precondition: the maintainers decide to publish the repository.

---

## 1. NPM switch (file link to `^0.1.0`)

Today both apps consume the library through a local `file:` link to the sibling `../nest-queue` checkout
(resolved via its built `dist/` + `exports`). When the library publishes to npm, switch to the semver
range in a single dedicated PR.

Precondition, verify the library is on npm:

```bash
npm view @bymax-one/nest-queue version   # must print a version (currently fails: not yet published)
```

Steps:

```bash
git switch -c chore/consume-published-nest-queue

# 1) Point both apps at the published range (replace ^0.1.0 with the published minor).
#    apps/api/package.json  -> "@bymax-one/nest-queue": "^0.1.0"
#    apps/web/package.json   -> "@bymax-one/nest-queue": "^0.1.0"

# 2) Reinstall so the lockfile resolves the registry package instead of the file: link.
pnpm install

# 3) Run the full local pipeline, one suite at a time.
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm --filter @nest-queue-example/api test:cov
pnpm --filter @nest-queue-example/web test:cov
docker compose up -d
pnpm --filter @nest-queue-example/api test:e2e
pnpm --filter @nest-queue-example/api mutation

# 4) Open the PR.
git commit -am "chore(repo): consume published nest-queue"
gh pr create --title "chore(repo): consume published nest-queue" \
  --body "Switch the library dependency from the local file: link to ^0.1.0 now that @bymax-one/nest-queue is on npm. Full local pipeline green."
```

Verification:

- `grep -rn '"@bymax-one/nest-queue"' apps/*/package.json` shows `^0.1.0` in both apps, no `file:` link.
- The CI setup composite (`.github/actions/setup`) still clones and builds the sibling library for CI, so
  it keeps working during the transition; once the registry package is trusted, that composite may be
  simplified in a follow-up (out of scope for the switch PR).
- No `paths` alias and no `workspace:` membership is introduced (the library stays an external package).

---

## 2. Public flip (private to public)

The repository is written public-grade from day one. CodeQL and OpenSSF Scorecard ship from the first PR
but are guarded with `if: ${{ !github.event.repository.private }}`, so they report as skipped while the
repository is private and activate automatically on the flip, with zero workflow edits.

Steps:

```bash
# 1) Flip visibility.
gh repo edit bymaxone/nest-queue-example --visibility public --accept-visibility-change-consequences

# 2) Trigger a run so the newly-eligible workflows execute (push a no-op commit or re-run CI on main).
gh workflow run ci.yml --repo bymaxone/nest-queue-example

# 3) Confirm the public-only workflows now activate instead of skipping.
gh run list --repo bymaxone/nest-queue-example --workflow codeql.yml --limit 1
gh run list --repo bymaxone/nest-queue-example --workflow scorecard.yml --limit 1
```

Verification:

- The `CodeQL` and `Scorecard` workflows show a real run (not "skipped") on the first post-flip event.
- The README CI badge resolves against the now-public Actions endpoint.
- Add dashboard screenshots to the README (the placeholders noted in the Quick start section).
- Re-check the public-grade audit once more: no secret, no internal reference, no local absolute path in any
  shipped file.

Do not attempt to "fix" the CodeQL or Scorecard workflows while the repository is private; a skipped
conditional workflow is the intended, passing state.
