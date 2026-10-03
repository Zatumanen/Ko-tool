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
- Unresolved recovery blocks further FILE work.
- Unknown firmware/capability behavior is not inferred optimistically.
- Operation safety cannot be overridden from presentation code.
- Existing more-conservative behavior wins whenever legacy and runtime state disagree during migration.
- `unsafe` is terminal for the current browser runtime; clearing it requires the existing power-cycle + reload/fresh-runtime path, not a normal reconnect.
- No legacy test expectation may be weakened simply to accommodate the refactor.

## Review Focus

1. **Ownership loss during an active mutation:** do not abort an already-dispatched stream in a way that creates a worse device state; block subsequent operations and preserve the stricter safety outcome until the in-flight lease resolves or becomes ambiguous. Covered in Task 4.
2. **Late/out-of-order events from a prior connection epoch:** ignore/reject them without changing the current snapshot. Covered in Task 2.
3. **Duplicate operation completion or wrong operation id:** reject deterministically and keep the active lease unchanged. Covered in Task 2.
4. **Recovery verification for the wrong transaction/device:** never clear `recovery-required`; existing device identity verification remains authoritative. Covered in Task 5.
5. **Unknown SKU/firmware or capability evidence outside its verified range:** keep write admission disabled and do not reinterpret raw capability bits in feature/UI code. Covered in Tasks 7–8.

---

# PR 1 — ZAT-5: Authoritative Device Runtime State

## File map

- Create `js/ep133/deviceRuntimeState.js` — pure state/event reducer, admission checks, epoch/operation guards, immutable snapshots.
- Create `js/ep133/deviceRuntime.js` — shared runtime instance and small public facade; no WebMIDI or DOM code.
- Create `tests/device-runtime-state.test.mjs` — transition/admission/stale-event tests.
- Modify `js/ep133/errors.js` — add runtime-specific structured error codes used by reducer/admission guards.
- Modify `js/ep133/device.js` — publish connection, disconnect, debug/unsafe events while retaining legacy APIs.
- Modify `js/ep133/deviceOperationCoordinator.js` — delegate admission/phase state to runtime while preserving lease API.
- Modify `js/ep133/fileTransport.js` — use runtime-backed coordinator and conservative compatibility checks.
- Modify `js/ep133/ui/connectionLifecycle.js` — translate cross-tab ownership state into runtime events; keep `deviceSessionOwnership.js` reusable and core-agnostic.
- Modify `js/ep133/filesystem.js` and `js/ep133/sampleTransactionRuntime.js` — reflect unresolved/verified/acknowledged sample recovery in runtime.
- Extend existing coordinator/session/recovery tests without removing current safety assertions.

### Task 1: Pure runtime snapshot and admission contract

