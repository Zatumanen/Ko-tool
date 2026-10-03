# SpeedUpperCut T1 Safety Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one authoritative runtime state machine decide whether FILE operations are admissible, then consolidate protocol/capability ownership and reduce EP composition-layer safety logic without changing user-visible behavior.

**Architecture:** Use a strangler migration. Add a pure `deviceRuntimeState` reducer plus a shared runtime instance, feed it connection/ownership/operation/recovery events, and keep current APIs as conservative compatibility adapters until equivalence is proven. Follow with a protocol/capability facade that removes wire interpretation from feature/UI code, then trim the EP composition root so it wires services instead of making safety decisions.

**Tech Stack:** Browser ES modules, Web MIDI/SysEx, Web Locks/BroadcastChannel, Node `node:test`, Playwright 1.55, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-03-device-runtime-state-design.md`

## Global Constraints

- T1 does not redesign UI/UX.
- T1 does not add new EP write features.
- T1 does not change the FILE/SysEx wire protocol.
- T1 does not replace persisted recovery journals.
- T1 does not remove Web Locks/BroadcastChannel ownership.
- T1 does not migrate the entire application to TypeScript.
- T1 does not perform the HIL/golden-capture work planned for T2.
- Ambiguity fails closed.
- Stale events cannot mutate a new session.
- Unresolved recovery blocks further FILE work, including unresolved persisted recovery discovered after page reload.
- Unknown firmware/capability behavior is not inferred optimistically.
- Operation safety cannot be overridden from presentation code.
- Existing more-conservative behavior wins whenever legacy and runtime state disagree during migration.
- `unsafe` is terminal for the current browser runtime; clearing it requires the existing power-cycle + reload/fresh-runtime path, not a normal reconnect.
- No legacy test expectation may be weakened simply to accommodate the refactor.

## Review Focus

1. **Ownership loss during an active mutation:** do not abort an already-dispatched stream in a way that creates a worse device state; block subsequent operations and preserve the stricter safety outcome until the in-flight lease resolves or becomes ambiguous. Covered in Task 4.
2. **Late/out-of-order events from a prior connection epoch:** ignore/reject them without changing the current snapshot. Covered in Task 2.
3. **Duplicate operation completion or wrong operation id:** reject deterministically and keep the active lease unchanged. Covered in Task 2.
4. **Persisted unresolved recovery after reload:** a newly connected device must not become FILE-ready until sample/project recovery records for that device are scanned; relevant unresolved records keep runtime `recovery-required`. Covered in Task 6.
5. **Unknown SKU/firmware or capability evidence outside its verified range:** keep write authority disabled and do not reinterpret raw capability bits in feature/UI code. Covered in Tasks 8–9.

---

# PR 1 — ZAT-5: Authoritative Device Runtime State

## File map

- Create `js/ep133/deviceRuntimeState.js` — pure state/event reducer, admission checks, epoch/operation guards, immutable snapshots.
- Create `js/ep133/deviceRuntime.js` — shared runtime instance and small public facade; no WebMIDI or DOM code.
- Create `tests/device-runtime-state.test.mjs` — transition/admission/stale-event tests.
- Modify `js/ep133/errors.js` — add runtime-specific structured error codes.
- Modify `js/ep133/device.js` — publish connection, disconnect, debug/unsafe events while retaining legacy APIs.
- Modify `js/ep133/deviceOperationCoordinator.js` — delegate admission/phase state to runtime while preserving lease API.
- Modify `js/ep133/fileTransport.js` — use runtime-backed coordinator and conservative compatibility checks.
- Modify `js/ep133/ui/connectionLifecycle.js` — translate cross-tab ownership state into runtime events; keep `deviceSessionOwnership.js` core-agnostic.
- Modify `js/ep133/sampleTransactionRuntime.js`, `js/ep133/projectFilesystem.js`, and `js/ep133/filesystem.js` — publish current and persisted recovery state into runtime.
- Extend existing coordinator/session/recovery tests without removing current safety assertions.

### Task 1: Pure runtime snapshot and admission contract

**Files:**
- Create: `js/ep133/deviceRuntimeState.js`
- Modify: `js/ep133/errors.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes `createEpError`, `EP_ERROR_CATEGORY`, `EP_ERROR_CODE`.
- Produces constants with exact values:
  - `DEVICE_RUNTIME_CONNECTION = {DISCONNECTED:'disconnected', CONNECTING:'connecting', CONNECTED:'connected'}`
  - `DEVICE_RUNTIME_OWNERSHIP = {NONE:'none', OWNED:'owned', BLOCKED:'blocked'}`
  - `DEVICE_RUNTIME_OPERATION = {IDLE:'idle', READING:'reading', MUTATING:'mutating', VERIFYING:'verifying'}`
  - `DEVICE_RUNTIME_SAFETY = {SAFE:'safe', BLOCKED:'blocked', RECOVERY_REQUIRED:'recovery-required', UNSAFE:'unsafe'}`
