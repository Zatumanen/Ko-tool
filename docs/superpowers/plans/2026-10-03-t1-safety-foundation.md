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
- Modify `js/ep133/errors.js` — add runtime-specific structured error codes used by the reducer/admission guards.
- Modify `js/ep133/device.js` — publish connection, disconnect, debug/unsafe events while retaining legacy APIs.
- Modify `js/ep133/deviceOperationCoordinator.js` — delegate admission/phase state to runtime while preserving lease API.
- Modify `js/ep133/fileTransport.js` — use runtime-backed coordinator and conservative compatibility checks.
- Modify `js/ep133/ui/deviceSessionOwnership.js` and `js/ep133/ui/connectionLifecycle.js` — publish ownership transitions without moving Web Locks/BroadcastChannel into core.
- Modify `js/ep133/filesystem.js` and sample recovery runtime boundary — reflect unresolved/verified/acknowledged recovery in runtime.
- Modify existing coordinator/session/recovery tests only to add assertions; do not remove current safety assertions.

### Task 1: Pure runtime snapshot and admission contract

**Files:**
- Create: `js/ep133/deviceRuntimeState.js`
- Modify: `js/ep133/errors.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes: `createEpError`, `EP_ERROR_CATEGORY`, `EP_ERROR_CODE` from `js/ep133/errors.js`.
- Produces:
  - `DEVICE_RUNTIME_CONNECTION = {DISCONNECTED, CONNECTING, CONNECTED}`
  - `DEVICE_RUNTIME_OWNERSHIP = {NONE, OWNED, BLOCKED}`
  - `DEVICE_RUNTIME_OPERATION = {IDLE, READING, MUTATING, VERIFYING}`
  - `DEVICE_RUNTIME_SAFETY = {SAFE, BLOCKED, RECOVERY_REQUIRED, UNSAFE}`
  - `DEVICE_RUNTIME_STATUS = {DISCONNECTED, CONNECTING, READY, READING, MUTATING, VERIFYING, BLOCKED, RECOVERY_REQUIRED, UNSAFE}`
  - `createDeviceRuntimeState({now=()=>Date.now()}={})`
  - returned methods: `getSnapshot()`, `subscribe(listener)`, `dispatch(event)`, `assertCanStartFileOperation({mode='read'}={})`, `captureEpoch()`, `assertEpoch(epoch)`.

- [ ] **Step 1: Write failing tests for initial snapshot and derived-status priority**

Add tests asserting:

```js
const runtime=createDeviceRuntimeState({now:()=>100});
assert.deepEqual(runtime.getSnapshot().connection.status,'disconnected');
assert.equal(runtime.getSnapshot().operation.phase,'idle');
assert.equal(runtime.getSnapshot().safety.status,'safe');
assert.equal(runtime.getSnapshot().status,'disconnected');
```

Also assert derived priority `unsafe > recovery-required > blocked > connecting > verifying > mutating > reading > ready > disconnected` by dispatching only valid setup events.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: FAIL because `deviceRuntimeState.js` does not exist.

- [ ] **Step 3: Add runtime-specific structured error codes**

Add to `EP_ERROR_CODE`:

```text
DEVICE_RUNTIME_INVALID_TRANSITION
DEVICE_RUNTIME_OPERATION_BLOCKED
DEVICE_RUNTIME_STALE_EPOCH
DEVICE_RUNTIME_STALE_OPERATION
```

All runtime transition/admission failures use `EP_ERROR_CATEGORY.SAFETY` or `EP_ERROR_CATEGORY.RUNTIME` as appropriate and include sanitized details only.

- [ ] **Step 4: Implement the minimal state container and immutable snapshot**

`createDeviceRuntimeState()` must initialize:

```text
connection.status = disconnected
connection.epoch = 0
connection.device = null
ownership.status = none
operation.phase = idle
operation.active = null
safety.status = safe
safety.reason = null
recovery.transaction = null
externalInterference = null
status = disconnected
```

`getSnapshot()` returns a frozen snapshot that callers cannot mutate.

- [ ] **Step 5: Implement subscription and derived status**

`subscribe(listener)` immediately validates `listener` is callable, registers it, and returns an unsubscribe function. Notifications occur only after accepted state changes.

- [ ] **Step 6: Implement read/mutation admission guards**

`assertCanStartFileOperation({mode})` permits both modes only when connection is connected, ownership is owned, operation is idle, identity is verified, and safety is safe. Reads and mutations are blocked for `blocked`, `recovery-required`, and `unsafe`.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: PASS for initial snapshot, immutable snapshot, status priority, and admission tests.

- [ ] **Step 8: Commit**

```bash
git add js/ep133/deviceRuntimeState.js js/ep133/errors.js tests/device-runtime-state.test.mjs
git commit -m "feat: add authoritative EP runtime state model"
```

### Task 2: Epoch-bound operation events and invalid-transition rules

**Files:**
- Modify: `js/ep133/deviceRuntimeState.js`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes: Task 1 runtime API.
- Produces accepted event shapes:
  - `{type:'CONNECT_STARTED'}`
  - `{type:'DEVICE_CONNECTED',epoch,device}` where `device.identityVerified === true`
  - `{type:'DEVICE_DISCONNECTED',epoch,reason?}`
  - `{type:'FILE_OPERATION_STARTED',epoch,operationId,label,mode}`
  - `{type:'FILE_OPERATION_VERIFYING',epoch,operationId}`
  - `{type:'FILE_OPERATION_FINISHED',epoch,operationId}`
  - `{type:'FILE_OPERATION_FAILED',epoch,operationId,effect:'none'|'possible'|'session-ambiguous',reason?}`
  - `{type:'DEVICE_MARKED_UNSAFE',epoch,reason}`
  - `{type:'FIRMWARE_DEBUG_DETECTED',epoch,reason}`
  - `{type:'UNEXPECTED_FILE_TRAFFIC',epoch,requestId?,reason?}`

- [ ] **Step 1: Add failing transition tests**

Cover:

```text
connect -> ready
read -> ready
mutation -> verifying -> ready
second simultaneous operation -> rejected
wrong operationId finish -> rejected
old epoch finish after disconnect/reconnect -> ignored/rejected with stale-epoch code
mutation failure effect=none -> safe idle
mutation failure effect=possible -> recovery-required
mutation failure effect=session-ambiguous -> unsafe
firmware debug during active FILE state -> unsafe
unexpected FILE idle -> blocked
unexpected FILE active -> unsafe
ordinary event cannot clear unsafe
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `node --test tests/device-runtime-state.test.mjs`

