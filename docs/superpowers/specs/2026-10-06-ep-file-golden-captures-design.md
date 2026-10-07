# SpeedUpperCut EP FILE/SysEx Golden Captures — Design

Date: 2026-10-06
Status: Approved design, pending written-spec review
Roadmap: Technical Debt / T2 — Verification & recovery
Primary issue: ZAT-8 — Build real-device FILE/SysEx golden capture suite
Base: `main` at `884bfcd76767cecd2d9fb5a68f94ff59ce7d021a`
Branch: `feat/zat-8-golden-captures`

## 1. Purpose

ZAT-8 creates a versioned regression corpus built from real EP-series MIDI/SysEx traffic so SpeedUpperCut can prove that its FILE codec, transport expectations and authoritative runtime transitions continue to match hardware-observed behavior.

The core requirement is evidence integrity. A synthetic test may be useful, but it must never be presented as a real-device golden capture. Every fixture that counts toward ZAT-8 hardware coverage must carry verifiable provenance back to an actual device capture.

## 2. Success criteria

ZAT-8 is complete only when all of the following are true:

1. A versioned fixture format exists for bidirectional EP-series SysEx traces.
2. Every `real-device` fixture has source provenance sufficient to independently locate the original capture.
3. Sanitization removes sensitive/device-specific values without changing protocol semantics.
4. Real-device success fixtures cover FILE INIT, LIST, GET, PUT, MOVE, DELETE and metadata GET/SET.
5. Real-device failure fixtures cover timeout, late response, firmware debug and interrupted-session behavior.
6. Parsers/encoders and authoritative runtime transitions are regression-tested against the fixture corpus.
7. Synthetic fixtures remain clearly separated and cannot satisfy real-device coverage gates.
8. No new write capability, firmware claim or protocol behavior is introduced merely because a third-party implementation supports it.

## 3. Non-goals

ZAT-8 does not:

- change production FILE/SysEx wire behavior;
- add new device write commands;
- broaden supported SKU/firmware ranges;
- replace the fake EP harness;
- perform the full hardware-in-the-loop release matrix planned for ZAT-9;
- claim that every community trace is authoritative without provenance review;
- decompile firmware;
- convert synthetic traces into `real-device` fixtures by relabeling them.

## 4. Evidence hierarchy

For this work the evidence hierarchy is:

1. Captures produced directly from an EP-series device and the official Teenage Engineering EP Sample Tool, with reproducible source provenance.
2. Captures produced directly from an EP-series device by a documented independent client, when the scenario and command sequence are unambiguous.
3. Published protocol analysis that points to specific capture evidence.
4. Independent community implementations without an attached capture.
5. Synthetic SpeedUpperCut tests.

Only levels 1–2 may be stored with `provenance.kind = "real-device"`.

Levels 3–5 can inform analysis and synthetic regression tests but do not close a real-device coverage requirement.

## 5. Initial external evidence source

The initial public capture source is:

- repository: `icherniukh/ep133-krate`
- project states that its EP-133 protocol was reverse-engineered from USB captures of the official EP Sample Tool;
- repository contains a `captures/` directory with bidirectional JSONL traces;
- capture records contain timestamp, direction, length and full SysEx hex;
- repository is MIT licensed.

Imported evidence must pin an immutable source commit SHA, not `main`.

The source repository's conclusions are not automatically adopted as SpeedUpperCut protocol truth. We import captured traffic as evidence and run it through our own parsers/state expectations.

## 6. Fixture layout

Version 1 lives under:

```text
tests/fixtures/ep-series/file-traces/v1/
  README.md
  manifest.json
  real/
    <fixture-id>.json
  synthetic/
    <fixture-id>.json
  attribution/
    ep133-krate-MIT.txt
```

`manifest.json` is the coverage/index authority. Tests must not infer provenance from directory names alone.

Future incompatible schema changes create `v2/`; existing fixtures remain immutable except for corrections with an explicit migration note.

## 7. Golden fixture schema

Each fixture is a JSON document with the following logical shape:

```json
{
  "schemaVersion": 1,
  "id": "ep133-official-list-001",
  "provenance": {
    "kind": "real-device",
    "source": {
      "repository": "icherniukh/ep133-krate",
      "commit": "<40-char SHA>",
      "path": "captures/<file>.jsonl",
      "blobSha": "<source blob SHA>",
      "license": "MIT"
    },
    "captureMethod": "official-app-proxy",
    "device": {
      "family": "EP-series",
      "model": "EP-133",
      "firmware": "2.0.5"
    }
  },
  "sanitization": {
    "version": 1,
    "sourceDigest": "sha256:<digest>",
    "fixtureDigest": "sha256:<digest>",
    "transforms": []
  },
  "scenario": {
    "operation": "list",
    "outcome": "success",
    "description": "..."
  },
  "frames": [
    {
      "index": 0,
      "direction": "tx",
      "deltaMs": 0,
      "hex": "F0...F7"
    }
  ],
  "expectations": {
    "wire": {},
    "runtime": []
  }
}
```

