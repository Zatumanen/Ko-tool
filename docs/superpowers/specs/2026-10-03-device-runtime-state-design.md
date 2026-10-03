# SpeedUpperCut Device Runtime State — Design

Date: 2026-10-03
Status: Approved design, pending written-spec review
Roadmap: Technical Debt / T1 — Safety foundation
Primary issue: ZAT-5 — Define authoritative device/session/transaction state machine
Follow-on issues: ZAT-6, ZAT-7

## 1. Purpose

SpeedUpperCut currently has several overlapping sources of truth for whether the connected EP-series device can safely accept FILE traffic:

- `device.js` owns WebMIDI connection state, `connectionEpoch`, request lifecycle and the device-wide unsafe lock.
- `deviceOperationCoordinator.js` owns active FILE-operation state and external FILE-interference blocking.
- `ui/deviceSessionOwnership.js` owns cross-tab ownership through Web Locks/BroadcastChannel.
- `ui/sessionGuard.js` protects long-running UI operations with a derived session token.
- sample/project transaction and recovery modules persist mutation/recovery evidence.

This design introduces one authoritative runtime state model without replacing these mechanisms in a single step. The migration uses a strangler approach: existing public APIs remain compatible while they are progressively backed by one authoritative runtime snapshot.

The goal of T1 is not to change product behavior or add features. The goal is to make one component answer the safety question:

> Can SpeedUpperCut perform this FILE operation on this EP right now?

## 2. Non-goals

T1 does not:

- redesign UI/UX;
- add new EP write features;
- change the FILE/SysEx wire protocol;
- replace persisted recovery journals;
- remove Web Locks/BroadcastChannel ownership;
- migrate the entire application to TypeScript;
- perform the HIL/golden-capture work planned for T2.

These constraints keep the refactor behavior-preserving and reviewable.

## 3. Chosen approach

Use a strangler migration.

A new core module, tentatively `js/ep133/deviceRuntimeState.js`, becomes the authoritative owner of runtime safety state. Existing modules publish events into it. Existing public APIs are initially preserved as compatibility adapters and checked against the new runtime during migration.

This is preferred over:

1. Big-bang replacement — cleaner in theory but too risky for code that performs destructive device mutations.
2. Extending `deviceOperationCoordinator.js` — lower immediate effort but leaves connection, ownership, recovery and coordinator state as independent authorities.

## 4. Runtime model

The runtime snapshot contains orthogonal state dimensions rather than one combinatorial enum.

### 4.1 Connection

```text
connection:
  disconnected
  connecting
  connected
```

Connection owns:

- `connectionEpoch`;
- connected device identity;
- input/output session identity;
- SKU/firmware/device key when known.

### 4.2 Ownership

```text
ownership:
  none
  owned
  blocked
```

Ownership reflects whether this SpeedUpperCut browser instance is permitted to operate the EP. Web Locks/BroadcastChannel remain the implementation mechanism, but they no longer independently determine FILE safety outside the runtime.

### 4.3 FILE operation

```text
operation:
  idle
  reading
  mutating
  verifying
```

Only one FILE operation lease may be active at a time.

### 4.4 Safety

```text
safety:
  safe
  blocked
  recovery-required
  unsafe
```

Meaning:

- `safe`: the runtime has no known safety blocker.
- `blocked`: operation is prohibited but device corruption/session ambiguity has not been proven. Example: unexpected FILE traffic while idle or another SpeedUpperCut tab owns the session.
- `recovery-required`: a mutation may have taken effect but the final state is not yet authoritatively proven.
- `unsafe`: FILE-session continuity is unknown or a critical protocol/debug condition occurred; fail closed until a fresh physical/device session is established according to the recovery rule.

## 5. Derived status

The public snapshot may expose a derived `status` for diagnostics/UI. Priority is strict:

```text
unsafe
recovery-required
blocked
connecting
verifying
mutating
reading
ready
disconnected
```

A lower-priority state can never mask a higher-priority safety condition. For example, an operation finishing while recovery remains unresolved must not produce `ready`.

