# K.O. Tool — current project state

**Snapshot:** 2026-11-14, audited `main@7e89fdd2b5e6772905a8ee0a44106f4007a2a7e4` (PR #165), **not a live HEAD guarantee**. Recheck branch/Linear before edits. [12-Nov historical HIL and CI evidence](history/PROJECT_STATE-2026-11-12.md) preserved intact.

## Implemented vs pending

- Static JS/CSS/HTML, Node 22, classic SpeedUpperCut active. [OS redesign #110](https://github.com/Zatumanen/Ko-tool/pull/110) remains paused Draft.
- **Converter:** x2/−12, HI/MID/LO, channels/playmode, file/folder WAV/ZIP and waveform/chop. SpeedUpperCut → My EP batch preview pending ZAT-79.
- **My EP:** firmware-scoped Sample Library/FILE, MOVE/COPY/DELETE, projects/read-only pads, restricted legacy 16-step editor, guarded legacy ZIP/TAR recovery. COPY performs full PCM GET after PUT (PR #163); **ordinary Upload does not** (only FILE_INFO/metadata/size).
- **REPITCH implemented**: ON-by-default per-session toggle; provenance preflight and x2/−12 preparation. Physical playback not accepted: [ZAT-77](https://linear.app/clouded/issue/ZAT-77) In Review.
- **Official .pak/.ppak:** read-only archive/slot preview (PR #164); detached offline PCM/TAR staging (PR #165); **actual Restore OFF** ([ZAT-92](https://linear.app/clouded/issue/ZAT-92) In Progress).
- **Pads:** EP-133 2.5.1 scoped READ; WRITE disabled, [PR #139](https://github.com/Zatumanen/Ko-tool/pull/139) still Draft.
- **Visuals:** seven browser-input dock meters, RMS dBFS ≠ LUFS, no verified EP USB Audio or advanced recorder. Approved standalone Sequencer, FX-MIC, EP-136 stages remain future work.

## Evidence and release

- [CI #43586791491](https://github.com/Zatumanen/Ko-tool/actions/runs/43586791491): 847/847 Node, 113/113 fake-EP Chromium and Pages/preflight PASS on snapshot SHA. Fake EP is **not hardware acceptance**.
- Scoped owner-observed EP-133 2.5.1 Pad READ/UI HIL (P01/A) recorded in [TESTING](TESTING.md) and [history](history/PROJECT_STATE-2026-11-12.md). COPY/REPITCH/restore/interruption acceptance remains open; further HIL deferred by owner 2026-11-14 ([ZAT-68](https://linear.app/clouded/issue/ZAT-68)).
- [Actual Pages #43586790943](https://github.com/Zatumanen/Ko-tool/actions/runs/43586790943) was **automatic branch/Jekyll**, not versioned manual dist. Admin must change **Settings → Pages → Source = GitHub Actions** before controlled merge/deploy. Change not verified. See [RELEASE](RELEASE.md) and [ZAT-93](https://linear.app/clouded/issue/ZAT-93). Never assume manual workflow suppresses branch publishing.
- Release 1.0 not accepted; [owner decisions](roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) prescribe six sequential stages. [AGENTS](../AGENTS.md) controls permissions; [Linear](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca) tracks live tasks.
