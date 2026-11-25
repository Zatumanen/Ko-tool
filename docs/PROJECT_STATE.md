# K.O. Tool — current project state (dated evidence)

**24 November software checkpoint.** `main@e4ee8efadf4015463d4545d6cdc45e3ce5e7c43f` includes D-01 WAV validation from [PR #208](https://github.com/Zatumanen/Ko-tool/pull/208). [Post-merge CI #45391253978](https://github.com/Zatumanen/Ko-tool/actions/runs/45391253978) passed all four jobs (1097 Node, 173 Chromium source, 2 Chromium Pages-dist). Physical upload and REPITCH playback acceptance are HIL PENDING.

**Reviewed on:** 2026-11-21. **Reviewed application code:** [`main@b6c9ad4fe44c482f775c4998acf56e21826700a3`](https://github.com/Zatumanen/Ko-tool/commit/b6c9ad4fe44c482f775c4998acf56e21826700a3) after integrated [PR #206](https://github.com/Zatumanen/Ko-tool/pull/206). This is a **snapshot**, not a live HEAD or deployed-site claim. Before implementation or release: confirm GitHub HEAD/open PRs, [implementation matrix](IMPLEMENTATION_MATRIX.md), relevant Linear issue, the owner [decisions](roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md), and [pre-implementation gate](IMPLEMENTATION_GATE.md).

**Evidence:** [post-merge main CI #44895071162](https://github.com/Zatumanen/Ko-tool/actions/runs/44895071162) `completed/success`, four jobs PASS: **1094/1094 Node**, **172/172 Chromium fake-EP**, **2/2 built Pages-dist Chromium**, `build-pages` and `codex-preflight` PASS. These are software tests. **No new physical HIL is established**, and no deployment follows from this merge.

## Product scope: implemented vs pending

| Owner-approved stage | Software implemented on reviewed source | Software / real-world acceptance still open |
| --- | --- | --- |
| 01 · **My EP** | Connected Sample Library and slot management; verified Upload/COPY PCM readback; guarded MOVE/DELETE/dependencies, REPITCH x2/-12 + provenance; restricted Projects editor, backup/Legacy TAR/ZIP Restore/recovery; official PAK/PPAK export/preview and CRC offline staging; [#206](https://github.com/Zatumanen/Ko-tool/pull/206) strengthens legacy Restore session binding and Rename exact-firmware permission | Assigned-pad WRITE remains blocked ([Draft #139](https://github.com/Zatumanen/Ko-tool/pull/139) **not merged**); **official PAK/PPAK Restore is blocked**; physical write/recovery/REPITCH playback and firmware-specific signoff pending |
| 02 · **SpeedUpperCut** | Canonical reference x2/-12, HI/MID/LO, channel/playmode, waveform/chop (legacy preserved), best-effort folder WAV/ZIP, numbered uploads, multi-drag preview into My EP ([#181](https://github.com/Zatumanen/Ko-tool/pull/181)) | Real EP playback and host acceptance pending; waveform/chop remain in existing classic UI despite newer minimalist design preference |
| 03 · **Visuals** | Seven selected-browser-input modules, transient waveform, log Spectrum, time Spectrogram, XY, BS.1770 LUFS, Plasma/stereo, Peak/CLIP, three themes and adaptive 60/30/15 render, **bounded WAV PCM 16/24 recorder** (merged [#187](https://github.com/Zatumanen/Ko-tool/pull/187), [#194](https://github.com/Zatumanen/Ko-tool/pull/194)) | Actual audio inputs and EP USB Audio, visual owner acceptance and MBP2017 15m/1h/4h endurance |
| 04 · **Sequencer** | **Standalone icon/window** on shared authorized EP session. **Saved Step/Piano Roll**, group/pad/scene/song navigation and bounded passive **MIDI EVENTS ONLY/trace export/local analyzer** implemented by merged [#196–203](https://github.com/Zatumanen/Ko-tool/pull/203) | **Two-way hardware-authoritative Live missing**, no fake playhead or unverified outbound command. Exact-device event provenance and owner HIL pending ([ZAT-63](https://linear.app/clouded/issue/ZAT-63)) |
| 05 · **FX-MIC Studio** | Offline pack/4 WAV slots, FX chain, modulation, ZIP, local drafts and approximate Web Audio audition ([#176](https://github.com/Zatumanen/Ko-tool/pull/176)); USB Serial diagnostics of stock 1.1.2 saved config **read-only**; limited manual LOWPASS trial on stock 1.0.8 | Full safe production USB Live/firmware coverage and physical analog audition acceptance pending ([ZAT-50](https://linear.app/clouded/issue/ZAT-50)) |
| 06 · **EP-136 Sidekick** | Visuals can already select a generic browser mono/stereo audio input | **EP-136-specific** discoverability, real channel mapping/PCM recording evidence and acceptance **not implemented** ([ZAT-51](https://linear.app/clouded/issue/ZAT-51)) |

A Linear **Done** can mean that a strictly limited *software subset* was delivered; it does not authorize pad WRITE, official PAK Restore, firmware writes or claim HIL PASS. See exact [device compatibility](testing/ep-device-compatibility-matrix.md) and [testing/physical acceptance rules](TESTING.md). Project milestone percentages derive from issue state, **not** measured software implementation completeness.

## Source-review findings and follow-up

- **S2 B-01 software fix:** `js/visuals/audio.js` owns the granted input before constructing the AudioContext, so allocation failure releases all tracks.
- **S2 B-02 software fix:** discard stale audio results on Close and Reopen. Explicit ACCESS owns its enumeration and replays one pending refresh, preserving the denial message and same-source reconnect.
- **S2 C-03 software fix:** legacy ZIP import in `js/ep133/backupBundle.js` checks size before reading, validates ZIP structure and checksums, and rejects duplicates, aliased entries and excessive dependency lookups before Restore preflight. Physical Restore acceptance remains pending.
- **S2 D-01 software fix:** `js/ep133/audio.js` rejects truncated RIFF and incomplete PCM frames in ordinary uploads and REPITCH. Fake EP coverage checks that the next valid file still uploads. Physical acceptance remains pending.
- **S3 A-03 software fix:** the MIDI trace analyzer checks that the stored event count agrees with the limit flag and stop reason. Exporter-produced synthetic vectors cover both manual and capacity stops.
- **S3 B-03 software fix:** Visuals imports the shared MIDI device singleton without initializing My EP. A Chromium cold-load probe measured seven fewer My EP module requests and 56,790 fewer decoded JavaScript bytes.
- **C-04 software fix:** My EP rejects contradictory GREET base SKUs at connection time and gates FILE traffic until verification. Fake EP covers the known AS002 → AS001 alias, cross-model rejection, retry, and rejection of stale FILE intents during GREET, lock admission and firmware preflight.

Evidence, severity, source locations and future regression requirements: [21-Nov code review](audits/KO_TOOL_CODE_REVIEW_2026-11-21.md). Keep targeted follow-ups in existing [ZAT-69](https://linear.app/clouded/issue/ZAT-69), [ZAT-65](https://linear.app/clouded/issue/ZAT-65), [ZAT-62](https://linear.app/clouded/issue/ZAT-62), [ZAT-57](https://linear.app/clouded/issue/ZAT-57) and [ZAT-63](https://linear.app/clouded/issue/ZAT-63). No production-code fix or fresh hardware test was authorized by the docs review.

## Deployment is a separate state

- **Source code:** `main@b6c9ad4`, CI four jobs PASS (above).
- **Last verified successful manual GitHub Pages workflow:** [`deploy-pages` #44301681855](https://github.com/Zatumanen/Ko-tool/actions/runs/44301681855), 2026-11-18, **`d8c193a41069b4b053b242b9b6d35c1a688641c8`**, verify + deploy PASS. Earlier manual deployments also succeeded.
- **Live served SHA:** [public version](https://zatumanen.github.io/Ko-tool/build-version.json) was checked on 2026-11-24 and reported `d8c193a41069b4b053b242b9b6d35c1a688641c8`. The manual deployment remains separately scoped under [RELEASE](RELEASE.md).

Open PRs at this snapshot: [#110](https://github.com/Zatumanen/Ko-tool/pull/110) paused OS **Draft**, [#139](https://github.com/Zatumanen/Ko-tool/pull/139) assigned pad WRITE **Draft**. #204/#205 were closed as superseded by merged #206. Preserve separation between CODE, AUTO CI, HIL and OWNER acceptance; **K.O. TOOL 1.0 remains NO-GO** until all agreed stages and gates pass.

## Historical checkpoints

- 18-Nov Visuals integration: merged [#194](https://github.com/Zatumanen/Ko-tool/pull/194) at `ab5706e425c20e06ede35012053d5b211846d53c`, [CI #44267219851](https://github.com/Zatumanen/Ko-tool/actions/runs/44267219851) 4/4 PASS on that historical SHA.
- 17-Nov previous project-state baseline: `23a814154047b732a6fb7884be9d9e95cdb065af`; later Sequencer commits #196–203 and safety fix #206 supersede its “missing” labels.
- Earlier 12-Nov physical/HIL and CI snapshot: [historical record](history/PROJECT_STATE-2026-11-12.md). Historical claims are never generalized to different models, firmware or operations.

**Status governance:** after each feature/status-changing PR, recheck `main`, source and tests, update the implementation matrix and this state record in the same change, then reconcile Linear and its evidence. A CI script currently checks **structure only** and cannot establish truth; enhanced drift automation requires a separately reviewed code/CI change.