Expected: new transition tests FAIL.

- [ ] **Step 3: Implement epoch monotonicity and stale-event guard**

`DEVICE_CONNECTED` accepts only a positive epoch not older than current state. `DEVICE_DISCONNECTED` invalidates the active lease. Operation events require exact current epoch and exact active `operationId`.

- [ ] **Step 4: Implement operation lifecycle transitions**

A read starts in `reading`; a mutation starts in `mutating`; only the active operation may move to `verifying` or finish/fail. Closing an operation clears `active` only after a valid matching event.

- [ ] **Step 5: Implement fail-closed failure classification**

`effect:'none'` may return to safe/idle. `effect:'possible'` sets `recovery-required`. `effect:'session-ambiguous'`, firmware debug, or active external interference sets `unsafe`.

- [ ] **Step 6: Verify focused tests**

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
- Consumes: `createDeviceRuntimeState()` from Task 1.
- Produces from `deviceRuntime.js`:
  - `deviceRuntime`
  - `getDeviceRuntimeSnapshot()`
  - `onDeviceRuntimeChange(listener)`
  - `dispatchDeviceRuntimeEvent(event)`
- Existing `device.js` public APIs remain available: `isConnected()`, `isDeviceUnsafe()`, `getDeviceSessionToken()`, `onConnectionChange()`.

