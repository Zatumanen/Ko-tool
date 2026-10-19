# My EP Selected-Pad Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the owner chooses delegated execution. Implement task-by-task with the checks below.

**Status (2026-10-20, Europe/Moscow):** Owner approved the design, implementation plan and delegated execution in chat. Tasks 1–4 are implemented/reviewed; Task 5 browser/evidence regressions and focused checks are complete. Task 6 cumulative verification and release remain pending. Production physical pad writes remain evidence-denied.

**Goal:** Edit the explicitly chosen hardware pad's PITCH / PLAY MODE / TIME MODE, synchronize hardware changes back into My EP, and preserve unrelated settings and recovery guarantees.

**Architecture:** Add a pad-specific metadata service and recovery record behind the existing FILE scheduler/runtime. A separate UI controller selects and edits the pad; sample-library defaults keep their own controller. The exact-firmware pad capability controls mutation independently of sample and archive permissions.

**Tech Stack:** Existing static HTML/CSS/ES modules, IndexedDB, Node.js 22 tests and Chromium Playwright; no production dependency.

**Spec:** [Owner-approved design](../specs/2026-10-19-my-ep-pad-properties-design.md), approved in chat 2026-10-19. Continue [PR139](https://github.com/Zatumanen/Ko-tool/pull/139), branch `fix/sample-properties-device-sync`, base `d01ce5e`.

## Global Constraints

- Projects and pad controls require a connected, recognized and authorized EP; no offline project editor.
- SAMPLE LIBRARY and PAD PARAMETERS are distinct targets. Do not change assignment or other pads implicitly.
- Unknown/unsupported firmware is read-only; existing sample/archive evidence is not pad-write evidence.
- Preserve session, FILE serialization, strict debug guard, authoritative readback and persistent recovery.
- A continuous value gesture sends its final value on release. Saved-project AUTO remains opt-in and is not the live refresh mechanism.
- Never calculate pad FID solely from slot/numbering assumptions; resolve LIST/INFO and verify the assigned sample.
- Preserve all unrelated pad values. Missing payload evidence or an incomplete snapshot refuses mutation.
- Physical acceptance is separate from synthetic tests; the deferred broad ZAT-9 matrix stays deferred.

## Review Focus

- One sample is assigned to several pads: an edit changes exactly the chosen target.
- Hardware changes a protected field between selection and apply: refuse stale overwrite.
- A queued gesture outlives reconnect or target replacement: send no stale write.
- ACK succeeds but the device ignores an edit or resets another field: report failure and retain recovery evidence.
- Reload finds a pending write or unreadable recovery DB: fail closed until authoritative recovery verification.

---

## File and interface map

- `js/ep133/padMetadata.js`: permission checks, discovery, normalization and payload/verification contract.
- `js/ep133/padRecovery.js`: pad-specific JSON snapshots and persistent records, with hashed identity.
- `js/ep133/padMetadataRuntime.js`: strict serialized pad mutation, journal phases, verify/restore/acknowledge.
- `js/ep133/ui/padPropertiesController.js`: target chooser, draft/confirmed state, event refresh and gesture lifecycle.
- Existing `deviceCompatibilityMatrix.js`, `evidenceRegistry.js`, `deviceCapabilities.js`, `filesystem.js`, `index.js` and `deviceRecoveryRuntimeBridge.js`: capability/service/recovery registration.
- Existing `samplePropertiesController.js`, `createEpWorkspace.js`, `devicePadSelectionController.js`, `domRegistry.js`, `index.html`, `css/my-ep.css`: explicit chooser entry and workspace-owned UI.
- Existing backup/recovery dialog plus a small `ui/padRecoveryController.js`: inspect and resolve pad records separately from `/sounds` records.
- Focused Node tests and `tests/e2e/my-ep-pad-properties.spec.mjs`, using an extended synthetic fake-EP tree.

## Task 1: Pad capability and payload contract

**Files:** create `js/ep133/padMetadata.js`, `tests/pad-metadata.test.mjs`; modify the compatibility/evidence facades and their existing tests.

**Interfaces:**
- `getPadMetadataAvailability(deviceInfo) -> {read,write,reason,evidence}`.
- `normalizePadMetadata(metadata,{profile}) -> normalizedMetadata`; unsupported numeric enums remain a refusal unless their mapping is source-backed.
- `preparePadMetadataPayload(before,changes,{profile}) -> payload`; only the three requested families and their evidenced companion fields may change.
- `verifyPadMetadata(before,payload,readback) -> verificationReport`; compare intended and preserved fields.

- [ ] Write failing tests for exact-firmware permission isolation, unknown SKU/version, unsupported enum, missing companion field, complete-snapshot preservation and ignored/clobbered readback. Example invariant: `assert.equal(payload['envelope.release'], before['envelope.release'])` when changing only pitch; `assert.throws(() => preparePadMetadataPayload(incomplete, changes, {profile}))`.
- [ ] Run `node --test tests/pad-metadata.test.mjs tests/device-compatibility-matrix.test.mjs`; observe the missing contract failures.
- [ ] Add capability `project.pad-metadata` for every known SKU, initially unverified. Keep existing records intact. Pin the relevant public protocol-source commit and record which claims are documentation versus captured behavior. Add write-enabled evidence only from an actual model/firmware-scoped artifact and acceptance; no synthetic upgrade.
- [ ] Implement the pure contracts with explicit field allowlists from the evidence. A documented warning about partial writes requires preserving the complete supported pad snapshot, not inventing defaults. Until this is established, mutation stays disabled.
- [ ] Rerun the focused tests and inspect all capability-record counts; commit the capability/contract change.

## Task 2: Authoritative target discovery and session-safe reads

**Files:** extend `padMetadata.js`; create `tests/pad-targets.test.mjs`.

**Interfaces:**
- `listPadTargets(fileOps,{project,group,sampleSlot}) -> {projects,groups,pads}` using lease-bound reads.
- `readPadTarget(fileOps,{project,group,pad,sampleSlot}) -> {target,metadata,fingerprint}`.
- `target = {project,group,pad,projectFid,groupFid,padFid,sampleSlot}`; every FID comes from device nodes, not arithmetic.

- [ ] Write failing tests for reused samples on two pads, unexpected numbering, missing/readonly nodes, changed assignment, `sym:0`, invalid parent chain and disconnected session.
- [ ] Run `node --test tests/pad-targets.test.mjs`; observe the missing discovery/read behavior.
- [ ] Walk `/projects`, the selected project's groups and pad children; verify INFO parent/name/capabilities and readable metadata. Refuse ambiguous assignment or incomplete target identity. Do not use stale saved-archive values as live metadata.
- [ ] Rerun discovery tests; commit this read-only service.

## Task 3: Pad-specific transaction and persistent recovery

**Files:** create `padRecovery.js`, `padMetadataRuntime.js`, `tests/pad-recovery.test.mjs`, `tests/pad-metadata-runtime.test.mjs`; modify `filesystem.js`, `index.js`, `deviceRecoveryRuntimeBridge.js` and related recovery tests.

**Interfaces:**
- `createPadRecoveryStore({indexedDBRef}) -> {persistent,save,update,get,list,delete}`; records contain `id,device,target,before,desired,status,phase,verification` and no raw serial.
- `createPadMetadataRuntime({withFileTransaction,getConnectedDeviceInfo,getDeviceSessionToken,recoveryStore,onRecoveryEvent}) -> {apply,verify,restore,acknowledge,listRecords}`.
- `apply({target,before,changes,sessionToken}) -> {metadata,recordId,verification}`.
- `verify(recordId) -> report` is read-only; `restore(recordId,{confirmed:true})` is a fresh guarded mutation; `acknowledge(recordId)` re-verifies current state before clearing its blocker.
- The filesystem facade exports `getPadMetadataAvailability`, `listPadMetadataTargets`, `readPadMetadataTarget`, `applyPadMetadata`, `listPadRecoveryRecords`, `verifyPadRecoveryRecord`, `restorePadRecoveryRecord` and `acknowledgePadRecoveryRecord`. The workspace injects these existing-style services into the UI controller.

- [ ] Write failing tests for a pad FID greater than 999, persistent restart, storage failure, stale protected fields, session change before dispatch, ACK without actual change, unrelated-field reset and ambiguous timeout after dispatch. Assert that no automatic second SET occurs.
- [ ] Run `node --test tests/pad-recovery.test.mjs tests/pad-metadata-runtime.test.mjs` and relevant `tests/device-runtime-*recovery*.test.mjs`; observe failures before implementation.
- [ ] Implement a separate pad record store. Save the pre-write snapshot durably before mutation; missing persistence fails closed. Retain unresolved records across reload; prune only resolved history.
- [ ] Implement PRECHECK → MUTATE → VERIFY phases under one strict FILE lease. Recheck device/token/target/snapshot before SET, then verify the edited and preserved fields with GET. An ambiguous mutation becomes recovery-required. Avoid the sample-slot journal and whole-project upload paths. A restore while an unresolved blocker exists is refused: first verify and explicitly acknowledge the current authoritative state, then restore as a new journaled transaction referencing the original record. Test that a failed restore reestablishes its own blocker; do not temporarily disable runtime safety.
- [ ] Extend runtime recovery hydration with optional `listPadTransactions` and pad-source events without changing existing sample/project records. An unresolved pad record must block ordinary mutations after reconnect.
- [ ] Rerun focused recovery tests; commit the runtime/recovery change.

## Task 4: Explicit pad editor and hardware-event synchronization

**Files:** create `ui/padPropertiesController.js`, `ui/padRecoveryController.js`, `tests/pad-properties-controller.test.mjs`; modify the workspace, DOM registry, sample properties entry, device pad selection hook, HTML and CSS.

**Interfaces:**
- `createPadPropertiesController({dom,getAvailability,readTargets,readTarget,applyPadMetadata,captureSession,assertSession,reportError}) -> {openFromSample,close,handleFileEvent,handleActivePad,reset,dispose}`. The workspace supplies one FILE event subscription and forwards events; the controller does not subscribe a second time.
- `openFromSample(slot,{confirmedLibraryMetadata})` opens a read-only chooser first.
- `createPadRecoveryController({dom,listRecords,verify,restore,acknowledge,confirmAction,reportError}) -> {refresh,reset,dispose}`.

- [ ] Write failing controller tests: choosing a target performs no write, applying copies only displayed confirmed values, a library sample reused elsewhere changes one pad, a target switch cannot redirect queued work, events cannot overwrite a pending draft, and close/reset releases every listener/timer.
- [ ] Run `node --test tests/pad-properties-controller.test.mjs`; observe missing UI state behavior.
- [ ] Add an `EDIT ASSIGNED PAD` entry to the sample menu. Show project/group/pad, current assignment and permission reason. `APPLY TO THIS PAD` is an explicit operation; library controls retain their own target.
- [ ] Render pad-confirmed values using existing property helpers, tracking desired values outside the canonical device state. Add saving/error/readback status and a release-only continuous gesture. Keep selector controls stable while responses arrive.
- [ ] Add an optional `onActivePad` callback to `devicePadSelectionController` after its existing session-guarded read. Follow hardware selection only without pending work; refresh selected-pad metadata from matching events with target/version/token guards. Do not enable or accelerate project polling.
- [ ] Add the pad-recovery section to the existing recovery dialog, with original/current/desired values, read-only verification and separately confirmed restore. Exempt the owned pad dialog from outside-My-EP deselection.
- [ ] Rerun controller tests and existing sample/UI tests; commit the UI integration.

## Task 5: Browser workflow and evidence boundaries

**Files:** extend `tests/e2e/fake-ep-browser.js`; create `tests/e2e/my-ep-pad-properties.spec.mjs`; update `docs/TESTING.md`, `docs/REFERENCE_SOURCES.md`, the approved spec status and compact `docs/PROJECT_STATE.md`.

- [x] Extend the fake node tree with two project/group/pad targets sharing one sample, complete pad metadata and a source of hardware selection/metadata events. Add controlled ignored/clobbered SET and disconnect hooks. Keep all fixture provenance explicitly synthetic.
- [x] Add E2E cases for explicit selection/apply, each requested property family, the unchanged second pad/library, release-only gesture, hardware-to-UI refresh, readonly firmware, stale target, ambiguous failure, persistent recovery and reconnect without replay.
- [x] Run `npm run test:e2e -- tests/e2e/my-ep-pad-properties.spec.mjs`; record actual initial fixture/workflow failures. Tasks 1–4 already implement the UI; do not break production to manufacture RED.
- [x] Complete the browser integration until these assertions pass. For writable synthetic scenarios instantiate the real controller/workspace with injected test services, following the existing `createEpWorkspace({services})` boundary. Run production-capability denial tests through the normal app entry. A simulated writable profile must not alter the production registry or introduce a production bypass; only actual accepted evidence can enable the normal app's physical write path.
- [x] Document the actual evidence source and current hardware limits. Retain any owner-supplied raw reference/capture outside Git; check provenance/license before importing permitted derivatives. Commit this regression/documentation change.

## Task 6: Final review, PR checks and release handoff

- [ ] Run the full Node suite, `npm run build:pages` and the full Chromium suite. In this cloud checkout use the established Chromium override and bounded Node concurrency when needed; record local failures separately from CI.
- [ ] Ask the existing independent reviewer to examine only the new pad capability/runtime/UI and cumulative integration. Fix important findings with observed failing regressions; avoid duplicate whole-branch reviews.
- [ ] Update PR139 title/body around the final implementation and its remaining physical acceptance. Preserve the single-PR scope requested by the owner.
- [ ] Verify final-head Actions job results and actual test counts, including retries/flaky cases, and confirm the PR's expected head before merge.
- [ ] Merge only when the requested behavior is implemented and permitted evidence is in place. Check the main tests and Pages publication. Provide the owner the exact release commit and a focused expendable-pad physical-check procedure. Do not mark ZAT-49 or broad ZAT-9 Done from fake-EP/CI alone.

## Handoff and prerequisite

The owner approved this plan and chose delegated execution in the existing isolated checkout. One final independent review and cumulative verification remain required before the authorized release steps; do not repeat the approval interview.

The supplied archives contain no Best Friend executable or raw pad-operation trace. Task 1 must establish operation evidence before enabling physical writes. Read-only discovery, UI, payload contracts and recovery tests can be implemented independently; unsupported production operations remain read-only. This dependency must be reported rather than replaced by a broader sample/archive permission.