## 6. Authoritative context

The runtime keeps enough context to validate stale events and explain blocking conditions:

```text
connectionEpoch
deviceIdentity
activeOperation
externalInterference
unsafeReason
recoveryTransaction
```

`activeOperation` includes at least:

- operation id;
- label;
- mode (`read` or `mutation`);
- phase;
- captured epoch;
- start timestamp.

The runtime must not retain raw audio/sample binary payloads.

## 7. Event model

Producers emit explicit events rather than mutating runtime fields directly.

Initial event vocabulary:

```text
OWNERSHIP_ACQUIRED
OWNERSHIP_LOST
OWNERSHIP_BLOCKED
CONNECT_STARTED
DEVICE_CONNECTED
DEVICE_DISCONNECTED
FILE_OPERATION_STARTED
FILE_OPERATION_VERIFYING
FILE_OPERATION_FINISHED
FILE_OPERATION_FAILED
UNEXPECTED_FILE_TRAFFIC
FIRMWARE_DEBUG_DETECTED
DEVICE_MARKED_UNSAFE
RECOVERY_REQUIRED
RECOVERY_VERIFIED
RECOVERY_ACKNOWLEDGED
```

Events that belong to a device session or operation must carry the captured `connectionEpoch`; operation events also carry `operationId`.

Stale events from a previous epoch are ignored or rejected deterministically and must never mutate the current device session.

## 8. Core invariants

### 8.1 Mutation admission

A mutation is allowed only when all are true:

```text
connection == connected
ownership == owned
operation == idle
safety == safe
device identity is verified
```

No feature/controller may bypass this gate.

### 8.2 Read admission

Reads require a valid connected/owned session and an idle operation slot. Reads are prohibited when safety is `unsafe` or `recovery-required`.

A `blocked` state is also non-admissible until its documented clearing transition occurs.

### 8.3 Single active FILE lease

The scheduler may queue work, but the runtime may hold only one active FILE operation lease.

Beginning an operation while another lease is active is an invalid transition.

### 8.4 Epoch binding

Every operation lease is permanently bound to the `connectionEpoch` that created it.

A disconnect/reconnect invalidates all prior leases. Late Promise callbacks and late MIDI responses from an older epoch cannot change current runtime state.

### 8.5 External FILE interference

Unexpected FILE response while an operation is active:

```text
-> unsafe
```

Unexpected FILE response while idle:

```text
safe -> blocked
```

This preserves current fail-closed coordinator behavior.

### 8.6 Timeout classification

A timeout is classified using mutation evidence, not merely the fact that a timeout occurred.

- read timeout with proven absence of mutation may return to safe/idle;
- mutation request timed out after dispatch and final effect is not proven -> `recovery-required` at minimum;
- interrupted FILE_PUT stream or interrupted paged metadata stream when session continuity cannot be proven -> `unsafe`.

Existing more-conservative behavior wins during migration.

### 8.7 Recovery authority

Recovery journals provide evidence; they do not directly declare the runtime safe.

A verifier may emit `RECOVERY_VERIFIED` with authoritative evidence. The runtime decides whether that evidence permits a transition away from `recovery-required`.

### 8.8 Unsafe clearing

Feature/UI code cannot directly clear `unsafe`.

There is no generic `resetUnsafe()` API.

Unsafe state is cleared only through the documented fresh-session path: physical/device disconnect or required power-cycle, new connection epoch, fresh identity/preflight, and no unresolved recovery blocker.

### 8.9 Conservative conflict resolution

During shadow migration, if legacy safety state and runtime safety state disagree, the stricter state wins.

Examples:

```text
legacy unsafe + runtime safe -> unsafe
legacy safe + runtime unsafe -> unsafe
legacy blocked + runtime safe -> blocked
```

No optimistic reconciliation is allowed.

## 9. Component responsibilities

### 9.1 `deviceRuntimeState.js`

Owns:

- runtime snapshot;
- event reducer/transition validation;
- operation admission checks;
- epoch/operation stale-event checks;
- derived status;
- immutable snapshots;
- state-change subscription.