- [ ] **Step 1: Add failing integration-contract tests**

Assert the shared runtime facade exists and `device.js` source publishes connect/disconnect/unsafe/debug events without removing current legacy exports.

- [ ] **Step 2: Run relevant tests**

Run: `node --test tests/device-runtime-state.test.mjs tests/ep133.test.mjs`

Expected: FAIL on missing shared runtime/publication contract.

- [ ] **Step 3: Implement `deviceRuntime.js` as the single shared instance**

The module may depend on `deviceRuntimeState.js` only. It must not import `device.js`, `fileTransport.js`, UI modules, DOM APIs, or recovery stores.

- [ ] **Step 4: Publish physical connection lifecycle from `device.js`**

Map current `connectionEpoch` and verified identity to runtime events. Preserve the existing `notifyConnection()` payload and session token behavior during shadow migration.

- [ ] **Step 5: Publish current unsafe/debug paths**

`enterUnsafeState()` and firmware debug detection must publish runtime unsafe/debug events in addition to existing legacy state mutation. The legacy and runtime states are both kept; if they disagree, callers remain governed by the stricter legacy/runtime outcome.

- [ ] **Step 6: Verify current connection tests remain green**

Run: `npm test`

Expected: PASS; no current connection/session safety assertion removed.

- [ ] **Step 7: Commit**

```bash
git add js/ep133/deviceRuntime.js js/ep133/device.js tests/device-runtime-state.test.mjs tests/ep133.test.mjs
git commit -m "refactor: mirror device lifecycle into runtime state"
```

### Task 4: Runtime-backed FILE coordinator and ownership bridge

**Files:**
- Modify: `js/ep133/deviceOperationCoordinator.js`
- Modify: `js/ep133/fileTransport.js`
- Modify: `js/ep133/ui/deviceSessionOwnership.js`
- Modify: `js/ep133/ui/connectionLifecycle.js`
- Modify: `tests/device-operation-coordinator.test.mjs`
- Modify: `tests/device-session-ownership.test.mjs`
- Modify: `tests/ep133.test.mjs`

**Interfaces:**
- Consumes: shared runtime facade from Task 3.
- `createDeviceOperationCoordinator({...})` keeps `begin`, `run`, `reset`, `observeUnexpectedFileTraffic`, `getState`, `assertAvailable` for compatibility.
- Add optional dependencies to coordinator: `runtime=deviceRuntime`, `nextOperationId=...` for deterministic tests.
- `createConnectionLifecycle({...})` gains `publishRuntimeEvent=dispatchDeviceRuntimeEvent` injection so ownership remains testable without a core→UI import.

- [ ] **Step 1: Add failing coordinator tests for runtime delegation**

Assert `begin()` calls runtime admission, dispatches `FILE_OPERATION_STARTED`, `setPhase(VERIFYING)` dispatches verifying, and `close()`/`run()` finish only the matching active operation.

- [ ] **Step 2: Add failing ownership-loss tests**

Assert acquiring ownership publishes `OWNERSHIP_ACQUIRED`; blocked acquisition publishes `OWNERSHIP_BLOCKED`; release/loss publishes `OWNERSHIP_LOST`.

For ownership loss during an active mutation, assert no new operation is admitted. Do not force-abort an already-dispatched FILE stream; its eventual failure/success is resolved through the active lease and the stricter safety state wins.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/device-operation-coordinator.test.mjs tests/device-session-ownership.test.mjs`

Expected: FAIL on missing runtime delegation/publication.

- [ ] **Step 4: Convert coordinator into a lease facade over runtime**

Keep the existing snapshot shape required by current diagnostics, but derive its state from the runtime-backed operation/safety fields rather than owning an independent global authority.

- [ ] **Step 5: Preserve unexpected FILE traffic behavior**

Idle unexpected FILE traffic yields runtime `blocked`; traffic during an active FILE operation yields runtime `unsafe` and still calls current `markDeviceUnsafe()` during shadow migration.

- [ ] **Step 6: Publish ownership changes through `connectionLifecycle`**

Do not import core runtime from `deviceSessionOwnership.js`; keep it reusable/testable by translating its state changes at the lifecycle/composition boundary.

- [ ] **Step 7: Run the full unit/behavior suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ep133/deviceOperationCoordinator.js js/ep133/fileTransport.js js/ep133/ui/deviceSessionOwnership.js js/ep133/ui/connectionLifecycle.js tests/device-operation-coordinator.test.mjs tests/device-session-ownership.test.mjs tests/ep133.test.mjs
git commit -m "refactor: delegate FILE leases and ownership to runtime state"
```

