# K.O. TOOL — controlled release and Pages runbook

<!-- RELEASE_EVIDENCE_START -->
**K.O. TOOL 1.0 · NO-GO**

| Checkpoint | SHA |
| --- | --- |
| SOURCE_SHA | `e9b0f72cb35a8685c0ca426e82e20e5199c2e2c2` |
| TESTED_SHA | `e9b0f72cb35a8685c0ca426e82e20e5199c2e2c2` |
| MERGED_SHA | `e9b0f72cb35a8685c0ca426e82e20e5199c2e2c2` |
| PUBLISHED_SHA | `d8c193a41069b4b053b242b9b6d35c1a688641c8` |
| LIVE_SHA | `d8c193a41069b4b053b242b9b6d35c1a688641c8` |

Pages evidence · MATCH.

[Checked CI](https://github.com/Zatumanen/Ko-tool/actions/runs/45678785986) · [Merged source](https://github.com/Zatumanen/Ko-tool/pull/214) · [Manual Pages run](https://github.com/Zatumanen/Ko-tool/actions/runs/44301681855) · [Public version observed 2026-11-25](https://zatumanen.github.io/Ko-tool/build-version.json)
<!-- RELEASE_EVIDENCE_END -->

**Policy:** K.O. TOOL may publish independently completed, explicitly approved intermediate updates. Merge is **not** permission to publish; 1.0 requires all six stages and all agreed acceptance. No physical FILE/HIL permissions follow from this runbook.

**Hosting:** Use the public [K.O. TOOL GitHub Pages site](https://zatumanen.github.io/Ko-tool/) for owner-requested browser builds, including builds for manual testing. Publish through the approved `deploy-pages` workflow on `main`. Private and separately hosted copies are outside the release process. If a candidate cannot use the approved public workflow yet, report what is blocking it.

The generated checkpoint above comes from [release evidence](release-evidence.json).
The [validation guide](testing/release-evidence.md) covers updates, exceptions and
operation-specific acceptance. Physical evidence and permission to publish are
recorded separately from successful software checks.

## Observed infrastructure (14 November 2026)

- [Actual Pages deployment #43586790943](https://github.com/Zatumanen/Ko-tool/actions/runs/43586790943) on `main@7e89fdd` was GitHub-managed `dynamic/pages/pages-build-deployment` **Jekyll build from the branch**, not `scripts/build-pages.mjs`/`dist`. It started at the same time as post-merge [tests #43586791491](https://github.com/Zatumanen/Ko-tool/actions/runs/43586791491), without waiting for their result.
- [Manual workflow](../.github/workflows/deploy-pages.yml) has `workflow_dispatch` only; **its trigger does not stop** branch-sourced Pages. [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) distinguishes the two sources.
- On 2026-11-15 the owner **confirmed switching Pages Source to GitHub Actions**. [Merge CI #43707438664](https://github.com/Zatumanen/Ko-tool/actions/runs/43707438664) completed on PR #166 / `main@49bd79f` without a new automatic Jekyll deployment. Repository admin settings cannot be read independently through the available connector; this is owner confirmation plus GitHub Actions observation, not an API-attested setting.

## Pages source and release gate

- The owner completed **Settings → Pages → Build and deployment → Source: GitHub Actions** on 2026-11-15. This resolved the previously observed automatic Jekyll publication path for PR #166.
- Before relying on this setting after an unexpected deployment or permissions change, verify the selector at [repository Settings → Pages](https://github.com/Zatumanen/Ko-tool/settings/pages). Check branch rulesets and the `github-pages` environment reviewer requirements in Settings; those controls are **not independently verified** via the connector.
- The checked-in `deploy-pages.yml` remains **manual-only**. Changing Source to GitHub Actions does **not** dispatch it automatically. The first complete manual production deployment **has been tested successfully** by explicit `workflow_dispatch` (this proves the workflow ran, not acceptance of K.O. TOOL 1.0); latest independently checked run is [#44301681855](https://github.com/Zatumanen/Ko-tool/actions/runs/44301681855) on 2026-11-18 `d8c193a41069b4b053b242b9b6d35c1a688641c8` (both `verify` and `deploy` PASS). Future deployment of a newer SHA still requires a separate explicit owner release decision and fresh verification.
- If Source reverts to branch publishing, **STOP** merges under the manual-release policy until the intended source and current publication behavior are confirmed.

## PR and release candidate

1. Verify current `main`, `AGENTS.md`, Linear task, diff and permissions. Obtain owner authorization for each Git/code/merge/deploy action. Never edit `main` directly.
2. CI on the **exact PR head SHA**: `npm ci` from committed lockfile, Node tests, preflight, `npm run build:pages`, `npm run verify:pages`, source Chromium fake-EP E2E and **dist Chromium smoke at /Ko-tool/**. Failures and skipped checks must be reported, not waived.
3. Check device-sensitive changes separately against [TESTING](TESTING.md) and firmware-scoped evidence. No physical EP write without separate scenario authorization, backups and readback. Successful fake-EP E2E does not unlock hardware or approve 1.0.
4. Obtain separate explicit permission to merge, **after** Pages Source is confirmed GitHub Actions. Merge only after all required PR checks succeed. Wait for post-merge `main` CI on the merge SHA; compare exactly with the intended release SHA.

## Publish only after separate approval

1. In GitHub **Actions → deploy-pages → Run workflow**, select `main`. Record its exact `github.sha` and owner release approval.
2. The `verify` job uses locked npm dependencies, all Node/Chromium suites, builds versioned `dist`, checks it, and uploads it as `verified-pages-dist`.
3. The `deploy` job downloads the **same tested artifact**, verifies `build-version.json` against the dispatched SHA and publishes exactly that `dist` to Pages; it does **not** rebuild from source.
4. After the run reports successful deployment, check live [build-version.json](https://zatumanen.github.io/Ko-tool/build-version.json) matches the intended release SHA and inspect the website in Chrome (HTTP, JS/CSS/WASM and basic functionality).
5. Any mismatch, unexpected auto-deploy, denied permission, red CI or artifact difference means **STOP**; do not call the site released. Log run IDs, exact SHA and relevant failure in Linear. Recovery/rollback or switching Sources requires an explicit authorized plan.

## Build contract

- `package-lock.json` locks `@playwright/test` 1.65.0 and transitive packages; use `npm ci --no-audit --no-fund`, Node 22.
- `npm run build:pages` copies only `index.html`, `js/`, `css/` into `dist/`, plus `build-version.json`; it stamps local JS/CSS links with the chosen SHA. Do not assume Jekyll applies this transformation.
- `npm run verify:pages` rejects wrong/missing versions, incomplete assets and leaked source-only directories.
- `npm run test:pages:e2e` opens the **built** bundle under `/Ko-tool/` and checks browser errors and same-origin JS/CSS versions. Existing `npm run test:e2e` still exercises fake-EP behavior from the source tree.
- The owner-confirmed GitHub Actions source is separate from CI triggers; only an authorized `workflow_dispatch` publishes a tested artifact. The latest verified manual deployment run is [#44301681855](https://github.com/Zatumanen/Ko-tool/actions/runs/44301681855), not the current reviewed `main@b6c9ad4`. The current live Pages `build-version.json` was **not** independently rechecked in the 21-Nov documentation audit.

**Evidence and status:** [PROJECT_STATE](PROJECT_STATE.md) is a dated source snapshot; [Linear](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca) is the live tracker. Never report GitHub Pages source changes, production rollout, physical HIL, or release 1.0 without separate verified evidence.