**Files:**
- Create: `js/ep133/deviceRuntimeState.js`
- Modify: `js/ep133/errors.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes: `createEpError`, `EP_ERROR_CATEGORY`, `EP_ERROR_CODE` from `js/ep133/errors.js`.
- Produces:
  - `DEVICE_RUNTIME_CONNECTION = {DISCONNECTED:'disconnected', CONNECTING:'connecting', CONNECTED:'connected'}`
  - `DEVICE_RUNTIME_OWNERSHIP = {NONE:'none', OWNED:'owned', BLOCKED:'blocked'}`
  - `DEVICE_RUNTIME_OPERATION = {IDLE:'idle', READING:'reading', MUTATING:'mutating', VERIFYING:'verifying'}`
  - `DEVICE_RUNTIME_SAFETY = {SAFE:'safe', BLOCKED:'blocked', RECOVERY_REQUIRED:'recovery-required', UNSAFE:'unsafe'}`
  - `createDeviceRuntimeState({now=()=>Date.now()}={})`
  - returned methods: `getSnapshot()`, `subscribe(listener)`, `dispatch(event)`, `assertCanStartFileOperation({mode='read'}={})`, `captureEpoch()`, `assertEpoch(epoch)`.

- [ ] **Step 1: Write the failing initial-state/status tests**

Assert initial values and that `ready` requires all of: connected, verified identity, owned session, idle operation, safe safety state. A connected device with ownership `none` or `blocked` must derive `blocked`, not `ready`.

- [ ] **Step 2: Run focused test to verify failure**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: FAIL because `deviceRuntimeState.js` does not exist.

- [ ] **Step 3: Add runtime structured error codes**

Add to `EP_ERROR_CODE`:

```text
DEVICE_RUNTIME_INVALID_TRANSITION
DEVICE_RUNTIME_OPERATION_BLOCKED
DEVICE_RUNTIME_STALE_EPOCH
DEVICE_RUNTIME_STALE_OPERATION
```

Use `EP_ERROR_CATEGORY.RUNTIME` for stale/invalid programmer-domain events and `EP_ERROR_CATEGORY.SAFETY` for denied operation admission.

- [ ] **Step 4: Implement the minimal immutable state container**

Initialize connection `disconnected/epoch 0/device null`, ownership `none`, operation `idle/active null`, safety `safe/reason null`, recovery transaction null, external interference null. `getSnapshot()` returns an immutable copy.

- [ ] **Step 5: Implement subscription and derived-status priority**

Priority: `unsafe > recovery-required > blocked > connecting > verifying > mutating > reading > ready > disconnected`. Notify subscribers only after accepted state changes.

- [ ] **Step 6: Implement read/mutation admission guard**

`assertCanStartFileOperation({mode})` requires connected + verified identity + owned + idle + safe. Both reads and mutations are denied for `blocked`, `recovery-required`, or `unsafe`.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ep133/deviceRuntimeState.js js/ep133/errors.js tests/device-runtime-state.test.mjs
git commit -m "feat: add authoritative EP runtime state model"
```

### Task 2: Epoch-bound operation events and invalid transitions

**Files:**
- Modify: `js/ep133/deviceRuntimeState.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes: Task 1 API.
- Produces accepted event shapes:
  - `{type:'OWNERSHIP_ACQUIRED'}`
  - `{type:'OWNERSHIP_LOST'}`
  - `{type:'OWNERSHIP_BLOCKED',reason?}`
  - `{type:'CONNECT_STARTED'}`
  - `{type:'DEVICE_CONNECTED',epoch,device}` with `device.identityVerified === true`
  - `{type:'DEVICE_DISCONNECTED',epoch,reason?}`
  - `{type:'FILE_OPERATION_STARTED',epoch,operationId,label,mode}`
  - `{type:'FILE_OPERATION_VERIFYING',epoch,operationId}`
  - `{type:'FILE_OPERATION_FINISHED',epoch,operationId}`
  - `{type:'FILE_OPERATION_FAILED',epoch,operationId,effect:'none'|'possible'|'session-ambiguous',reason?}`
  - `{type:'DEVICE_MARKED_UNSAFE',epoch,reason}`
  - `{type:'FIRMWARE_DEBUG_DETECTED',epoch,reason}`
  - `{type:'UNEXPECTED_FILE_TRAFFIC',epoch,requestId?,reason?}`

- [ ] **Step 1: Add failing transition tests**

Cover connect→ready, read→ready, mutation→verifying→ready, simultaneous operation rejection, wrong operation-id completion, stale epoch event, `effect:none`→safe, `effect:possible`→recovery-required, `effect:session-ambiguous`→unsafe, debug→unsafe, unexpected FILE idle→blocked, unexpected FILE active→unsafe, and ordinary events unable to clear unsafe.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: new transition tests FAIL.

- [ ] **Step 3: Implement monotonic epoch/stale-event rules**

`DEVICE_CONNECTED` accepts only a positive epoch not older than current state. Operation events require exact current epoch and exact active `operationId`. Stale events return/throw a structured stale error without mutating current state.

- [ ] **Step 4: Implement operation lifecycle transitions**

Read starts `reading`; mutation starts `mutating`; only matching active operation may enter `verifying` or finish/fail.

- [ ] **Step 5: Implement fail-closed failure classification**

`none` may return safe/idle; `possible` sets recovery-required; `session-ambiguous`, firmware debug, or active external interference sets unsafe. Disconnect invalidates active operation but does not clear unsafe.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/ep133/deviceRuntimeState.js tests/device-runtime-state.test.mjs
git commit -m "feat: enforce epoch-bound EP operation transitions"
```

