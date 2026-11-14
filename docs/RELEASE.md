# K.O. TOOL — controlled release and Pages runbook

**Policy:** K.O. TOOL may publish independently completed, explicitly approved intermediate updates. Merge is **not** permission to publish; 1.0 requires all six stages and all agreed acceptance. No physical FILE/HIL permissions follow from this runbook.

## Observed infrastructure (14 November 2026)

- [Actual Pages deployment #43586790943](https://github.com/Zatumanen/Ko-tool/actions/runs/43586790943) on `main@7e89fdd` was GitHub-managed `dynamic/pages/pages-build-deployment` **Jekyll build from the branch**, not `scripts/build-pages.mjs`/`dist`. It started at the same time as post-merge [tests #43586791491](https://github.com/Zatumanen/Ko-tool/actions/runs/43586791491), without waiting for their result.
- [Manual workflow](../.github/workflows/deploy-pages.yml) has `workflow_dispatch` only; **its trigger does not stop** branch-sourced Pages. [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) distinguishes the two sources.
- The GitHub connector does **not** expose repository administrative Pages source changes. The source has **NOT** been changed by this code patch. Until an admin completes the change, merging to `main` can auto-publish immediately. Do not merge under the manual-release policy.

## One-time administrator setting (required before controlled merge)

1. Open [repository Settings → Pages](https://github.com/Zatumanen/Ko-tool/settings/pages) with repository admin/maintainer access.
2. Under **Build and deployment → Source**, select **GitHub Actions**, not **Deploy from a branch**; save.
3. Confirm the selector displays **GitHub Actions**. Inspect the `github-pages` environment deployment restrictions/reviewer rules, and protected branch checks where available. These settings are not verified through the current connector.
4. Record dated evidence that the source is switched. No blind release or probe commit to test this setting.

This repository's own `deploy-pages.yml` remains **manual only**. Choosing Source=GitHub Actions does not automatically trigger it; the workflow must be intentionally dispatched. A GitHub environment reviewer, if configured, adds a separate authorization gate.

## PR and release candidate

1. Verify current `main`, `AGENTS.md`, Linear task, diff and permissions. Obtain owner authorization for each Git/code/merge/deploy action. Never edit `main` directly.
2. CI on the **exact PR head SHA**: `npm ci` from committed lockfile, Node tests, preflight, `npm run build:pages`, `npm run verify:pages`, source Chromium fake-EP E2E and **dist Chromium smoke at /Ko-tool/**. Failures and skipped checks must be reported, not waived.
3. Check device-sensitive changes separately against [TESTING](TESTING.md) and firmware-scoped evidence. No physical EP write without separate scenario authorization, backups and readback. Successful fake-EP E2E does not unlock hardware or approve 1.0.
4. Obtain separate explicit permission to merge, **after** Pages Source is confirmed GitHub Actions. Merge only after all required PR checks succeed. Wait for post-merge `main` CI on the merge SHA; compare exactly with the intended release SHA.

## Publish only after separate approval

1. In GitHub **Actions → deploy-pages → Run workflow**, select `main`. Record its exact `github.sha` and owner release approval.
2. The `verify` job uses locked npm dependencies, all Node/Chromium suites, builds versioned `dist`, checks it, and uploads it as `verified-pages-dist`.
3. The `deploy` job downloads the **same tested artifact**, verifies `build-version.json` against the dispatched SHA and publishes exactly that `dist` to Pages; it does **not** rebuild from source.
4. After the run reports successful deployment, check live [build-version.json](https://zatumanen.github.io/Ko-tool/build-version.json) matches the intended release SHA and inspect the website in Chrome (HTTP, JS/CSS/WASM and basic functionality). This live check has not yet been performed.
5. Any mismatch, unexpected auto-deploy, denied permission, red CI or artifact difference means **STOP**; do not call the site released. Log run IDs, exact SHA and relevant failure in Linear. Recovery/rollback or switching Sources requires an explicit authorized plan.

## Build contract

- `package-lock.json` locks `@playwright/test` and transitive packages; use `npm ci --no-audit --no-fund`, Node 22.
- `npm run build:pages` copies only `index.html`, `js/`, `css/` into `dist/`, plus `build-version.json`; it stamps local JS/CSS links with the chosen SHA. Do not assume Jekyll applies this transformation.
- `npm run verify:pages` rejects wrong/missing versions, incomplete assets and leaked source-only directories.
- `npm run test:pages:e2e` opens the **built** bundle under `/Ko-tool/` and checks browser errors and same-origin JS/CSS versions. Existing `npm run test:e2e` still exercises fake-EP behavior from the source tree.
- The current deployment source is independent of these CI commands **until the admin switch** above.

**Evidence and status:** [PROJECT_STATE](PROJECT_STATE.md) is a dated source snapshot; [Linear](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca) is the live tracker. Never report GitHub Pages source changes, production rollout, physical HIL, or release 1.0 without separate verified evidence.