Does not:

- call WebMIDI;
- send SysEx;
- persist recovery records;
- own UI rendering;
- own Web Locks/BroadcastChannel directly.

### 9.2 `device.js`

Continues to own:

- WebMIDI access;
- physical connection discovery;
- identity SysEx;
- raw request/response lifecycle;
- request IDs/timeouts;
- firmware debug frame detection.

It publishes connection/debug/session events to the runtime.

Existing `isConnected()`, `isDeviceUnsafe()`, `getDeviceSessionToken()` remain temporarily available as compatibility APIs.

### 9.3 `deviceOperationCoordinator.js`

Transitions from independent state authority to an operation-lease facade.

It remains responsible for ergonomic operation lifecycle helpers such as:

```text
begin()
setPhase()
close()
run()
```

Admission and safety decisions delegate to runtime state.

Its existing public shape is preserved in the first migration step where practical.

### 9.4 `fileTransport.js`

Remains the FILE transport boundary.

It continues to own scheduling, browser FILE locks, chunking and transaction leases, but it asks runtime/coordinator for permission instead of maintaining independent safety interpretations.

### 9.5 `deviceSessionOwnership.js`

Remains responsible for cross-tab coordination through Web Locks/BroadcastChannel.

It publishes ownership changes into the runtime. It does not determine device write safety by itself.

### 9.6 `sessionGuard.js`

Remains temporarily as a compatibility guard for current controllers.

Long-term it can be implemented with runtime epoch capture/assertion rather than independently assembled tokens.

### 9.7 Recovery journals/verifiers

Sample/project journals continue to persist what happened.

Recovery verifiers continue to establish authoritative device evidence.

They publish recovery-required/verified/acknowledged events to runtime rather than directly controlling global device safety.

## 10. State flows

### 10.1 Normal read

```text
disconnected
  -> CONNECT_STARTED
connecting
  -> DEVICE_CONNECTED
ready
  -> FILE_OPERATION_STARTED(read)
reading
  -> FILE_OPERATION_FINISHED
ready
```

### 10.2 Normal mutation

```text
ready
  -> FILE_OPERATION_STARTED(mutation)
mutating
  -> FILE_OPERATION_VERIFYING
verifying
  -> FILE_OPERATION_FINISHED
ready
```

### 10.3 Failed mutation with proven no-effect

```text
mutating
  -> FILE_OPERATION_FAILED(no mutation evidence)
ready
```

This transition is allowed only when the caller can prove the device was not mutated.

### 10.4 Ambiguous mutation

```text
mutating
  -> FILE_OPERATION_FAILED(possible mutation)
recovery-required
  -> RECOVERY_VERIFIED(proven safe)
ready
```

If verification finds residual effects, safety remains `recovery-required` until the supported recovery procedure is completed and verified.

### 10.5 Protocol/session failure

```text
reading|mutating|verifying
  -> FIRMWARE_DEBUG_DETECTED / critical external interference
unsafe
```

No normal feature event can return `unsafe` directly to `ready`.

## 11. Migration plan for T1

T1 is implemented in three independent reviewable PRs.

### PR 1 — ZAT-5: authoritative runtime state machine

Add:

```text
js/ep133/deviceRuntimeState.js
tests/device-runtime-state.test.mjs
```

Integrate runtime event publication into the existing connection, coordinator, ownership and recovery boundaries while keeping existing APIs operational.

Run in shadow/compatibility mode first. Existing tests must continue to pass.

Add contract tests that compare legacy API safety/session answers with the new runtime where the concepts overlap.

No UI changes and no new device mutation features.

### PR 2 — ZAT-6: protocol/capability ownership

Create/clarify a single protocol/spec boundary for:

- FILE commands/subcommands;
- payload builders/parsers;
- response/status validation;
- metadata wire representation;
- capability interpretation;
- SKU/firmware capability mapping.

Higher-level sample/project/recovery/UI modules consume domain APIs rather than reinterpreting raw protocol details.

This PR must not broaden supported firmware/device behavior without evidence.