- Produces `createDeviceRuntimeState({now=()=>Date.now()}={})` returning `getSnapshot()`, `subscribe(listener)`, `dispatch(event)`, `assertCanStartFileOperation({mode='read'}={})`, `captureEpoch()`, `assertEpoch(epoch)`.

- [ ] **Step 1: Write failing initial-state/status tests.** Assert initial disconnected/idle/safe state. Assert `ready` requires connected + verified identity + owned + idle + safe + recovery hydration complete. Connected with ownership `none|blocked` or recovery hydration incomplete derives `blocked`, never `ready`.
- [ ] **Step 2: Run `node --test tests/device-runtime-state.test.mjs`.** Expected FAIL because module does not exist.
- [ ] **Step 3: Add `DEVICE_RUNTIME_INVALID_TRANSITION`, `DEVICE_RUNTIME_OPERATION_BLOCKED`, `DEVICE_RUNTIME_STALE_EPOCH`, `DEVICE_RUNTIME_STALE_OPERATION` to `EP_ERROR_CODE`.** Use runtime category for stale/invalid events and safety category for admission denial.
- [ ] **Step 4: Implement immutable initial state.** Connection epoch `0`, device `null`; ownership `none`; operation `idle`; safety `safe`; recovery `{hydrated:false,transaction:null}`; no external interference.
- [ ] **Step 5: Implement subscription and status priority:** `unsafe > recovery-required > blocked > connecting > verifying > mutating > reading > ready > disconnected`.
- [ ] **Step 6: Implement admission.** Reads/mutations require connected, verified identity, owned session, idle operation, safe safety and `recovery.hydrated===true`.
- [ ] **Step 7: Run focused test.** Expected PASS.
- [ ] **Step 8: Commit:** `feat: add authoritative EP runtime state model`.

### Task 2: Epoch-bound operation and safety events

