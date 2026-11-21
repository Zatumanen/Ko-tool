# K.O. TOOL 1.0 · source/commit/Linear reconciliation and code review

**Audited on:** 2026-11-21. **App-code baseline:** [`main@b6c9ad4fe44c482f775c4998acf56e21826700a3`](https://github.com/Zatumanen/Ko-tool/commit/b6c9ad4fe44c482f775c4998acf56e21826700a3), merged [PR #206](https://github.com/Zatumanen/Ko-tool/pull/206). This is a **dated evidence record**, not a guarantee of today's HEAD or what GitHub Pages serves.

**Read-only scope:** checked GitHub commit lineage and merged PRs, current implementation/callers/selected tests and documents, 45 K.O. Tool Release 1.0 Linear issues and relevant comments, open PR #110/#139, and recorded CI/deployment runs. No app/CI code edits, local test execution, Web MIDI/Serial traffic, physical HIL, firmware operation or Pages publication in this review. Earlier reproducible synthetic probes are attributed to the 20-Nov [ZAT-69 audit](https://linear.app/clouded/issue/ZAT-69); this review re-inspected the unchanged vulnerable paths. The exact-head/post-merge automated CI is **existing run evidence**, not newly executed tests.

## Baseline, source of truth and evidence

- `main@b6c9ad4` is the current source of implementation for this audit. [Post-merge Actions #44895071162](https://github.com/Zatumanen/Ko-tool/actions/runs/44895071162) **completed/success 4/4**: Node **1094/1094**, Chromium fake-EP **172/172**, built Pages-dist browser **2/2**, `build-pages` and `codex-preflight` PASS. CI establishes tested software behavior only.
- [PR #206](https://github.com/Zatumanen/Ko-tool/pull/206) integrated C-01 and C-02 from superseded unmerged #204/#205. Session-bound Legacy TAR/ZIP Restore and exact-firmware-scoped sample Rename authorization **are in main**. No production pad WRITE or PAK Restore was enabled. Hardware readback/recovery HIL **not performed**.
- Open PRs: [#110](https://github.com/Zatumanen/Ko-tool/pull/110) OS redesign **paused Draft**; [#139](https://github.com/Zatumanen/Ko-tool/pull/139) guarded pad parameters **Draft, not merged**. Neither contributes to `main`.
- Last verified manual `deploy-pages` workflow run: [#44301681855](https://github.com/Zatumanen/Ko-tool/actions/runs/44301681855), **successful**, on 2026-11-18 `d8c193a41069b4b053b242b9b6d35c1a688641c8`, both `verify` and `deploy` PASS. It is **not** this source baseline. The current live `build-version.json` and browser smoke were not rechecked; a green ordinary PR/main CI **does not deploy**.

## Six-stage as-built versus approved 1.0 contract

| Stage | Implemented in code at audited main | Incomplete or deliberately blocked | Evidence |
| --- | --- | --- | --- |
| 01 My EP | Connected library; guarded Upload/MOVE/COPY/DELETE; verified upload and COPY full PCM; sample metadata with evidence gating; project TAR read/restricted authoring and recovery; Legacy TAR/ZIP Restore safety guards; REPITCH; official PAK/PPAK export, reader and CRC-offline staging | Assigned-pad WRITE **blocked**, official PAK/PPAK Restore **blocked** (`canRestore:false`); important project/write/recovery, REPITCH playback and model/firmware HIL pending | `js/ep133/ui/createEpWorkspace.js`, `sampleRenameController.js`, `backupRestoreController.js`, `js/ep133/officialPakRestoreStaging.js`; #206; ZAT-61/62/68/92 |
| 02 SpeedUpperCut | Canonical x2/-12 converter, HI/MID/LO, channels/playmode, best-effort files/folders and WAV/ZIP, edited WAV, confirmed batch drag destination | Target-device playback and host/browser acceptance pending | `js/app.js`, `js/audio/processor.js`, `js/ep133/ui/sampleUploadChoice.js`, #181; ZAT-53–55/79 |
| 03 Visuals | Seven panels plus continuous Spectrum, Spectrogram, transient Waveform, XY, LUFS, Stereo/Peak, themes/adaptive rendering and bounded PCM16/24 recorder; integrated #187/#194 | Bugs B-01/B-02 below; visual signoff, real audio input, MBP2017 15m/1h/4h endurance and EP USB Audio acceptance pending | `js/visuals/{app,audio,recorder,renderClock,loudness}.js`, #194; ZAT-64/65/80–88 |
| 04 Sequencer | **Separate icon/window and connected Saved Step/Piano Roll**, scene/song navigation, manual passive MIDI EVENTS ONLY, bounded trace export and analyzer | Bidirectional hardware-authoritative Live/transport/playhead/editing **not implemented**; no physical evidence for individual commands | `js/sequencer/{app,saved,midiDiagnostics,midiTraceAnalyzer}.js`, merged #196–203; ZAT-63 |
| 05 FX-MIC | Separate offline 4-slot pack/editor/modulation/ZIP and approximate Web Audio audition; stock 1.1.2 read-only REPL config/preset diagnostics; restricted 1.0.8 experimental LOWPASS hardware trial | Product-grade write-enabled Live across proven device/firmware not accepted; no blanket firmware write authority or auto-reset | `js/fxMic/{app,hardwareTrial,liveSession,serialTransport,profile}.js`, merged #169–176; ZAT-50 |
| 06 EP-136 | Generic explicitly chosen mono/stereo browser audio source already in Visuals | **Dedicated** EP-136 Sidekick discovery/channel mapping and reproducible WAV capture acceptance missing; 8-channel device ↔ mono/stereo browser host behavior unverified | `js/visuals/audio.js`, `docs/roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md`, ZAT-51 |

The project milestone percentages and issue workflow statuses are **not** code coverage or release acceptance. In particular ZAT-63 **Backlog/0%** before reconciliation conflicts with the merged eight software PRs, and ZAT-61 **Done** does not mean assigned-pad WRITE is safe.

## Source code review findings (not fixed by this documentation task)

| Finding | Severity | Rechecked path and exact problem | Evidence / required regression |
| --- | --- | --- | --- |
| B-01 | **S2**, privacy/resource | `js/visuals/audio.js` `start()`: `getUserMedia` opens a track, then `new AudioContextClass()` can throw **before** `stream=opened`; `release()` cannot stop the local `opened` track on that failure | Previous synthetic constructor-failure probe: `track.stop()` not called; after a scoped code fix, test constructor failures, stale generation and STOP cleanup; ZAT-65 |
| B-02 | **S2**, lifecycle | `js/visuals/app.js` `refreshInputs()` awaits `audio.inputs()` and later dereferences `audio.selectedId`/`audio.active`, even after `close()` sets `audio=null`; catch also dereferences null | Previous delayed enumerate/close probe produced browser `pageerror`; add success/failure close/reopen fences and combined browser E2E; ZAT-65 |
| C-03 | **S2**, memory/availability | `js/ep133/backupBundle.js` `readEpBackupBundleFile()` awaits unbounded `file.arrayBuffer()` before checking size. `parseStoredZip` clones full input/payload and `parseEpBackupBundle` clones referenced payloads again per manifest alias | Previous synthetic ZIP test showed duplicated allocations, oversized file did enter `arrayBuffer`; introduce explicit file/member/total/copy budget and reject repeated manifest target references without altering safe round trips; ZAT-62/69 |
| D-01 | **S2**, malformed audio | `js/ep133/audio.js` WAV fast path clamps RIFF data chunk length via `Math.min(size, actualBytes)`, then accepts truncated/incomplete PCM including non-frame-aligned payload; a malformed direct-upload WAV can reach prepared PCM | Previous synthetic truncated PCM16 probe in ZAT-69: advertised 8B, supplied 7B, accepted. After a code fix, require RIFF/data bounds and full frame alignment **before FILE PUT**, with positive KORP/mono/stereo tests; ZAT-57/77 |
| A-03 | **S3**, integrity check | `js/sequencer/midiTraceAnalyzer.js` checks that `captureLimitReached=true` requires event count == limit but not the reverse case of count == limit with false and manual stop | Previous mutated-trace probe accepted contradictory metadata. Add round-trip/full-boundary and short-manual cases; ZAT-63 |
| B-03 | **S3**, architectural | Visuals depends on My EP module/bootstrap for verified model palettes; potentially unnecessary service initialization and timers | Existing browser request-trace observation, but **performance impact unmeasured**; avoid speculative rewrite; ZAT-48/64 |
| C-04 | **Unverified risk**, device identity | Interaction of GREET `base_sku` and recognized transport SKU in `js/ep133/device.js` merits strict alias/permission review | **Not reproduced**; do not label a demonstrated defect or relax firmware authorization; ZAT-48/68 |

**Safety distinction:** S2 describes meaningful software bugs or reproducible earlier synthetic test failures; their probability or effect on a real EP/host has not been established. None of the four S2 fixes is included in this docs-only review.

## Documentation / Linear contradictions confirmed

1. `README.md` claimed a standalone Saved/Live Sequencer was absent despite merged #196–203; `docs/PROJECT_STATE.md` still said both Saved and Live were missing. The code proves Saved is present; *only Live* is missing.
2. `docs/RELEASE.md` and `docs/TESTING.md` stated the **first** manual Pages deployment had never been tested; successful `deploy-pages` run #44301681855 is verified. An ordinary main push still does not authorize/publish the latest commit.
3. `docs/IMPLEMENTATION_MATRIX.md` originally identified a 17-Nov baseline and an 18-Nov Visuals addendum even though #196–206 were merged afterwards; it needs a new dated 21-Nov baseline and explicit Rename/Legacy Restore rows.
4. Linear **Done** is not hardware acceptance: ZAT-61 assigned pad WRITE blocked; ZAT-92 Done is **offline staging** only; ZAT-62 project HIL remains limited. Linear ZAT-63 historical checklist contradicts the newer owner-approved standalone placement; comments are newer than the issue body.
5. `scripts/check-implementation-audit.mjs` validates matrix columns/statuses, file-path existence and PR sections, **not claims of implementation or current README/deploy status**. It cannot detect these contradictions as written.
6. Root `LICENSE` is absent, as acknowledged by `AGENTS.md` and README legal section. This is a **distribution/rights decision**, not an invitation to invent a license or alter third-party WASM rights.

## Preventing status drift without overstating automation

**Immediate documentation policy (docs-only):**

1. **One dated code evidence baseline** for every release-status review: exact `main` SHA, PR list, tests, firmware scope, deployed SHA. Cite actual source/test paths, not a status label or an old PR summary.
2. **Separate four states for each feature:** CODE (implemented/partial/blocked/missing), AUTOMATED (specific exact SHA and coverage), HIL (model + firmware + operation, or pending), OWNER (accepted/pending). In Linear, a Done software item must still link to an explicit HIL/owner blocker if applicable.
3. **Feature PR definition of done:** update `docs/IMPLEMENTATION_MATRIX.md` and `docs/PROJECT_STATE.md`, plus user-facing `README.md` when observable features change, as part of the same PR or via an explicitly linked docs PR; after merge record exact main CI and reconcile the affected Linear issue. Never silently upgrade HIL.
4. **Deployment is a separate state:** compare live `build-version.json` to the latest verified successful `deploy-pages` run, not to source `main`. Report `SOURCE_SHA` and `PUBLISHED_SHA` separately.

**Recommended future code/CI work; NOT authorized or implemented by this document:**

- Add a **machine-readable feature-status manifest**, with code/CI/HIL/owner fields and test/PR links, used to generate human-facing state tables instead of manually cloning the same assertions into README, PROJECT_STATE, and Linear descriptions.
- Add a **CI freshness/consistency checker** triggered on every PR that changes production entrypoints, firmware profiles or status docs: fail on stale explicit “not implemented” claims, nonexistent evidence paths, missing updated feature manifest/README links or impossible combinations (e.g. PAD WRITE enabled with HIL blocked). Require a machine-readable documented exception rather than silent skip. CI should never claim it can infer real device behavior from source strings.
- Add a **post-merge reconciliation workflow** that records exact merged SHA, successful post-merge CI, affected feature IDs and PR links as draft Linear updates requiring human review; do not auto-close HIL tasks. A scheduled audit can report drift without making device writes or publishing.
- Keep PR-merge and Pages-deploy authorizations separate; require live artifact SHA verification and a short real-browser smoke on each actual deploy.

## Release verdict

**Software code paths implemented ≠ 1.0 accepted.** Even with #206 integrated and four green main CI jobs, S2 fixes, browser/host checks, owner UX acceptance, HIL scopes, bidirectional Sequencer Live, FX-MIC production Live and dedicated EP-136 integration are outstanding. **Full K.O. TOOL 1.0 = NO-GO** on this evidence. See [Linear ZAT-69](https://linear.app/clouded/issue/ZAT-69), [ZAT-68](https://linear.app/clouded/issue/ZAT-68) and [ZAT-71](https://linear.app/clouded/issue/ZAT-71).