### Task 3: Shared runtime instance and `device.js` shadow publication

**Files:**
- Create: `js/ep133/deviceRuntime.js`
- Modify: `js/ep133/device.js`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Produces from `deviceRuntime.js`: `deviceRuntime`, `getDeviceRuntimeSnapshot()`, `onDeviceRuntimeChange(listener)`, `dispatchDeviceRuntimeEvent(event)`.
- Existing `device.js` APIs remain: `isConnected()`, `isDeviceUnsafe()`, `getDeviceSessionToken()`, `onConnectionChange()`.

- [ ] **Step 1: Add failing shared-runtime/device publication contract tests**

Assert the facade exports exist and `device.js` keeps legacy exports while publishing connect/disconnect/unsafe/debug events.

- [ ] **Step 2: Run relevant tests**

Run: `node --test tests/device-runtime-state.test.mjs tests/ep133.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement `deviceRuntime.js`**

It may import `deviceRuntimeState.js` only; no device, transport, UI, DOM, or recovery-store imports.

- [ ] **Step 4: Publish physical lifecycle from `device.js`**

Map the existing `connectionEpoch` and verified identity result to runtime events. Runtime device summary includes SKU, firmware, device key and `identityVerified:true`, but not raw serial fields.

- [ ] **Step 5: Publish current unsafe/debug paths**

`enterUnsafeState()` and firmware debug detection publish runtime events in addition to current legacy mutation. If runtime and legacy disagree, the stricter result remains governing.

- [ ] **Step 6: Run full unit/behavior suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/ep133/deviceRuntime.js js/ep133/device.js tests/device-runtime-state.test.mjs tests/ep133.test.mjs
git commit -m "refactor: mirror device lifecycle into runtime state"
```

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
- `runtime` is the shared runtime facade or an injected test double exposing `getSnapshot`, `dispatch`, `assertCanStartFileOperation`, `captureEpoch`.
- `createConnectionLifecycle({...})` gains `publishRuntimeEvent=()=>{}`; composition passes `dispatchDeviceRuntimeEvent`.

- [ ] **Step 1: Add failing coordinator delegation tests**

Assert `begin()` calls runtime admission then publishes `FILE_OPERATION_STARTED`; `setPhase(VERIFYING)` publishes verifying; `close()`/`run()` completes only matching operation.

- [ ] **Step 2: Add failing ownership publication tests**

Acquisition→`OWNERSHIP_ACQUIRED`, blocked acquisition→`OWNERSHIP_BLOCKED`, release/loss→`OWNERSHIP_LOST`. Ownership loss during active mutation blocks subsequent admission but does not forcibly cut the already-dispatched stream; its lease result determines the stricter final safety state.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/device-operation-coordinator.test.mjs tests/device-session-ownership.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Convert coordinator to runtime lease facade**

Keep its current diagnostics snapshot shape, derived from runtime operation/safety instead of independent authority.

- [ ] **Step 5: Preserve unexpected FILE behavior**

Idle unexpected FILE→blocked; active unexpected FILE→unsafe and still calls existing `markDeviceUnsafe()` during shadow migration.

- [ ] **Step 6: Publish ownership state at `connectionLifecycle` boundary**

Do not import runtime into `deviceSessionOwnership.js`; translate its existing state callback into runtime events in `connectionLifecycle.js`.