### Task 5: Recovery state bridge and conservative compatibility

**Files:**
- Modify: `js/ep133/filesystem.js`
- Modify: `js/ep133/sampleTransactionRuntime.js`
- Modify: `js/ep133/sampleTransactionJournal.js` only if callback placement cannot be kept in runtime boundary.
- Modify: `tests/sample-recovery-verifier.test.mjs`
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-runtime-state.test.mjs`

**Interfaces:**
- Consumes: shared runtime from Task 3; existing `verifySampleRecoveryTransactionState()` device identity checks remain unchanged.
- Produces normalized runtime events:
  - `{type:'RECOVERY_REQUIRED',transactionId,operation,reason}`
  - `{type:'RECOVERY_VERIFIED',transactionId,classification,deviceIdentityHash}`
  - `{type:'RECOVERY_ACKNOWLEDGED',transactionId,classification,deviceIdentityHash}`
- Runtime recovery state stores identifiers/evidence summary only; no raw sample data.

- [ ] **Step 1: Add failing runtime recovery tests**

Assert a possible mutation moves runtime to `recovery-required`; verification for a non-matching transaction id or wrong device identity cannot clear it; acknowledgement without matching authoritative verification is rejected.

- [ ] **Step 2: Add failing sample-runtime integration tests**

Extend `sample-recovery-verifier.test.mjs` so `verifyTransaction()` emits verification evidence and `acknowledgeTransaction()` emits acknowledgement only after the existing verifier/device-identity contract succeeds.

- [ ] **Step 3: Run focused tests**

Run: `node --test tests/device-runtime-state.test.mjs tests/sample-recovery-verifier.test.mjs`

Expected: FAIL on missing recovery event bridge.

- [ ] **Step 4: Publish recovery requirement from sample transaction failure boundary**

Prefer a callback/event injection on `createSampleTransactionRuntime()` or the `filesystem.js` wrapper rather than importing UI code. The runtime event is sent after the journal has assessed `requiresRecovery:true`, using the journal transaction id and normalized operation.

- [ ] **Step 5: Publish verified/acknowledged evidence**

Keep `assertSampleRecoveryDevice()` and verifier classifications authoritative. Runtime may leave `recovery-required` only after the matching transaction has current-device verification and the supported acknowledgement/resolution path completes.

- [ ] **Step 6: Add conservative legacy/runtime compatibility checks**

At FILE admission boundaries, the operation is blocked if either current legacy guards or runtime guards block it. Do not delete `isDeviceUnsafe()` or current journal checks in this PR.

- [ ] **Step 7: Run full unit suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Run E2E before opening ZAT-5 PR**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 9: Build Pages artifact**

Run: `npm run build:pages`

Expected: successful build with no missing module/import errors.

- [ ] **Step 10: Commit**

```bash
git add js/ep133/filesystem.js js/ep133/sampleTransactionRuntime.js js/ep133/sampleTransactionJournal.js tests/device-runtime-state.test.mjs tests/sample-recovery-verifier.test.mjs tests/ep133.test.mjs
git commit -m "feat: gate FILE safety on authoritative recovery state"
```

### Task 6: ZAT-5 PR verification gate

**Files:**
- No product-code changes unless verification finds a defect.

**Interfaces:**
- Produces: a branch where runtime state is authoritative for admission while legacy APIs still exist as compatibility adapters.

- [ ] **Step 1: Run all unit/behavior tests from a clean checkout/worktree**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 3: Build Pages output**

Run: `npm run build:pages`

Expected: PASS.

- [ ] **Step 4: Review diff specifically for accidental safety weakening**

Reject the PR if any change removes current timeout, debug SysEx, unexpected FILE traffic, ownership, session token, or recovery guard without an equivalent stricter runtime assertion.

- [ ] **Step 5: Open PR tied to ZAT-5**

PR scope must say explicitly: no UI redesign, no new device writes, no HIL claims.

---

# PR 2 — ZAT-6: Protocol and Capability Ownership

## File map

- Keep `js/ep133/fileProtocol.js` as the canonical FILE payload/response codec.
- Keep `js/ep133/constants.js` as wire constants; feature/UI code should not import FILE capability bit constants directly after this PR.
- Keep `js/ep133/capabilityEvidence.js` as evidence semantics.
- Keep `js/ep133/evidenceRegistry.js` as the evidence database.
- Create `js/ep133/deviceCapabilities.js` — domain capability facade for a connected SKU/firmware plus FILE-advertised rights.
- Modify `js/ep133/deviceProfile.js` — consume the facade instead of independently composing write booleans.
- Modify `js/ep133/ui.js` and any sample/project controllers that interpret raw capability masks — consume domain booleans/evidence.
- Add `tests/device-capabilities.test.mjs`.

### Task 7: Add one domain capability facade

**Files:**
- Create: `js/ep133/deviceCapabilities.js`
- Modify: `js/ep133/deviceProfile.js`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- Consumes: `CAPABILITY_KEYS`, `resolveRegisteredCapabilityEvidence()`, `canReadCapability()`, `canWriteCapability()`.
- Produces:
  - `resolveDeviceCapabilities({sku='',firmware='',fileCapabilities=0}={})`
  - result fields: `sampleMetadata`, `sampleTransfers`, `sampleBars`, `projectTransport`, `projectAuthoring`, `projectReload`, plus `fileRights:{read,write,delete,move,playback}` and source evidence records.
  - Unknown/out-of-range evidence must resolve write rights to `false`.

- [ ] **Step 1: Write failing capability tests**

Cover EP-133 2.5.1 verified rights, EP-40 2.5.1 verified rights, EP-1320 unverified writes, unknown SKU, missing firmware, and firmware outside verified range.

- [ ] **Step 2: Run test and verify failure**

Run: `node --test tests/device-capabilities.test.mjs`

Expected: FAIL because facade does not exist.

- [ ] **Step 3: Implement facade without duplicating evidence rules**

The facade calls the existing evidence registry; it does not copy firmware ranges or create a second evidence table.

- [ ] **Step 4: Update `getEpDeviceProfile()` to consume the facade**

Preserve its current public shape for existing UI/controllers. `advancedSampleMetadataWrites`, `sampleTransfers`, and `sampleBars.authoring` must remain conservative.

- [ ] **Step 5: Run capability/evidence tests**

Run: `node --test tests/device-capabilities.test.mjs tests/ep133.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ep133/deviceCapabilities.js js/ep133/deviceProfile.js tests/device-capabilities.test.mjs tests/ep133.test.mjs
git commit -m "refactor: centralize EP capability resolution"
```

### Task 8: Remove raw protocol/capability interpretation from higher layers

**Files:**
- Modify: `js/ep133/ui.js`
- Modify: sample/project/UI modules found by code search importing `TE_SYSEX_FILE_CAPABILITY_*` for policy decisions.
- Modify: `js/ep133/fileProtocol.js` only for codec/validation ownership gaps found by tests.
- Modify: `tests/ep133.test.mjs`
- Test: `tests/device-capabilities.test.mjs`

**Interfaces:**
- Consumes: `resolveDeviceCapabilities()` from Task 7 and `fileProtocol.js` codec functions.
- Produces: higher layers consume named domain rights/evidence and do not derive policy by bitmask arithmetic.

- [ ] **Step 1: Add a structural test that enumerates forbidden raw capability-policy imports**

Allow raw FILE capability constants only in protocol/transport/capability modules. Fail if UI/sample/project feature modules use them to decide product policy.

- [ ] **Step 2: Run structural test and verify it identifies current imports**

Run: `node --test tests/ep133.test.mjs tests/device-capabilities.test.mjs`

Expected: FAIL until current direct policy imports are migrated.

- [ ] **Step 3: Replace higher-layer bitmask checks with domain capability fields**

Do not change wire payload encoding; transport/protocol code may still use constants where they are part of the actual protocol.

- [ ] **Step 4: Add response/payload validation only where ownership is currently duplicated**

If a higher layer manually validates FILE wire fields already represented by `fileProtocol.js`, move that validation into a named codec/parser in `fileProtocol.js` and test it there. Do not perform unrelated protocol refactors.

- [ ] **Step 5: Run unit and E2E suites**

Run: `npm test && npm run test:e2e`

Expected: PASS.

- [ ] **Step 6: Build Pages output**

Run: `npm run build:pages`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/ep133/ui.js js/ep133/fileProtocol.js js/ep133/deviceCapabilities.js tests/device-capabilities.test.mjs tests/ep133.test.mjs
git commit -m "refactor: isolate FILE protocol policy from feature code"
```

