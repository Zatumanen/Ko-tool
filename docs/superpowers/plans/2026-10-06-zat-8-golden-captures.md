# ZAT-8 EP FILE/SysEx Golden Captures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict-provenance, versioned real-device EP-series FILE/SysEx fixture corpus with deterministic sanitization, parser/replay regression tests, and fail-closed coverage accounting.

**Architecture:** Keep all fixture/import/replay machinery in test/tooling code; production FILE/SysEx behavior is unchanged. Normalize captured bidirectional SysEx into schema-v1 JSON fixtures, preserve evidence provenance and protocol semantics through deterministic sanitization, then exercise production parsers, fake-MIDI transport, and T1 runtime state against those fixtures. Real-device and synthetic evidence remain separate, and a final coverage gate may pass only when every ZAT-8 required class is backed by real-device provenance.

**Tech Stack:** Browser ES modules, Node.js `node:test`, Web MIDI/SysEx test harness, existing `parseTeSysex()` / FILE protocol helpers, JSON/JSONL, Node `crypto`, Playwright 1.55, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-06-ep-file-golden-captures-design.md`

## Global Constraints

- Do not change production FILE/SysEx wire behavior to make a third-party capture pass.
- Do not add new EP write commands or broaden supported SKU/firmware ranges.
- `provenance.kind = "real-device"` requires immutable source revision, source path/id, source content/blob hash, capture method, device family/model, firmware when known, and license/permission status.
- Synthetic fixtures never satisfy real-device coverage.
- Sanitization is deterministic and auditable.
- Sanitization may remove device serials, user names/labels and absolute timestamps, but must preserve manufacturer/product/family bytes, FILE command/subcommand, request/response correlation, status, capability bits, node/slot relations required by the scenario, payload lengths/page boundaries, Packed7 semantics, EOF/sentinels, ordering, timing class, debug meaning and state-machine meaning.
- v1 does not anonymize request IDs.
- Absolute timestamps are removed; `deltaMs` is retained, and timing-sensitive fixtures preserve the classification boundary.
- A missing real capture remains an explicit coverage gap; do not relabel synthetic evidence to close it.
- Initial public source is pinned to `icherniukh/ep133-krate@6f2a85b844387418a98f948cbd61431365c344ae` (MIT). Its own evidence matrix explicitly marks official-app GET capture as pending, so public evidence alone is not assumed to close ZAT-8.
- Existing hand-authored `tests/filesystem-capture-replay.behavior.test.mjs` remains synthetic.

## Review Focus

1. **Sanitizer changes protected wire semantics** — test byte lengths, command/subcommand, request IDs, status, page numbers and Packed7 decode before/after every approved transform in Task 2.
2. **Source provenance silently drifts** — fixture validation rejects mutable refs, missing 40-char commit SHAs, missing blob/content hashes and source digest mismatches in Tasks 1–3.
3. **A mixed capture window is mislabeled as one operation** — importer requires explicit frame selection plus operation assertions; success fixture tests prove the selected FILE op(s) in Task 4.
4. **Synthetic evidence accidentally closes a hardware requirement** — coverage accounting counts only validated `real-device` fixtures; tested in Tasks 1 and 7.
5. **Timing normalization changes timeout/late-response meaning** — timing-sensitive fixtures preserve relative delay/classification and runtime tests exercise the boundary in Task 6.

---

### Task 1: Schema-v1 fixture loader, validator and coverage model

**Files:**
- Create: `tests/helpers/ep-file-golden-fixtures.mjs`
- Create: `tests/ep-file-golden-fixtures.test.mjs`
- Create: `tests/fixtures/ep-series/file-traces/v1/README.md`
- Create: `tests/fixtures/ep-series/file-traces/v1/manifest.json`
- Create directories through fixture files later: `tests/fixtures/ep-series/file-traces/v1/real/`, `synthetic/`, `attribution/`

**Interfaces:**
- Produces `loadGoldenFixture(fileUrl, {requireReal=false}={}) -> Promise<GoldenFixture>`.
- Produces `validateGoldenFixture(value, {requireReal=false}={}) -> GoldenFixture`.
- Produces `decodeFixtureFrame(frame) -> Uint8Array`.
- Produces `loadGoldenManifest(fileUrl) -> Promise<GoldenManifest>`.
- Produces `summarizeRealCoverage(manifest, fixtures) -> {covered:Set<string>, missing:Set<string>}`.
- Required real success classes: `init`, `list`, `get`, `put`, `move`, `delete`, `metadata-get`, `metadata-set`.
- Required real failure classes: `timeout`, `late-response`, `firmware-debug`, `interrupted-session`.

- [ ] **Step 1: Write failing schema/provenance tests.** Add tests named `schema v1 validates a real-device fixture`, `real-device provenance requires immutable source identity`, `synthetic fixture is rejected when real evidence is required`, `frame hex and monotonic deltaMs are validated`, and `coverage counts real evidence only`. Use an in-test minimal fixture; assert unknown schema, mutable/missing commit, malformed hex, non-SysEx framing, decreasing `deltaMs`, and synthetic-as-real all throw.
- [ ] **Step 2: Run `node --test tests/ep-file-golden-fixtures.test.mjs`.** Expected: FAIL because helper does not exist.
- [ ] **Step 3: Implement the loader/validator interfaces.** Return frozen fixture/manifest records; validate 40-char lowercase/uppercase hex SHA, nonempty source path, blob/content hash, license, capture method, explicit device firmware `null` when unknown, even-length frame hex, `F0...F7` framing, and nondecreasing nonnegative `deltaMs`.
- [ ] **Step 4: Implement coverage accounting.** Only fixture IDs whose validated provenance kind is `real-device` may populate `covered`; a manifest entry pointing to synthetic evidence stays missing.
- [ ] **Step 5: Add the v1 README and empty manifest structure.** Document schema, required classes and the rule that current hand-authored replay tests are synthetic; do not claim any real coverage yet.
- [ ] **Step 6: Run `node --test tests/ep-file-golden-fixtures.test.mjs`.** Expected: PASS.
- [ ] **Step 7: Commit:** `test: define strict EP golden fixture contract`.

### Task 2: Deterministic JSONL importer and semantics-preserving sanitizer

**Files:**
- Create: `tests/helpers/ep-file-capture-import.mjs`
- Create: `scripts/import-ep-file-capture.mjs`
- Create: `tests/ep-file-capture-import.test.mjs`

**Interfaces:**
- Consumes `parseTeSysex(bytes)` from `js/ep133/sysex.js` for TE frames; universal identity/debug frames remain raw SysEx evidence.
- Produces `parseCaptureJsonl(text) -> CaptureRecord[]`, where each retained record has `{direction:'tx'|'rx', timestampMs:number|null, bytes:Uint8Array}`.
- Produces `normalizeCaptureWindow(records, {start,end}) -> NormalizedFrame[]` with zero-based nonnegative `deltaMs`.
- Produces `sanitizeCaptureFrames(frames, {rules=[]}={}) -> {frames, transforms}`.
- Produces `buildGoldenFixture({id, provenance, scenario, frames, expectations, sanitizerVersion=1}) -> GoldenFixture` with `sourceDigest` and `fixtureDigest` using SHA-256.
- CLI `node scripts/import-ep-file-capture.mjs --source <path> --descriptor <json> --out <fixture.json>` reads local pinned-source bytes and emits one deterministic fixture.

- [ ] **Step 1: Write failing importer tests.** Cover valid JSONL direction/hex parsing, malformed source line rejection, normalized `deltaMs`, deterministic output, and digest stability.
- [ ] **Step 2: Write failing sanitizer invariant tests.** Use a TE frame containing a known serial/name token. Assert approved replacement removes the original token while preserving decoded payload byte length; assert command, request ID, response status, FILE subcommand/page fields and wire frame count/order remain unchanged. Add a Packed7 case and reject any rule whose replacement length differs.
- [ ] **Step 3: Run `node --test tests/ep-file-capture-import.test.mjs`.** Expected: FAIL because importer/sanitizer do not exist.
- [ ] **Step 4: Implement JSONL parsing and normalization.** Accept the pinned source format `{ts,dir,len,hex,...}`; verify declared `len` when present; reject non-hex, length mismatch and unknown direction.
- [ ] **Step 5: Implement deterministic sanitizer.** Rules identify exact decoded ASCII byte spans or explicitly approved raw spans. Decode/re-encode Packed7 only through existing project packing functions; fail if protected parsed fields or lengths change after transform.
- [ ] **Step 6: Implement SHA-256 digest generation and CLI descriptor validation.** Digest the exact source bytes supplied to the importer and canonical fixture content excluding its own `fixtureDigest`, then write deterministic pretty JSON with trailing newline.
- [ ] **Step 7: Run `node --test tests/ep-file-capture-import.test.mjs tests/ep-file-golden-fixtures.test.mjs`.** Expected: PASS.
- [ ] **Step 8: Commit:** `test: add deterministic EP capture importer`.

### Task 3: Pin external evidence, attribution and source audit

**Files:**
- Create: `tests/fixtures/ep-series/file-traces/v1/attribution/ep133-krate-MIT.txt`
- Create: `tests/fixtures/ep-series/file-traces/v1/source-evidence.json`
- Create: `tests/ep-file-source-evidence.test.mjs`
- Modify: `tests/fixtures/ep-series/file-traces/v1/README.md`

**Interfaces:**
- `source-evidence.json` records immutable source revision `6f2a85b844387418a98f948cbd61431365c344ae`, source blob SHAs and evidence classification for candidate files.
- Initial known source blobs include:
  - `captures/sniffer-readmeta.jsonl` → `13c86e8ead2d88c0e2b468a4d426af8cea31307e`
  - `captures/sniffer-rename.jsonl` → `7cb86f4ce5c6635833b29ab4921b80f30aa486ca`
  - `captures/sniffer-slot26.jsonl` → `090d1b31b30124592f1d60c4e8d9f5cfaeca029f`
  - `tests/fixtures/sniffer-upload-kick-official.jsonl` → `e89c83680af8ca7e76f8412df1074103b9d1331f`
  - `captures/evidence-download-state-bug.jsonl` → `898ed20d4e2c07bf38ab623c2006c64867f8fe41`
  - `captures/sniffer-delete-hi.bin` → `26742449d7b56b1c027df5c05c79f09a14892765`
- Source audit must record that the source project's own evidence document marks official-app Download/GET wire evidence `_pending_`; do not upgrade that claim.

- [ ] **Step 1: Write failing source-evidence test.** Assert every external source entry pins repository, 40-char commit, path, blob SHA, license and evidence level; assert no entry marked `real-device` cites only prose or implementation code.
- [ ] **Step 2: Run `node --test tests/ep-file-source-evidence.test.mjs`.** Expected: FAIL because source registry does not exist.
- [ ] **Step 3: Add exact MIT attribution text from the pinned source and the source-evidence registry.** Distinguish `official-app-proxy`, `independent-client-device-capture`, and `analysis-only` evidence.
- [ ] **Step 4: Audit candidate captures against source documentation/direct frames.** Record operation classes each source can legitimately support and explicit gaps. Do not mark native `get`, native `move`, timeout, late-response, firmware-debug or interrupted-session real-covered unless a direct capture proves them.
- [ ] **Step 5: Run `node --test tests/ep-file-source-evidence.test.mjs`.** Expected: PASS.
- [ ] **Step 6: Commit:** `docs: pin EP capture provenance and attribution`.

### Task 4: Import real public success fixtures and prove wire parsing

**Files:**
- Create/modify: `tests/fixtures/ep-series/file-traces/v1/real/*.json`
- Modify: `tests/fixtures/ep-series/file-traces/v1/manifest.json`
- Create: `tests/ep-file-golden-wire.test.mjs`

**Interfaces:**
- Consumes Task 2 importer and Task 3 source registry.
- Uses production `parseTeSysex()` and FILE parsers/builders in `js/ep133/fileProtocol.js`.
- A manifest operation is `real-device` covered only after direct source-frame inspection and a passing production-parser assertion.

- [ ] **Step 1: Write failing wire-regression test against the first real fixture.** Start with an evidence-backed `init/list` window from pinned JSONL. Assert captured TX/RX parse to expected TE FILE command, request ID correlation, status and decoded FILE op/subop; assert list payload parses with `parseFileListEntries()` where the capture contains list entries.
- [ ] **Step 2: Run `node --test tests/ep-file-golden-wire.test.mjs`.** Expected: FAIL because no real fixture exists.
- [ ] **Step 3: Import and review the first fixture.** Generate via Task 2 CLI, not hand-copy. Confirm serial/user labels are absent and sanitizer transforms are recorded.
- [ ] **Step 4: Add one fixture at a time for every public success class actually proven by direct evidence.** Current evidence audit is expected to yield at least INIT/LIST, PUT, DELETE and metadata GET/SET; each fixture gets a focused parser assertion before its manifest coverage entry changes.
- [ ] **Step 5: For PUT, assert captured init/data/sentinel or terminal sequence preserves page/chunk order and production builders reproduce the relevant raw FILE payload fields.** Do not require request IDs generated by `buildTeSysex()` to equal the capture unless using `encodeTeSysex(..., capturedId)`.
- [ ] **Step 6: For DELETE and metadata operations, assert exact node/slot IDs after sanitization when those IDs are scenario-semantic.** Names may be sanitized only length-preservingly.
- [ ] **Step 7: Run `node --test tests/ep-file-golden-fixtures.test.mjs tests/ep-file-source-evidence.test.mjs tests/ep-file-golden-wire.test.mjs`.** Expected: PASS with manifest still reporting any unsupported real classes as missing.
- [ ] **Step 8: Commit:** `test: add provenance-backed EP FILE golden traces`.

### Task 5: Golden fixture → fake EP replay adapter and behavior regression

**Files:**
- Modify: `tests/helpers/file-trace-replay.mjs`
- Create: `tests/helpers/ep-file-golden-replay.mjs`
- Create: `tests/ep-file-golden-replay.behavior.test.mjs`
- Keep: `tests/filesystem-capture-replay.behavior.test.mjs` as synthetic baseline

**Interfaces:**
- Produces `createGoldenFileReplay(fixture, {range=null}={}) -> {onRequest, assertComplete, seen, remaining}`.
- Adapter selects only TE FILE request/response pairs from fixture frames, converts captured responses to the fake harness descriptor `{status,payload,delay,drop,debug,debugDelay,disconnect}` without rewriting request semantics, and compares outgoing production request raw FILE payload to the captured request raw FILE payload.
- Request ID is correlated from each live request; captured request IDs prove source pairing but do not force production allocator state.

- [ ] **Step 1: Write failing adapter test.** Load a real success fixture and assert adapter extracts ordered FILE pairs, rejects an RX frame with the wrong captured request correlation, and reports unconsumed frames.
- [ ] **Step 2: Run `node --test tests/ep-file-golden-replay.behavior.test.mjs`.** Expected: FAIL because adapter does not exist.
- [ ] **Step 3: Implement adapter using production `parseTeSysex()`.** Preserve captured status/payload/delay; fail on unsupported ambiguous sequence rather than guessing which RX belongs to which TX.
- [ ] **Step 4: Replay at least one read/list-style and one mutation-style real fixture through `createFakeEpMidi()` / production filesystem APIs where current production APIs exactly match the captured operation.** Assert device runtime does not become unsafe for successful capture replay.
- [ ] **Step 5: Run `node --test tests/ep-file-golden-replay.behavior.test.mjs tests/filesystem-capture-replay.behavior.test.mjs`.** Expected: PASS.
- [ ] **Step 6: Commit:** `test: replay real EP captures through transport harness`.

### Task 6: Failure-fixture semantics and authoritative runtime regressions

**Files:**
- Create: `tests/fixtures/ep-series/file-traces/v1/synthetic/*.json`
- Modify when evidence exists: `tests/fixtures/ep-series/file-traces/v1/real/*.json`
- Modify: `tests/fixtures/ep-series/file-traces/v1/manifest.json`
- Create: `tests/ep-file-golden-runtime.behavior.test.mjs`

**Interfaces:**
- Failure scenario outcomes: `timeout`, `late-response`, `firmware-debug`, `interrupted-session`.
- Runtime expectations use existing T1 statuses only: `safe`, `blocked`, `recovery-required`, `unsafe`.
- Synthetic fixtures may encode current known policies but are excluded from real coverage.

- [ ] **Step 1: Write failing runtime tests from fixture expectations.** Assert a fixture cannot directly mutate runtime; the test must drive production/fake transport and then observe runtime. Cover: read timeout/no mutation, late response from expired request, debug frame during strict FILE work, interrupted streaming mutation/session ambiguity.
- [ ] **Step 2: Add synthetic schema-v1 fixtures for currently testable failure policies.** Set `provenance.kind='synthetic'` and a precise `basis`; prove coverage summary still reports all four real failure classes missing.
- [ ] **Step 3: Run `node --test tests/ep-file-golden-runtime.behavior.test.mjs tests/ep-file-golden-fixtures.test.mjs`.** Expected: first RED until replay descriptors support each failure, then PASS after minimal test-harness support; no production safety rule is weakened.
- [ ] **Step 4: Extend only test replay/harness code needed to express captured timing/debug/disconnect events.** Reuse `drop`, `delay`, `debug`, `debugDelay`, `disconnect` already supported by `createFakeEpMidi()` where possible.
- [ ] **Step 5: When a real failure capture is available, import it through Task 2 and replace only the corresponding manifest gap with real evidence; keep synthetic regression if it adds useful deterministic coverage.
- [ ] **Step 6: Run `node --test tests/ep-file-golden-runtime.behavior.test.mjs tests/device-runtime-state.test.mjs tests/ep133.test.mjs`.** Expected: PASS.
- [ ] **Step 7: Commit:** `test: bind EP failure traces to runtime safety state`.

### Task 7: Hardware capture intake and fail-closed real-coverage closure

**Files:**
- Create: `docs/testing/ep-file-capture-workflow.md`
- Create: `scripts/check-ep-file-golden-coverage.mjs`
- Create: `tests/ep-file-golden-coverage.test.mjs` only when the required real corpus is present
- Modify: `tests/fixtures/ep-series/file-traces/v1/manifest.json`
- Add real fixtures under `tests/fixtures/ep-series/file-traces/v1/real/` as hardware evidence is obtained

**Interfaces:**
- CLI `node scripts/check-ep-file-golden-coverage.mjs` loads the manifest/fixtures and exits nonzero with explicit missing success/failure classes until all required classes are backed by real-device fixtures.
- Capture workflow specifies scenario labels and evidence notes for still-missing classes, expected initially to include public-evidence gaps such as a directly captured successful GET and native FILE MOVE plus any missing failure classes.
- New local captures enter through the same Task 2 importer; no separate trusted path exists for first-party captures.

- [ ] **Step 1: Write the coverage checker against an injected manifest in unit style.** Assert it reports exact missing sets and that synthetic IDs never satisfy them. Do not add a permanently failing repository-wide test yet.
- [ ] **Step 2: Implement `check-ep-file-golden-coverage.mjs`.** Human-readable output groups missing success vs failure classes; exit code 1 on gaps, 0 only on complete validated real coverage.
- [ ] **Step 3: Write capture workflow.** For each missing class document device/firmware recording, operation performed, start/stop boundaries, whether mutation may have happened, and how to preserve late/timeout/debug timing. Require raw source capture retention outside the sanitized fixture and record its SHA-256 in provenance.
- [ ] **Step 4: Run the checker against the current corpus.** Expected: nonzero if public sources do not close every required class. Record the exact missing list in ZAT-8/PR notes; this is evidence, not a test failure to hide.
- [ ] **Step 5: Import each newly obtained real-device capture through the same deterministic pipeline and add focused wire/runtime tests before marking its class covered.** If no legitimate capture exists for a class, leave ZAT-8 In Progress and do not create fake evidence.
- [ ] **Step 6: Once all eight success and four failure classes validate as real-device, add `tests/ep-file-golden-coverage.test.mjs` asserting `missing.size === 0` and run it.** Expected: PASS.
- [ ] **Step 7: Commit infrastructure first:** `test: add fail-closed EP golden coverage gate`. Commit final hardware fixtures separately by evidence batch: `test: add EP <scenario> hardware capture evidence`.

### Task 8: ZAT-8 final verification and PR gate

**Files:**
- Review all ZAT-8 changes only; production code changes are not expected.
- Modify: ZAT-8 PR body / Linear notes, not product behavior.

**Interfaces:**
- Completion requires the Task 7 checker exit 0 and the real-coverage test present and green.

- [ ] **Step 1: Run `node scripts/check-ep-file-golden-coverage.mjs`.** Expected: exit 0 with all required success and failure classes listed covered by `real-device` fixtures.
- [ ] **Step 2: Run `npm test`.** Expected: PASS.
- [ ] **Step 3: Run `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 4: Run `npm run build:pages`.** Expected: PASS.
- [ ] **Step 5: Review fixture provenance and sanitizer transforms.** Confirm no device serial/user labels remain, source revisions are immutable, MIT attribution is present, and no protected protocol fields changed.
- [ ] **Step 6: Review git diff for production protocol behavior changes.** Expected: none. Any production change requires separate evidence/review and is not accepted merely to make a fixture pass.
- [ ] **Step 7: Open/mark ready the ZAT-8 PR with a coverage table mapping every required class to fixture ID + source provenance.** Keep issue In Progress if any real class is missing.
- [ ] **Step 8: After merge, verify unit/browser/build on the merge commit, then mark ZAT-8 Done in Linear.**