- [ ] **Step 7: Run full unit/behavior suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ep133/deviceOperationCoordinator.js js/ep133/fileTransport.js js/ep133/ui/connectionLifecycle.js tests/device-operation-coordinator.test.mjs tests/device-session-ownership.test.mjs tests/ep133.test.mjs
git commit -m "refactor: delegate FILE leases and ownership to runtime state"
```

### Task 5: Recovery state bridge and conservative compatibility

**Files:**
- Modify: `js/ep133/sampleTransactionRuntime.js`
- Modify: `js/ep133/filesystem.js`
- Modify: `tests/sample-recovery-verifier.test.mjs`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Change constructor to `createSampleTransactionRuntime({getConnectedDeviceInfo,recoveryStore,onRecoveryEvent=()=>{}}={})`.
- `onRecoveryEvent(event)` emits one of:
  - `{type:'required',transactionId,operation,reason}`
  - `{type:'verified',transactionId,operation,verification}`
  - `{type:'acknowledged',transactionId,operation,verification}`
- `filesystem.js` translates those into runtime `RECOVERY_REQUIRED`, `RECOVERY_VERIFIED`, `RECOVERY_ACKNOWLEDGED` events.

- [ ] **Step 1: Add failing runtime recovery tests**

Assert possible mutation→recovery-required; wrong transaction id/device evidence cannot clear; acknowledgement before matching authoritative verification is rejected.

- [ ] **Step 2: Add failing sample transaction runtime tests**

After `journal.fail()` returns a record with `requiresRecovery:true`, `onRecoveryEvent(required)` fires. `verifyTransaction()` emits the verifier report only after `assertSampleRecoveryDevice`/authoritative reads succeed. `acknowledgeTransaction()` emits acknowledgement only after its current re-verification succeeds.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs tests/sample-recovery-verifier.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement `onRecoveryEvent` in sample runtime**

In `run()` catch, keep the return value from `journal.fail()`, inspect its normalized status/recovery detail, and emit `required` only when recovery is required. Emit `verified` after successful verifier update; emit `acknowledged` after successful acknowledged update.

- [ ] **Step 5: Translate recovery events in `filesystem.js`**

Instantiate `createSampleTransactionRuntime` with a callback that dispatches normalized runtime recovery events. Runtime stores only transaction/evidence summary; no PCM or raw binary.

- [ ] **Step 6: Keep conservative legacy/runtime admission**

FILE work is blocked when either current legacy safety guard or runtime admission blocks. Do not remove `isDeviceUnsafe()` or persisted recovery logic in this PR.

- [ ] **Step 7: Run full verification for ZAT-5**

Run: `npm test && npm run test:e2e && npm run build:pages`

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ep133/sampleTransactionRuntime.js js/ep133/filesystem.js tests/device-runtime-state.test.mjs tests/sample-recovery-verifier.test.mjs tests/ep133.test.mjs
git commit -m "feat: gate FILE safety on authoritative recovery state"
```

### Task 6: ZAT-5 PR gate

**Files:** No planned product changes.

- [ ] **Step 1: Run `npm test` from the isolated execution worktree** — Expected PASS.
- [ ] **Step 2: Run `npm run test:e2e`** — Expected PASS.
- [ ] **Step 3: Run `npm run build:pages`** — Expected PASS.
- [ ] **Step 4: Review diff for accidental weakening of timeout/debug/interference/ownership/session/recovery guards.**
- [ ] **Step 5: Open a PR tied to ZAT-5 stating explicitly: no UI redesign, no new device writes, no HIL claims.**

---

# PR 2 — ZAT-6: Protocol and Capability Ownership

## File map

- Keep `js/ep133/constants.js` as wire constants.
- Keep `js/ep133/fileProtocol.js` as FILE payload/response codec.
- Keep `js/ep133/capabilityEvidence.js` as evidence semantics.
- Keep `js/ep133/evidenceRegistry.js` as evidence database.
- Create `js/ep133/deviceCapabilities.js` — domain facade and FILE-rights decoder.
- Modify `js/ep133/deviceProfile.js` — consume the facade.
- Modify `js/ep133/ui/fileModel.js` and `js/ep133/ui.js` — stop interpreting raw FILE capability constants.
- Modify `js/ep133/projectFilesystem.js` — stop passing raw `TE_SYSEX_FILE_CAPABILITY_READ`; rely on transport's existing default read capability for project PUT.
- Add `tests/device-capabilities.test.mjs`.

### Task 7: Add one domain capability facade

**Files:**
- Create: `js/ep133/deviceCapabilities.js`
- Modify: `js/ep133/deviceProfile.js`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- Produces `decodeFileRights(capabilities=0)` returning frozen `{read,write,delete,move,playback}` booleans.
- Produces `resolveDeviceCapabilities({sku='',firmware='',fileCapabilities=0}={})` returning evidence for `sampleMetadata`, `sampleTransfers`, `sampleBars`, `projectTransport`, `projectAuthoring`, `projectReload` plus `fileRights`.
- Unknown SKU, missing firmware, or firmware outside evidence range never grants write authority.