### PR 3 — ZAT-7: composition cleanup

Reduce `app.js` to composition/orchestration responsibilities.

It should primarily:

```text
create runtime
create device/transport services
create sample workspace
create project workspace
bind UI
start application
```

Safety decisions, transaction decisions and mutation behavior belong to the appropriate core/domain services, not the composition root.

## 12. Compatibility strategy

The migration is intentionally additive before it is subtractive.

Temporarily retain:

```text
isConnected()
isDeviceUnsafe()
getDeviceSessionToken()
getFileOperationCoordinatorState()
```

Where possible, adapters begin reading from the runtime snapshot after equivalence is proven.

Removal/deprecation of legacy state is not required to land the first ZAT-5 PR. It is allowed only once tests demonstrate that the runtime is authoritative and consumers have migrated safely.

## 13. Testing strategy

TDD is required for implementation.

At minimum, runtime unit tests cover:

```text
connect -> ready
disconnect -> stale lease rejected
read -> ready
mutation -> verifying -> ready
mutation timeout -> recovery-required
interrupted PUT -> unsafe
unexpected FILE while idle -> blocked
unexpected FILE while active -> unsafe
ownership lost -> FILE operations blocked
late event from previous epoch -> ignored/rejected
verified recovery -> ready
invalid transition -> rejected
second simultaneous operation -> rejected
unsafe cannot be cleared by ordinary feature event
```

Existing suites must remain green, especially:

- device-operation coordinator tests;
- device-session ownership tests;
- session guard/controller tests;
- sample recovery tests;
- project recovery/write tests;
- fake EP behavior tests;
- Playwright E2E.

No legacy test expectation may be weakened simply to accommodate the refactor.

## 14. Error handling

Invalid transitions are programmer/domain errors and must fail deterministically with structured SpeedUpperCut errors where the current error framework supports them.

Runtime transition failures must include enough diagnostic detail to identify:

- event type;
- current connection epoch;
- current derived status;
- active operation id when applicable;
- rejected operation/event id when applicable.

Diagnostic errors must not expose raw audio/sample binary data or unnecessary device identifiers.

## 15. Observability

The runtime exposes immutable snapshots and state-change subscription so tests and diagnostics can observe transitions.

T1 does not require a new user-facing UI. Existing diagnostics may surface runtime state if useful, but no UI redesign is part of this work.

The runtime must not depend on DOM APIs.

## 16. Security and safety posture

This subsystem controls writes to physical hardware, so safety takes priority over availability.

Rules:

- ambiguity fails closed;
- stale events cannot mutate a new session;
- unresolved recovery blocks further FILE work;
- unknown firmware/capability behavior is not inferred optimistically;
- operation safety cannot be overridden from presentation code;
- runtime state is not reset merely because a UI view was reloaded/re-rendered.

## 17. Completion criteria for T1

T1 is complete when all of the following are true:

1. There is one authoritative runtime answer for FILE-operation admissibility.
2. Connection, ownership, operation, safety and recovery state are represented explicitly.
3. Operation leases are epoch-bound and stale callbacks cannot affect a new session.
4. Existing unsafe/interference protections are preserved or strengthened.
5. Recovery evidence flows through the runtime instead of bypassing it.
6. Legacy public APIs either delegate to runtime state or are explicitly isolated compatibility adapters.
7. Existing unit/behavior/E2E suites remain green.
8. ZAT-5, ZAT-6 and ZAT-7 acceptance criteria are satisfied without adding unrelated feature work.

## 18. Relationship to later roadmap work

T1 deliberately creates the contract needed by later technical-debt work:

- T2 golden FILE/SysEx captures can assert runtime transitions against real traffic.
- T2 HIL tests can use the same runtime safety model for release gates.
- generalized transaction/recovery work can emit one shared set of recovery events.
- typed core contracts can type this state/event API without redesigning it again.
- UI/UX global device status can later consume the authoritative snapshot instead of reconstructing state from multiple services.

This makes T1 a prerequisite architecture layer rather than an isolated refactor.