Fields may grow additively within schema v1, but the required provenance/sanitization fields cannot be weakened.

## 8. Provenance requirements

A fixture may use `provenance.kind = "real-device"` only if all required provenance fields validate.

Required fields:

- exact repository or source identifier;
- immutable commit/revision;
- original path or capture identifier;
- original blob/content hash;
- capture method;
- device model/family when known;
- firmware when known, otherwise explicit `null`/`unknown` rather than an inferred value;
- source license/permission status.

A fixture with missing provenance is rejected by the fixture loader instead of silently downgraded.

Synthetic fixtures use:

```json
"provenance": {
  "kind": "synthetic",
  "generator": "speeduppercut",
  "basis": "<description or real fixture id if derived>"
}
```

Synthetic fixtures are valid tests but are excluded from real-device coverage accounting.

## 9. Sanitization contract

Sanitization is deterministic, auditable and semantics-preserving.

It may sanitize:

- device serial numbers;
- user sample/project names when they are not semantically relevant;
- host/device port labels;
- absolute wall-clock timestamps;
- other personally identifying or machine-specific labels.

It must preserve:

- SysEx manufacturer/product/family bytes;
- FILE command/subcommand bytes;
- request/response ID relationships;
- status codes;
- FILE capability bits;
- node/slot relationships required by the scenario;
- payload lengths and page boundaries;
- Packed7 structure and decode result shape;
- EOF/sentinel frames;
- ordering of TX/RX traffic;
- relative timing where timeout/late classification depends on it;
- debug-frame marker and payload meaning;
- state-machine meaning of the sequence.

### 9.1 Length-preserving replacements

When a sensitive value exists inside a wire payload, replacement must preserve decoded byte length. If the payload is Packed7 encoded, the sanitizer operates on decoded bytes and re-encodes them, asserting that encoded framing/page boundaries remain protocol-equivalent.

Example: a 7-character serial is replaced by a deterministic 7-character ASCII token, not removed.

### 9.2 Request IDs

Request IDs are not considered sensitive. They should normally remain exactly as captured because their relationship is part of the golden evidence.

If a future source requires ID anonymization, it must be an explicit schema-versioned transform that preserves one-to-one TX/RX correlation. v1 does not do this.

### 9.3 Time

Absolute timestamps are removed. Fixtures store `deltaMs` from the first retained frame.

For ordinary success fixtures exact millisecond timing is diagnostic only. For timeout/late-response fixtures, relative timing class is semantic and must be retained closely enough for the test to reproduce the classification boundary.

## 10. Import pipeline

Real captures are never hand-copied directly into `real/`.

The import flow is:

```text
source capture
  -> parse source format
  -> select scenario frame window
  -> normalize directions/timestamps
  -> sanitize sensitive fields
  -> validate protocol invariants
  -> compute source + fixture digests
  -> emit fixture JSON
  -> validate manifest coverage
```

The importer is deterministic: same source revision + same scenario selector + same sanitizer version must produce byte-identical fixture output.

The importer must fail closed if:

- a source record cannot be parsed;
- an expected SysEx frame becomes malformed;
- sanitization changes a protected protocol field;
- source provenance cannot be pinned;
- a `real-device` fixture contains an unapproved transform.

## 11. Fixture loader and validator

Add a small test-only loader/validator under `tests/helpers/`.

Responsibilities:

- load schema v1 fixtures;
- reject unknown schema versions;
- validate provenance fields;
- validate even-length hexadecimal bytes and `F0 ... F7` SysEx framing where applicable;
- validate monotonically nondecreasing `deltaMs`;
- expose frames as `Uint8Array`;
- expose coverage metadata;
- refuse to count `synthetic` fixtures as real-device evidence.

The loader is test infrastructure only and is not imported by production code.

## 12. Replay model

The existing `tests/helpers/file-trace-replay.mjs` remains useful but currently consumes hand-authored FILE request payloads rather than full golden SysEx evidence.

ZAT-8 adds an adapter from a golden fixture to the existing fake EP harness.

