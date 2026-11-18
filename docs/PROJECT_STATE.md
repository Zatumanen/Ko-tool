# K.O. Tool — current project state

**Later Visuals integration checkpoint (18 November 2026):** PR [#194](https://github.com/Zatumanen/Ko-tool/pull/194) merged six Visuals feature branches into `main@ab5706e425c20e06ede35012053d5b211846d53c`. Post-merge [CI #44267219851](https://github.com/Zatumanen/Ko-tool/actions/runs/44267219851) is 4/4 PASS: Node 1055, source Chromium 161, dist Chromium 2. Owner visual acceptance, MBP2017 endurance and real EP USB Audio HIL remain open; there was no Pages deployment. Superseded original PRs #188–#193 must not be merged again. Use [PR integration protocol](PR_INTEGRATION.md) for subsequent changes. Other snapshot sections below retain their historical scope.

**Snapshot:** 2026-11-17, audited `main@23a814154047b732a6fb7884be9d9e95cdb065af`. Not a live HEAD guarantee. Before code: recheck current main/open PRs/Linear, [Implementation Matrix](IMPLEMENTATION_MATRIX.md) and [pre-implementation gate](IMPLEMENTATION_GATE.md). Historical [12-Nov HIL/CI](history/PROJECT_STATE-2026-11-12.md) is preserved.

## Implemented vs missing

- **Architecture:** static JS/CSS/HTML, Node 22. Classic desktop active; [OS redesign #110](https://github.com/Zatumanen/Ko-tool/pull/110) paused Draft.
- **SpeedUpperCut:** reference ×2/−12, HI/MID/LO, channel/playmode choice, folder WAV/ZIP and existing waveform/chop implemented. Multi-WAV drag → My EP now requires full destination preview ([PR #181](https://github.com/Zatumanen/Ko-tool/pull/181)); original drag existed earlier.
- **My EP:** firmware-scoped Sample Library, guarded Upload/MOVE/COPY/DELETE, projects and legacy limited step editor. Upload/COPY use full PCM GET verification; dependent FILE operations retain safety locks and journals. [Contract](testing/sample-upload-pcm-readback.md). Latest physical write/recovery acceptance pending.
- **REPITCH:** previously implemented ON-by-default, KORP/SHA-256 prevents double ×2. [PR #180](https://github.com/Zatumanen/Ko-tool/pull/180) added a nonzero source-pitch safety guard, not REPITCH itself; playback HIL pending.
- **PAK/PPAK:** export/reader/preview already existed ([#164](https://github.com/Zatumanen/Ko-tool/pull/164), [#165](https://github.com/Zatumanen/Ko-tool/pull/165)). [PR #179](https://github.com/Zatumanen/Ko-tool/pull/179) connected pre-existing CRC offline staging to UI. **Actual Restore disabled**, no device write authorization. [Contract](testing/official-pak-offline-staging.md).
- **Pads:** limited EP-133 2.5.1 READ; WRITE disabled; [PR #139](https://github.com/Zatumanen/Ko-tool/pull/139) remains Draft. Projects' restricted legacy editor is **not** approved standalone Sequencer.
- **Visuals (superseded by the 18-Nov checkpoint above):** seven browser-input modules, trigger, Spectrum, Spectrogram and advanced XY/LUFS/Stereo/Output/WAV recording are now integrated through #194. Automated combined tests passed on `main@ab5706e`; exact device USB Audio and owner/endurance acceptance remain pending. [Spec](VISUALS.md).
- **Sequencer:** independent Step/Piano Roll + two-way device-authoritative Live **missing**; [spec](SEQUENCER.md). **FX-MIC:** offline editor/audition in [merged #176](https://github.com/Zatumanen/Ko-tool/pull/176); limited stock 1.1.2 Live diagnostics read-only, production hardware Live not accepted. **EP-136:** Sidekick not implemented.

## Evidence and release

- Linear [ZAT-77](https://linear.app/clouded/issue/ZAT-77), [ZAT-79](https://linear.app/clouded/issue/ZAT-79), [ZAT-92](https://linear.app/clouded/issue/ZAT-92) read **Done** on 17 Nov while their descriptions retain unmet hardware/write criteria. **Tracker Done ≠ HIL PASS.** Matrix records the gap.
- Post-merge CI [#179](https://github.com/Zatumanen/Ko-tool/actions/runs/44052065091), [#180](https://github.com/Zatumanen/Ko-tool/actions/runs/44054880413), [#181](https://github.com/Zatumanen/Ko-tool/actions/runs/44070697069) all 4/4 PASS on their exact main commits. Fake EP/Node/Pages builds do not establish physical acceptance.
- Historical scoped EP-133 2.5.1 pad READ HIL is in [TESTING](TESTING.md). New hardware writes, interruption and playback testing deferred by owner until software work finishes. [Release runbook](RELEASE.md): merge never authorizes public Pages deploy; 1.0 not accepted.