- [ ] **Step 1: Write failing tests** for capability bit decoding, EP-133 2.5.1, EP-40 2.5.1, EP-1320 unverified writes, unknown SKU, missing firmware, and out-of-range firmware.
- [ ] **Step 2: Run `node --test tests/device-capabilities.test.mjs`** — Expected FAIL.
- [ ] **Step 3: Implement facade by calling existing evidence registry**; do not copy firmware ranges into the new file.
- [ ] **Step 4: Update `getEpDeviceProfile()` to consume the facade while preserving its public shape.**
- [ ] **Step 5: Run `node --test tests/device-capabilities.test.mjs tests/ep133.test.mjs`** — Expected PASS.
- [ ] **Step 6: Commit:** `git commit -m "refactor: centralize EP capability resolution"` with the facade/profile/tests staged.

### Task 8: Remove raw capability policy from higher layers

**Files:**
- Modify: `js/ep133/ui/fileModel.js`
- Modify: `js/ep133/ui.js`
- Modify: `js/ep133/projectFilesystem.js`
- Modify: `tests/ep133-ui-helpers.test.mjs`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- `ui/fileModel.js` consumes `decodeFileRights()` rather than capability constants.
- `ui.js` consumes named rights/device profile rather than bitmask arithmetic.
- `projectFilesystem.js` omits explicit `[TE_SYSEX_FILE_CAPABILITY_READ]` when calling `putFile()` because `fileTransport.putFileUnlocked()` already defaults to read capability for FILE_PUT.

- [ ] **Step 1: Add structural failing test** allowing `TE_SYSEX_FILE_CAPABILITY_*` imports only in `constants.js`, `fileProtocol.js`, `fileTransport.js`, `deviceCapabilities.js`, and protocol/transport test fixtures.
- [ ] **Step 2: Run `node --test tests/ep133.test.mjs tests/ep133-ui-helpers.test.mjs tests/device-capabilities.test.mjs`** — Expected FAIL on current UI/domain imports.
- [ ] **Step 3: Migrate `ui/fileModel.js` capability decoding to `decodeFileRights()`.**
- [ ] **Step 4: Migrate `ui.js` policy decisions to named rights/profile fields.**
- [ ] **Step 5: Remove projectFilesystem raw READ import and explicit PUT capability argument; preserve transport wire behavior through its existing default.**
- [ ] **Step 6: Run `npm test && npm run test:e2e && npm run build:pages`** — Expected all PASS.
- [ ] **Step 7: Commit:** `git commit -m "refactor: isolate FILE capability policy from feature code"`.

### Task 9: ZAT-6 PR gate

- [ ] **Step 1: Repository search for `TE_SYSEX_FILE_CAPABILITY_`**; every remaining production use must be wire codec/transport or `deviceCapabilities.js`.
- [ ] **Step 2: Run `npm test`** — PASS.
- [ ] **Step 3: Run `npm run test:e2e`** — PASS.
- [ ] **Step 4: Run `npm run build:pages`** — PASS.
- [ ] **Step 5: Open PR tied to ZAT-6 and state that no new firmware/SKU support is claimed.**

---

# PR 3 — ZAT-7: Composition Cleanup

## File map

`js/app.js` already lazy-loads the EP dependency graph; the EP-specific composition debt is primarily `js/ep133/ui.js`, which instantiates many controllers and retains local device-safety reconstruction. T1 therefore leaves the converter behavior/lazy-load contract in `app.js` unchanged and cleans the EP composition root rather than starting unrelated converter refactors.

- Create `js/ep133/ui/createEpWorkspace.js` — construct EP controllers/services from injected dependencies; no DOM discovery.
- Modify `js/ep133/ui.js` — DOM discovery + call to workspace factory + entry lifecycle only.
- Modify `js/ep133/workspaceBootstrap.js` — subscribe to authoritative runtime instead of polling coordinator for connection/FILE state.
- Add `tests/my-ep-workspace-bootstrap.test.mjs` for event-driven bootstrap wiring.
- Modify `tests/ep133.test.mjs` and `tests/my-ep-workspace-state.test.mjs` only where contracts need additional assertions.