**Files:**
- Modify: `js/ep133/deviceRuntimeState.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Adds event shapes: `OWNERSHIP_ACQUIRED`, `OWNERSHIP_LOST`, `OWNERSHIP_BLOCKED`, `CONNECT_STARTED`, `DEVICE_CONNECTED`, `DEVICE_DISCONNECTED`, `FILE_OPERATION_STARTED`, `FILE_OPERATION_VERIFYING`, `FILE_OPERATION_FINISHED`, `FILE_OPERATION_FAILED`, `DEVICE_MARKED_UNSAFE`, `FIRMWARE_DEBUG_DETECTED`, `UNEXPECTED_FILE_TRAFFIC`, `RECOVERY_SCAN_STARTED`, `RECOVERY_SCAN_COMPLETED`, `RECOVERY_REQUIRED`, `RECOVERY_VERIFIED`, `RECOVERY_ACKNOWLEDGED`.
- Device/operation events carry exact `connectionEpoch`; operation events also carry exact `operationId`.

- [ ] **Step 1: Add failing transition tests.** Cover connect→ready after recovery scan, read→ready, mutation→verifying→ready, second operation rejection, wrong operation id, stale epoch, `effect:'none'|'possible'|'session-ambiguous'`, debug→unsafe, unexpected FILE idle→blocked, unexpected FILE active→unsafe, and ordinary events unable to clear unsafe.
- [ ] **Step 2: Run focused test.** Expected new tests FAIL.
- [ ] **Step 3: Implement monotonic epoch/stale-event guards.** Stale events fail with structured stale code and never mutate current snapshot.
- [ ] **Step 4: Implement operation lifecycle.** Read starts `reading`; mutation starts `mutating`; only matching operation enters `verifying` or finishes/fails.
- [ ] **Step 5: Implement fail-closed classifications.** `none` may return safe/idle; `possible` sets recovery-required; `session-ambiguous`, active interference or firmware debug sets unsafe. Disconnect invalidates active operation but does not clear unsafe.
- [ ] **Step 6: Implement recovery scan/events.** `RECOVERY_SCAN_STARTED` sets hydration false; completed with no relevant unresolved record sets hydration true; required sets safety recovery-required and hydration true; only matching verified/acknowledged resolution may clear the matching recovery blocker.
- [ ] **Step 7: Run focused test.** Expected PASS.
- [ ] **Step 8: Commit:** `feat: enforce epoch-bound EP operation transitions`.

### Task 3: Shared runtime instance and `device.js` shadow publication

**Files:**
- Create: `js/ep133/deviceRuntime.js`
- Modify: `js/ep133/device.js`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- `deviceRuntime.js` exports `deviceRuntime`, `getDeviceRuntimeSnapshot()`, `onDeviceRuntimeChange(listener)`, `dispatchDeviceRuntimeEvent(event)`.
- Existing `device.js` APIs remain: `isConnected()`, `isDeviceUnsafe()`, `getDeviceSessionToken()`, `onConnectionChange()`.

- [ ] **Step 1: Add failing shared-runtime/device publication contract tests.** Keep all legacy exports.
- [ ] **Step 2: Run `node --test tests/device-runtime-state.test.mjs tests/ep133.test.mjs`.** Expected FAIL.
- [ ] **Step 3: Implement singleton facade with dependency only on `deviceRuntimeState.js`.** No device/transport/UI/DOM/recovery imports.
- [ ] **Step 4: Publish physical lifecycle from `device.js`.** Runtime summary includes SKU, firmware, device key and `identityVerified:true`, but no raw serial fields.
- [ ] **Step 5: Publish `enterUnsafeState()` and firmware debug paths while retaining legacy unsafe state.** Stricter legacy/runtime result governs.
- [ ] **Step 6: Run `npm test`.** Expected PASS.
- [ ] **Step 7: Commit:** `refactor: mirror device lifecycle into runtime state`.

### Task 4: Runtime-backed FILE coordinator and ownership bridge

**Files:**
- Modify: `js/ep133/deviceOperationCoordinator.js`
- Modify: `js/ep133/fileTransport.js`
- Modify: `js/ep133/ui/connectionLifecycle.js`
- Modify: `tests/device-operation-coordinator.test.mjs`
- Modify: `tests/device-session-ownership.test.mjs`
- Modify: `tests/ep133.test.mjs`

**Interfaces:**
- `createDeviceOperationCoordinator({runtime,markUnsafe,isUnsafe,now,nextOperationId,onStateChange})` keeps `begin`, `run`, `reset`, `observeUnexpectedFileTraffic`, `getState`, `assertAvailable`.
- Runtime dependency exposes `getSnapshot`, `dispatch`, `assertCanStartFileOperation`, `captureEpoch`.
- `createConnectionLifecycle({...})` gains `publishRuntimeEvent=()=>{}`; composition passes `dispatchDeviceRuntimeEvent`.

- [ ] **Step 1: Add failing coordinator delegation tests.** `begin()` performs runtime admission + start event; verifying/close use matching operation id.
- [ ] **Step 2: Add failing ownership tests.** Acquire→acquired, blocked→blocked, release/loss→lost. Loss during active mutation blocks subsequent admission but does not forcibly cut the already-dispatched stream.
- [ ] **Step 3: Run `node --test tests/device-operation-coordinator.test.mjs tests/device-session-ownership.test.mjs`.** Expected FAIL.
- [ ] **Step 4: Convert coordinator to runtime lease facade while preserving current diagnostics shape.**
- [ ] **Step 5: Preserve unexpected FILE behavior.** Idle→blocked; active→unsafe plus current `markDeviceUnsafe()` during shadow migration.
- [ ] **Step 6: Publish ownership at `connectionLifecycle` boundary; do not import runtime into `deviceSessionOwnership.js`.**
- [ ] **Step 7: Run `npm test`.** Expected PASS.
- [ ] **Step 8: Commit:** `refactor: delegate FILE leases and ownership to runtime state`.

### Task 5: Sample recovery event bridge

**Files:**
- Modify: `js/ep133/sampleTransactionRuntime.js`
- Modify: `js/ep133/filesystem.js`
- Modify: `tests/sample-recovery-verifier.test.mjs`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Change constructor to `createSampleTransactionRuntime({getConnectedDeviceInfo,recoveryStore,onRecoveryEvent=()=>{}}={})`.
- Callback events: `{type:'required',transactionId,operation,reason}`, `{type:'verified',transactionId,operation,verification}`, `{type:'acknowledged',transactionId,operation,verification}`.
- `filesystem.js` translates those to runtime recovery events.

- [ ] **Step 1: Add failing runtime recovery tests.** Wrong transaction/device evidence never clears current blocker; acknowledgement requires matching verification.
- [ ] **Step 2: Add failing sample runtime tests.** `journal.fail()` result requiring recovery emits `required`; successful verifier emits `verified`; successful re-verification + acknowledgement emits `acknowledged`.
- [ ] **Step 3: Run `node --test tests/device-runtime-state.test.mjs tests/sample-recovery-verifier.test.mjs`.** Expected FAIL.
- [ ] **Step 4: Implement `onRecoveryEvent` in sample runtime without changing recovery store/journal format.**
- [ ] **Step 5: Translate events in `filesystem.js`; runtime stores evidence summary only, never PCM/binary.**
- [ ] **Step 6: Keep current legacy/runtime admission conservative.**
- [ ] **Step 7: Run `npm test`.** Expected PASS.
- [ ] **Step 8: Commit:** `feat: publish sample recovery into runtime state`.

### Task 6: Project recovery bridge and persisted-recovery hydration

**Files:**
- Modify: `js/ep133/projectFilesystem.js`
- Modify: `js/ep133/filesystem.js`
- Create: `tests/device-runtime-recovery-hydration.test.mjs`
- Modify: project recovery tests already covering project write/rollback/restore.

**Interfaces:**
- Change `createProjectFilesystem({...})` to accept `onRecoveryEvent=()=>{}`.
- Project callback events: `{type:'required',checkpointId,status,projectNumber,reason}`, `{type:'resolved',checkpointId,status,projectNumber}`.
- Add internal `filesystem.js` function `syncDeviceRuntimeRecovery({deviceInfo}={})` that lists both sample transactions and project checkpoints, filters unresolved records to the connected device identity, and dispatches `RECOVERY_SCAN_STARTED` followed by either matching `RECOVERY_REQUIRED` event(s) or `RECOVERY_SCAN_COMPLETED`.
- `onConnectionChange({connected,device})` triggers a scan after connection and resets hydration false on disconnect.

- [ ] **Step 1: Write failing hydration tests.** A fresh runtime with a connected matching device and persisted sample `requires-recovery` record stays blocked; same for project `requires-recovery|rollback-failed`. Records for another device do not block the connected device after scan. No unresolved matching records completes hydration and permits ready once other admission conditions are met.
- [ ] **Step 2: Add failing project event tests.** Failed project write that stores `requires-recovery` or `rollback-failed` emits required. Successful rollback (`rolled-back`) emits resolved. Successful restore/write verification for the same recovery path emits resolved only after existing readback/verification succeeds.
- [ ] **Step 3: Run `node --test tests/device-runtime-recovery-hydration.test.mjs` plus existing project recovery test files.** Expected FAIL.
- [ ] **Step 4: Add `onRecoveryEvent` calls at existing project checkpoint status transitions.** Do not change TAR/project mutation semantics.
- [ ] **Step 5: Implement `syncDeviceRuntimeRecovery()` in `filesystem.js` using existing sample/project stores and existing device identity hashing.** Recovery scan itself is read-only local persistence work; it sends no FILE traffic.
- [ ] **Step 6: Wire connection callback to recovery hydration.** Runtime cannot derive ready for a new connected epoch until scan completion.
- [ ] **Step 7: Run `npm test && npm run test:e2e && npm run build:pages`.** Expected all PASS.
- [ ] **Step 8: Commit:** `feat: hydrate EP runtime recovery state`.

### Task 7: ZAT-5 PR gate

- [ ] **Step 1: Run `npm test` from isolated execution worktree.** PASS.
- [ ] **Step 2: Run `npm run test:e2e`.** PASS.
- [ ] **Step 3: Run `npm run build:pages`.** PASS.
- [ ] **Step 4: Review diff for weakening of timeout/debug/interference/ownership/session/recovery guards.**
- [ ] **Step 5: Open PR tied to ZAT-5 stating: no UI redesign, no new device writes, no HIL claims.**

---

# PR 2 — ZAT-6: Protocol and Capability Ownership

## File map

- Keep `js/ep133/constants.js` as wire constants.
- Keep `js/ep133/fileProtocol.js` as FILE codec.
- Keep `js/ep133/capabilityEvidence.js` as evidence semantics.
- Keep `js/ep133/evidenceRegistry.js` as evidence database.
- Create `js/ep133/deviceCapabilities.js` — domain facade + FILE-rights decoder.
- Modify `js/ep133/deviceProfile.js`, `js/ep133/ui/fileModel.js`, `js/ep133/ui.js`, `js/ep133/projectFilesystem.js`.
- Add `tests/device-capabilities.test.mjs`.

### Task 8: Add one domain capability facade

**Files:**
- Create: `js/ep133/deviceCapabilities.js`
- Modify: `js/ep133/deviceProfile.js`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- `decodeFileRights(capabilities=0)` → frozen `{read,write,delete,move,playback}`.
- `resolveDeviceCapabilities({sku='',firmware='',fileCapabilities=0}={})` → evidence for sample metadata/transfers/bars, project transport/authoring/reload, plus file rights.
- Unknown/missing/out-of-range evidence never grants write authority.

- [ ] **Step 1: Write failing tests** for bit decoding, EP-133 2.5.1, EP-40 2.5.1, EP-1320 unverified writes, unknown SKU, missing firmware, out-of-range firmware.
- [ ] **Step 2: Run `node --test tests/device-capabilities.test.mjs`.** Expected FAIL.
- [ ] **Step 3: Implement facade via existing evidence registry; do not copy firmware ranges.**
- [ ] **Step 4: Update `getEpDeviceProfile()` to consume facade and preserve its current public shape.**
- [ ] **Step 5: Run `node --test tests/device-capabilities.test.mjs tests/ep133.test.mjs`.** PASS.
- [ ] **Step 6: Commit:** `refactor: centralize EP capability resolution`.

### Task 9: Remove raw capability policy from higher layers

**Files:**
- Modify: `js/ep133/ui/fileModel.js`
- Modify: `js/ep133/ui.js`
- Modify: `js/ep133/projectFilesystem.js`
- Modify: `tests/ep133-ui-helpers.test.mjs`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- `ui/fileModel.js` consumes `decodeFileRights()`.
- `ui.js` consumes named rights/profile fields.
- `projectFilesystem.js` omits explicit `[TE_SYSEX_FILE_CAPABILITY_READ]` in project `putFile()` because `fileTransport.putFileUnlocked()` already defaults FILE_PUT to read capability.

- [ ] **Step 1: Add structural failing test** allowing `TE_SYSEX_FILE_CAPABILITY_*` imports only in `constants.js`, `fileProtocol.js`, `fileTransport.js`, `deviceCapabilities.js`, and protocol/transport test fixtures.
- [ ] **Step 2: Run `node --test tests/ep133.test.mjs tests/ep133-ui-helpers.test.mjs tests/device-capabilities.test.mjs`.** Expected FAIL.
- [ ] **Step 3: Migrate `ui/fileModel.js` capability decoding.**
- [ ] **Step 4: Migrate `ui.js` policy decisions.**
- [ ] **Step 5: Remove projectFilesystem raw READ import/argument while preserving transport wire behavior.**
- [ ] **Step 6: Run `npm test && npm run test:e2e && npm run build:pages`.** PASS.
- [ ] **Step 7: Commit:** `refactor: isolate FILE capability policy from feature code`.

### Task 10: ZAT-6 PR gate

- [ ] **Step 1: Search `TE_SYSEX_FILE_CAPABILITY_`; every remaining production use is codec/transport or `deviceCapabilities.js`.**
- [ ] **Step 2: Run `npm test`.** PASS.
- [ ] **Step 3: Run `npm run test:e2e`.** PASS.
- [ ] **Step 4: Run `npm run build:pages`.** PASS.
- [ ] **Step 5: Open PR tied to ZAT-6 and state no new firmware/SKU support is claimed.**

---

# PR 3 — ZAT-7: Composition Cleanup

## File map

`js/app.js` already lazy-loads the EP dependency graph; the EP-specific composition debt is primarily `js/ep133/ui.js`. T1 leaves converter behavior/lazy-load in `app.js` unchanged and cleans the EP composition root instead of starting unrelated converter refactors.

- Create `js/ep133/ui/createEpWorkspace.js`.
- Modify `js/ep133/ui.js`.
- Modify `js/ep133/workspaceBootstrap.js` and `js/ep133/ui/workspaceState.js`.
- Add `tests/my-ep-workspace-bootstrap.test.mjs`.
- Modify `tests/ep133.test.mjs`, `tests/my-ep-workspace-state.test.mjs`.

### Task 11: Extract EP workspace construction from `ui.js`

**Files:**
- Create: `js/ep133/ui/createEpWorkspace.js`
- Modify: `js/ep133/ui.js`
- Modify: `tests/ep133.test.mjs`

**Interfaces:**
- `createEpWorkspace({dom,services,showError,documentRef=globalThis.document,windowRef=globalThis.window})` constructs controllers/services without DOM discovery.
- `ui.js` keeps `initEp133Browser({showError}={})`, DOM registry discovery and entry lifecycle.

- [ ] **Step 1: Add structural failing tests** that `ui.js` delegates to `createEpWorkspace()` and no longer contains FILE admission/safety decisions.
- [ ] **Step 2: Run `node --test tests/ep133.test.mjs`.** Expected FAIL.
- [ ] **Step 3: Move controller/service construction without changing DOM ids, lazy loading or event behavior.**
- [ ] **Step 4: Replace local `connected && !deviceUnsafe` safety reconstruction with runtime-backed helpers; retain UI-only synchronization/hydration/mutating flags.**
- [ ] **Step 5: Run `npm test`.** PASS.
- [ ] **Step 6: Commit:** `refactor: isolate EP workspace composition`.

### Task 12: Drive workspace diagnostics from authoritative runtime

**Files:**
- Create: `tests/my-ep-workspace-bootstrap.test.mjs`
- Modify: `js/ep133/workspaceBootstrap.js`
- Modify: `js/ep133/ui/workspaceState.js`
- Modify: `tests/my-ep-workspace-state.test.mjs`

**Interfaces:**
- Consumes `getDeviceRuntimeSnapshot()` and `onDeviceRuntimeChange(listener)`.
- Connection/operation/safety come from runtime snapshot; project settling and persisted recovery summaries remain adjunct state.

- [ ] **Step 1: Write failing bootstrap test** with injected runtime subscription; state updates without advancing old 200 ms coordinator poll.
- [ ] **Step 2: Run `node --test tests/my-ep-workspace-bootstrap.test.mjs tests/my-ep-workspace-state.test.mjs`.** Expected FAIL.
- [ ] **Step 3: Subscribe bootstrap to runtime and remove coordinator polling for connection/FILE/safety fields.**
- [ ] **Step 4: Keep project settle and recovery-summary polling unchanged; T1 does not redesign those UI surfaces.**
- [ ] **Step 5: Run `npm test && npm run test:e2e`.** PASS.
- [ ] **Step 6: Commit:** `refactor: drive EP workspace status from runtime state`.

### Task 13: T1 final verification

- [ ] **Step 1: Search remaining `isDeviceUnsafe`, `getDeviceSessionToken`, `getFileOperationCoordinatorState`, `ownership.canUseDevice`, `connectionEpoch`.** Classify as compatibility adapter, diagnostics/read-only consumer or defect; migrate feature code that still decides FILE admission independently.
- [ ] **Step 2: Search for any feature/UI path that can clear unsafe.** Only creation of a fresh browser runtime may clear it.
- [ ] **Step 3: Run `npm test`.** PASS.
- [ ] **Step 4: Run `npm run test:e2e`.** PASS.
- [ ] **Step 5: Run `npm run build:pages`.** PASS.
- [ ] **Step 6: Confirm non-goals:** no UI redesign, new write command, new firmware/SKU claim, recovery-store replacement or TypeScript migration.
- [ ] **Step 7: Open ZAT-7 PR and close T1 only after ZAT-5/ZAT-6/ZAT-7 gates pass; list intentionally retained compatibility adapters for later roadmap work.**
