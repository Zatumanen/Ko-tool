# Parallel PR and shared-file integration protocol

**Owner-approved process (18 November 2026).** This is a workflow and testing
gate, not authority to modify application code, merge, publish Pages or perform
physical EP operations. Apply it with [AGENTS](../AGENTS.md),
[pre-implementation gate](IMPLEMENTATION_GATE.md),
[TESTING](TESTING.md) and the [PR template](../.github/pull_request_template.md).

## Why the gate exists

Independent PRs #188–#193 all started from the same main SHA and edited
`js/visuals/app.js`, while #189–#192 also edited `js/visuals/audio.js`.
All six had green CI, but only the combined PR #194 verified their shared
lifecycle. Initial #194 browser CI had one **test-selector** error:
`[data-xy-mode]` selected both a control and a Canvas; it was corrected to
`select[data-xy-mode]` with the original red run preserved. After correction,
the exact integrated SHA `fa14ae1c6234b7a6ebbfa5d448b458387d23e9ef`
passed [CI #44265135676](https://github.com/Zatumanen/Ko-tool/actions/runs/44265135676).
Merged `main@ab5706e425c20e06ede35012053d5b211846d53c` passed
[post-merge CI #44267219851](https://github.com/Zatumanen/Ko-tool/actions/runs/44267219851):
1055 Node, 161 source Chromium, two versioned Pages smoke tests. None of
this is owner visual approval, host endurance or physical HIL.

## Before writing or opening a PR

1. Confirm **explicit scope authorization**, current main commit, branch,
   working-tree cleanliness, applicable requirements and existing code.
   Source-first review is mandatory; do not reimplement already-working code
   when the only gap is hardware or owner acceptance.
2. Enumerate **live open PRs** and their base/head commits and changed paths.
   Compare against the intended diff. Mark shared files and shared lifecycle
   even if paths differ. Keep paused Draft PRs separate and never assume
   draft code is shipped.
3. Choose **serial or stacked PRs** rather than independent branches from an
   old main for related work. A stacked PR must name the current parent SHA
   and retarget/retest as its predecessor changes. If multiple already exist,
   create one authorized isolated integration PR, resolve conflicts once,
   and preserve each feature's assertions and documentation.
4. In `## Concurrent PRs and integration`, record checked main SHA/date,
   overlapping PR numbers and paths, decision (no overlap / stacked /
   integrated / BLOCKED), and links to **combined** test evidence. A claim
   of no overlap needs an actual open-PR comparison. The structural CI
   checks that the declaration is present, **not that it is true**.

## Required shared-lifecycle acceptance

- For Visuals, use a single **explicitly selected** browser input and verify
  cross-module XY/Plasma, LUFS M/S/I+Reset, L/R Peak/Hold/CLIP+Reset, Recorder
  16/24-bit Start/Pause/Resume/Stop/Save/Discard, and adaptive Canvas
  cadence/visibility. Keep continuous AudioWorklets independent of paint.
  Confirm mono/stereo/unknown format, unexpected channel-count changes even
  while Canvas is hidden, device/source loss, stale epoch messages, error
  cleanup, and recorder verified-prefix behavior.
- Existing smoke: `tests/e2e/visuals-integration.spec.mjs`. For each new
  cross-module failure mode add one **focused RED→GREEN** regression, not
  a duplicated full suite. This smoke does not cover every condition above.
  Compare feature tests before changing their semantics.
- Locate browser controls with precise selectors confined to component,
  such as `select[data-xy-mode]`; Canvas `data-*` values are assertions,
  not necessarily unique control locators.
- Avoid wide application refactors merely because multiple PRs conflict.
  If extracting shared app/audio controllers becomes necessary, define the
  exact bug or complexity risk and obtain authorization for that separate
  scope.

## Before and after merge

1. Run focused checks, then the full prescribed **exact integrated-head**
   Node, Chromium source E2E, Pages build/verify/dist E2E and preflight.
   A green check on each isolated branch is **not** an integration PASS.
2. Inspect all failures, do not weaken tests, and preserve red run/trace
   provenance. After **any** app/test/CI change, require a new complete
   exact-head CI run. No partial/old SHA PASS.
3. Inspect required branch rules, PR status, review threads and main base
   freshness. Merge only with owner authorization after all checks pass,
   then **wait for post-merge main CI** on the resulting commit.
4. When a merged integration PR supersedes older PRs, verify their features
   exist on main and record their lineage. Close obsolete PRs only with
   applicable authorization and a link to the integrated commit; **never
   merge them again**. Do not confuse merge with Pages deployment.
5. Report evidence separately: **CODE/CI**, **BROWSER synthetic**,
   **REAL EP HIL**, **OWNER VISUAL**, **HOST ENDURANCE**, **BLOCKED**.
   Keep Linear acceptance honest; do not call a feature release-ready if
   physical/performance/visual criteria remain open.