### Task 9: ZAT-6 PR verification gate

**Files:**
- No product-code changes unless verification finds a defect.

- [ ] **Step 1: Search for remaining raw capability-policy usage**

Run repository code search for `TE_SYSEX_FILE_CAPABILITY_` and classify every remaining use as wire encoding/transport or a defect. Feature/UI policy use is not allowed.

- [ ] **Step 2: Run `npm test`**

Expected: PASS.

- [ ] **Step 3: Run `npm run test:e2e`**

Expected: PASS.

- [ ] **Step 4: Run `npm run build:pages`**

Expected: PASS.

- [ ] **Step 5: Open PR tied to ZAT-6**

Document that no new firmware/SKU support is claimed by the refactor.

---

# PR 3 — ZAT-7: Composition Cleanup

## File map

The current top-level `js/app.js` already lazy-loads the EP workspace; the EP-specific composition debt is primarily in `js/ep133/ui.js`, which imports device/filesystem APIs and instantiates many controllers while retaining local safety flags. This PR therefore keeps the existing lazy-loading behavior in `app.js` and moves EP composition/safety wiring out of `ui.js` without broad converter refactoring.

- Create `js/ep133/ui/createEpWorkspace.js` — construct core/controller dependencies from injected services; no DOM discovery.
- Modify `js/ep133/ui.js` — DOM discovery + composition entry only.
- Modify `js/ep133/workspaceBootstrap.js` — consume authoritative runtime subscription instead of reconstructing FILE state by polling coordinator where possible; keep project-settle/recovery polling only where no event source exists yet.
- Modify controllers only where they currently receive redundant `isConnected`/`deviceUnsafe`/session-state inputs that can be replaced by a runtime-backed admission/session service.
- Modify `tests/ep133.test.mjs` and focused UI tests.