Replay has two layers:

1. **Wire/parsing regression** — full captured SysEx frames are parsed with SpeedUpperCut's real protocol parsers and compared with fixture expectations.
2. **Behavior/runtime regression** — selected FILE request/response frames are fed through the fake EP harness so normal production transport/runtime code experiences the captured sequence.

The adapter must not reinterpret a capture to make current code pass. Unsupported or contradictory evidence is a failing test/investigation item.

## 13. Success-operation coverage

The real-device manifest tracks these required operation classes:

```text
init
list
get
put
move
delete
metadata-get
metadata-set
```

A fixture can cover multiple classes only when the capture clearly contains each operation and the manifest records the corresponding frame ranges.

Coverage means actual captured TX/RX evidence, not simply that SpeedUpperCut can generate the request bytes.

## 14. Failure corpus

Required real-device failure classes:

```text
timeout
late-response
firmware-debug
interrupted-session
```

Each failure fixture records:

- what operation was active;
- which frame was last successfully sent/received;
- whether a mutation may have occurred;
- expected runtime classification (`safe`, `blocked`, `recovery-required`, or `unsafe`);
- evidence basis for that classification.

If no real capture exists for a required failure class, ZAT-8 remains incomplete for that acceptance item. A synthetic fixture may be added meanwhile but must remain labeled synthetic.

## 15. Authoritative runtime assertions

Golden behavior tests target the runtime model introduced in T1.

Examples:

- successful read: `ready -> reading -> ready`;
- successful mutation/readback: `ready -> mutating -> verifying -> ready`;
- read timeout with proven no mutation: returns to safe/idle if session continuity remains proven;
- atomic mutation timeout with uncertain effect: at least `recovery-required`;
- interrupted PUT/paged metadata stream with unknown session continuity: `unsafe`;
- firmware debug frame during strict FILE operation: `unsafe`;
- late frame from expired/stale request does not mutate the current epoch and is classified according to the existing late-response policy.

The fixture does not directly set runtime state. Production transport/runtime code must arrive at the asserted result.

## 16. Capture source trust and attribution

Third-party capture data may be imported only when redistribution/use is permitted.

For `icherniukh/ep133-krate`:

- record exact source commit/blob for every imported scenario;
- retain MIT attribution under `tests/fixtures/ep-series/file-traces/v1/attribution/`;
- note source transformations in fixture metadata;
- do not copy unrelated source code when captured bytes alone are sufficient.

Attribution/provenance metadata is not optional test decoration; it is part of evidence integrity.

## 17. Existing synthetic replay test

`tests/filesystem-capture-replay.behavior.test.mjs` is explicitly classified as synthetic.

It remains valuable for deterministic FILE behavior but:

- is not renamed to imply hardware provenance;
- does not count toward the manifest's `real-device` coverage;
- may later be converted to consume fixtures from `synthetic/` for schema consistency.

## 18. Test strategy

TDD applies to the fixture infrastructure.

At minimum add tests for:

1. fixture validator rejects malformed/missing provenance;
2. fixture validator rejects a synthetic fixture when requested as real evidence;
3. sanitizer is deterministic;
4. sanitizer removes known serial/name values;
5. sanitizer preserves protected command/request/status/length/page invariants;
6. fixture digest changes when evidence bytes change;
7. manifest coverage accounting distinguishes real vs synthetic;
8. a real INIT/LIST fixture parses through production protocol code;
9. operation fixtures replay through the fake EP harness where supported;
10. failure fixtures drive the expected runtime transition;
11. all existing unit/E2E/build tests remain green.

## 19. Review gates

Before a real fixture is accepted:

- provenance validates;
- source is pinned to immutable revision;
- sanitizer diff is reviewable;
- no sensitive values remain;
- protected protocol invariants match source;
- fixture has an explicit operation/outcome classification;
- parser/runtime assertions pass.

Before ZAT-8 is Done:

- all success operation classes have real-device coverage;
- all four required failure classes have real-device coverage;
- `npm test` passes;
- `npm run test:e2e` passes;
- `npm run build:pages` passes;
- PR review confirms no production protocol behavior was changed merely to conform to a third-party interpretation.

## 20. Relationship to ZAT-9

ZAT-8 provides deterministic recorded evidence.

ZAT-9 will provide live hardware-in-the-loop verification across the critical write matrix. A golden capture proves that our parser/state model remains consistent with previously observed hardware traffic; it does not prove a future firmware/device still behaves that way.

Therefore ZAT-8 is a prerequisite for, not a substitute for, ZAT-9.
