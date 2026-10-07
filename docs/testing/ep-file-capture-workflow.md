# EP-series FILE/SysEx hardware capture workflow

This workflow is the only accepted path for closing ZAT-8 real-device coverage gaps. Synthetic fixtures remain useful regressions but never become hardware evidence by relabeling.

## Evidence baseline

The current public source is pinned to `icherniukh/ep133-krate@6f2a85b844387418a98f948cbd61431365c344ae` (MIT). Its raw capture corpus supports FILE INIT/LIST, PUT, DELETE and metadata GET/SET. The source's own `docs/protocol-evidence.md` marks complete official-app GET/Download wire evidence as pending. No direct pinned FILE MOVE capture or accepted raw failure trace closes the remaining classes.

Current real-device gaps:

- success: `get`, `move`
- failure: `timeout`, `late-response`, `firmware-debug`, `interrupted-session`

Do not infer missing classes from implementation code, prose, successful CLI behavior, synthetic timing, or one-sided request files.

## Before recording

1. Record device model and exact firmware before any operation.
2. Back up device content before mutation scenarios.
3. Use sacrificial sample/project slots for write/interruption experiments.
4. Close other EP tools so the capture has one controlling host.
5. Preserve the raw source capture outside the sanitized fixture.
6. Compute and retain SHA-256 of the exact raw source bytes.
7. Record capture tool/version, host OS and whether the recorder is transparent or intentionally alters timing/traffic.

A capture that intentionally injects, delays, drops or rewrites traffic must say so. Such intervention does not automatically disqualify the evidence, but the resulting class may only be called real-device when the device-side traffic and timing needed for the claim remain directly observable and auditable.

## Raw recording format

The preferred import source is bidirectional JSONL with one SysEx frame per record:

```json
{"ts": 123.456, "dir": "tx", "len": 17, "hex": "F0...F7"}
```

Raw binary captures supported by the importer are also acceptable. Never hand-copy frames into `real/`.

The existing external source used a USB/MIDI proxy and documents a command of the form:

```text
python midi_proxy.py --proxy captures/sniffer-<name>.jsonl
```

That command is a reference for provenance only. First-party SpeedUpperCut captures may use another recorder if direction, complete SysEx bytes and timing are preserved.

## Scenario boundaries

Retain enough traffic to prove the operation from start to terminal state. Do not trim away INIT, EOF/sentinel, ACK, reconnect/re-init or verification frames when they determine session meaning.

### Successful GET

Goal: close `get`.

- Start before FILE initialization for the download session.
- Download one known sample from the device.
- Keep GET init, every GET data page, terminal page/state and any reset/re-init performed by the controlling client.
- Record expected file/node id and total declared size.
- The class closes only with a complete start-to-finish device transaction. The public `evidence-download-state-bug.jsonl` excerpt is not sufficient because it starts after the missing GET transaction context.

### Native MOVE

Goal: close `move`.

- Prepare a known occupied source slot and known free destination.
- Record the UI/client action and all resulting FILE traffic.
- A capture closes native MOVE only if the raw traffic contains the FILE MOVE operation and a device response/verification that resolves source, parent and destination ids.
- If the client implements move as GET + PUT + DELETE, record it, but do not label it FILE MOVE evidence.

### Timeout

Goal: close `timeout`.

- Prefer a read-only FILE operation so no device mutation is possible.
- Record the request, the configured host timeout boundary and enough subsequent traffic to prove session continuity.
- If a proxy drops a device response after receiving it, retain both device-side and host-side timestamps. A host-only artificial drop is synthetic policy evidence, not proof that the device itself timed out.

### Late response

Goal: close `late-response`.

- Record the original request, timeout boundary and the actual matching device response arriving after that boundary.
- Preserve request id and relative timing exactly enough to reproduce stale-request classification.
- A previously captured response replayed later by test code remains synthetic and cannot close this class.

### Firmware debug

Goal: close `firmware-debug`.

- Capture the raw firmware/debug SysEx frame from the device while strict FILE work is active.
- Preserve the debug marker/framing and payload meaning.
- Log text or a hand-authored `F0 ... F7` frame is insufficient without the original raw device capture.

### Interrupted session

Goal: close `interrupted-session`.

- Use a backed-up sacrificial target.
- Start a mutation with an observable multi-frame stream such as PUT.
- Interrupt only after the mutation stream is known to have opened and before its terminal EOF/sentinel.
- Preserve the last successful TX/RX frame, the interruption event, reconnect behavior and any subsequent device/recovery verification.
- Record whether a device mutation may have occurred. Do not downgrade ambiguous state to safe.

## Import and review

Every accepted capture uses the same deterministic pipeline:

```text
raw source
  -> scripts/import-ep-file-capture.mjs
  -> source/provenance validation
  -> scenario window selection
  -> deterministic sanitization
  -> protected-wire invariant checks
  -> schema-v1 fixture
  -> focused parser/runtime test
  -> manifest entry
```

Required provenance for `real-device`:

- immutable source revision or first-party capture id;
- source path/id;
- source blob/content hash and raw SHA-256;
- license/permission status;
- capture method;
- device family/model;
- firmware, or explicit `null` when genuinely unknown.

Sanitization may remove serials and user labels only with length/semantics-preserving transforms. It must not alter command/subcommand, request correlation, status, capabilities, scenario-relevant node ids, page boundaries, Packed7 meaning, EOF/sentinel state, frame order or timing classification.

## Coverage gate

Run:

```bash
node scripts/check-ep-file-golden-coverage.mjs
```

The checker must exit nonzero while any required class lacks validated `real-device` evidence. Synthetic fixtures may appear in `manifest.json`, but they never satisfy the gate.

ZAT-8 remains In Progress until the checker reports no missing success or failure classes.