### Task 10: Extract EP workspace construction from `ui.js`

**Files:**
- Create: `js/ep133/ui/createEpWorkspace.js`
- Modify: `js/ep133/ui.js`
- Modify: `tests/ep133.test.mjs`

**Interfaces:**
- Consumes injected `dom`, device/filesystem services, runtime facade, and existing controller factories.
- Produces `createEpWorkspace({dom,services,showError,documentRef=globalThis.document,windowRef=globalThis.window})` returning `{dispose?, controllers, runtime}` or the minimum existing lifecycle handle needed by tests.

- [ ] **Step 1: Add structural failing tests for the new composition boundary**

Assert `ui.js` still exports `initEp133Browser({showError})`, performs DOM registry discovery, and delegates workspace construction to `createEpWorkspace()`.

Assert feature-specific transaction/safety decisions are absent from `ui.js` after extraction.

- [ ] **Step 2: Run focused structural tests**

Run: `node --test tests/ep133.test.mjs`

Expected: FAIL before extraction.

- [ ] **Step 3: Move controller/service construction without changing behavior**

Do not redesign controller interfaces beyond what Tasks 1–9 require. Preserve lazy loading from `js/app.js` and current DOM ids/event behavior.

- [ ] **Step 4: Remove local duplicate device safety authority**