### Task 10: Extract EP workspace construction from `ui.js`

**Files:**
- Create: `js/ep133/ui/createEpWorkspace.js`
- Modify: `js/ep133/ui.js`
- Modify: `tests/ep133.test.mjs`

**Interfaces:**
- Produces `createEpWorkspace({dom,services,showError,documentRef=globalThis.document,windowRef=globalThis.window})`.
- `services` supplies runtime/device/filesystem/controller dependencies; workspace code does not import `app.js`.
- `ui.js` keeps `initEp133Browser({showError}={})` and DOM-registry discovery.

- [ ] **Step 1: Add structural failing tests** asserting `ui.js` delegates to `createEpWorkspace()` and no longer contains FILE safety/admission decisions.
- [ ] **Step 2: Run `node --test tests/ep133.test.mjs`** — Expected FAIL.
- [ ] **Step 3: Move controller/service construction to the factory without changing DOM ids, lazy loading, or event behavior.**
- [ ] **Step 4: Replace local `connected && !deviceUnsafe` safety reconstruction with runtime-backed named admission/status helpers; keep UI-only `synchronized`, `metadataHydrating`, and `mutating` workflow flags local.**
- [ ] **Step 5: Run `npm test`** — Expected PASS.
- [ ] **Step 6: Commit:** `git commit -m "refactor: isolate EP workspace composition"`.

### Task 11: Drive workspace diagnostics from authoritative runtime

**Files:**
- Create: `tests/my-ep-workspace-bootstrap.test.mjs`
- Modify: `js/ep133/workspaceBootstrap.js`
- Modify: `js/ep133/ui/workspaceState.js`
- Modify: `tests/my-ep-workspace-state.test.mjs`

**Interfaces:**
- Consumes `getDeviceRuntimeSnapshot()` and `onDeviceRuntimeChange(listener)`.
- Workspace status derives connection/operation/safety from runtime snapshot; project-runtime settling and persisted recovery summaries remain adjunct state.

- [ ] **Step 1: Write failing bootstrap test** with injected runtime subscription; dispatch a runtime snapshot change and assert workspace state updates without advancing the 200 ms coordinator poll timer.
- [ ] **Step 2: Run `node --test tests/my-ep-workspace-bootstrap.test.mjs tests/my-ep-workspace-state.test.mjs`** — Expected FAIL before subscription wiring.
- [ ] **Step 3: Subscribe `workspaceBootstrap` to runtime and remove coordinator polling for connection/FILE-operation/safety fields.**
- [ ] **Step 4: Keep project settle and recovery polling unchanged because they remain separate persisted/runtime sources in T1.**
- [ ] **Step 5: Run `npm test && npm run test:e2e`** — Expected PASS.
- [ ] **Step 6: Commit:** `git commit -m "refactor: drive EP workspace status from runtime state"`.

### Task 12: T1 final verification

**Files:** No planned product changes.

- [ ] **Step 1: Search remaining `isDeviceUnsafe`, `getDeviceSessionToken`, `getFileOperationCoordinatorState`, `ownership.canUseDevice`, and `connectionEpoch` uses.** Classify each remaining use as compatibility adapter, diagnostics/read-only consumer, or defect. Migrate any feature code that independently decides FILE admissibility.
- [ ] **Step 2: Search runtime code for any feature/UI path that can set safety back to safe.** Only creation of a fresh browser runtime may clear `unsafe`.
- [ ] **Step 3: Run `npm test`** — PASS.
- [ ] **Step 4: Run `npm run test:e2e`** — PASS.
- [ ] **Step 5: Run `npm run build:pages`** — PASS.
- [ ] **Step 6: Confirm non-goals:** no intentional UI redesign, no new write command, no new firmware/SKU support claim, no recovery-store replacement, no TypeScript migration.
- [ ] **Step 7: Open ZAT-7 PR and close T1 only after ZAT-5, ZAT-6, ZAT-7 gates pass; list intentionally retained compatibility adapters for later roadmap work.**