Replace `ui.js`/workspace-local decisions that reconstruct `connected && !deviceUnsafe` with runtime-backed named helpers/services. Synchronization/hydration/mutating UI flags may remain local because they are UI workflow state, not device safety authority.

- [ ] **Step 5: Run unit suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ep133/ui.js js/ep133/ui/createEpWorkspace.js tests/ep133.test.mjs
git commit -m "refactor: isolate EP workspace composition"
```

### Task 11: Make workspace diagnostics consume runtime directly

**Files:**
- Modify: `js/ep133/workspaceBootstrap.js`
- Modify: `js/ep133/ui/workspaceState.js` only if its input shape must be normalized.
- Modify: relevant workspace tests in `tests/`.

**Interfaces:**
- Consumes: `getDeviceRuntimeSnapshot()`, `onDeviceRuntimeChange(listener)`.
- Produces: current workspace status view fed from one authoritative connection/operation/safety snapshot; project-runtime settling and persisted recovery summaries remain separate adjunct state until their later roadmap work.

- [ ] **Step 1: Add failing workspace test for event-driven runtime updates**

Assert a runtime state change updates workspace connection/operation/safety state without waiting for the current 200 ms coordinator poll.

- [ ] **Step 2: Run focused workspace tests**

Run the matching `node --test tests/<workspace-test>.test.mjs` file discovered in the repo; if workspace assertions currently live in `tests/ep133.test.mjs`, add the focused test there instead of creating duplicate coverage.

Expected: FAIL before runtime subscription.

- [ ] **Step 3: Subscribe workspace bootstrap to runtime**

Remove coordinator polling only for information now supplied by the authoritative runtime. Do not remove project-settle/recovery polling unless an existing event source fully replaces it.

- [ ] **Step 4: Run unit and E2E suites**

Run: `npm test && npm run test:e2e`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ep133/workspaceBootstrap.js js/ep133/ui/workspaceState.js tests
git commit -m "refactor: drive EP workspace status from runtime state"
```

### Task 12: T1 final verification and cleanup

**Files:**
- Modify only if verification identifies a real defect.

**Interfaces:**
- Completion contract: one authoritative answer for FILE-operation admission; legacy APIs are adapters or explicitly isolated compatibility surfaces.

- [ ] **Step 1: Search for independent safety decisions**

Review remaining occurrences of:

```text
isDeviceUnsafe
getDeviceSessionToken
getFileOperationCoordinatorState
ownership.canUseDevice
connectionEpoch
```

Classify each as: compatibility adapter, diagnostics/read-only consumer, or defect. Any feature code independently deciding FILE admissibility is a defect and must be migrated before T1 closes.

- [ ] **Step 2: Verify unsafe cannot be cleared by feature/UI code**

Search for runtime dispatches or helpers capable of setting safety to safe. Only the documented fresh-runtime path may reset `unsafe`.

- [ ] **Step 3: Run all unit/behavior tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 5: Build deployable Pages output**

Run: `npm run build:pages`

Expected: PASS.

- [ ] **Step 6: Compare behavior against T1 non-goals**

Confirm no intentional UI redesign, no new write command, no new firmware/SKU support claim, no recovery-store replacement, and no TypeScript migration landed.

- [ ] **Step 7: Open ZAT-7 PR and close T1 only after all three PR acceptance gates pass**

The T1 completion note should list remaining compatibility adapters intentionally retained for T2/T3 rather than deleting them opportunistically.
