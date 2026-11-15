# K.O. Tool — current project state

**Snapshot:** 2026-11-15, audited `main@49bd79f7bd637c39f42b9ad00d18154db5d210df` (PR #166), **not a live HEAD guarantee**. Recheck branch/Linear before edits. [12-Nov historical HIL and CI evidence](history/PROJECT_STATE-2026-11-12.md) preserved intact.

## Implemented vs pending

- Static JS/CSS/HTML, Node 22, classic SpeedUpperCut active. [OS redesign #110](https://github.com/Zatumanen/Ko-tool/pull/110) remains paused Draft.
- **Converter:** x2/−12, HI/MID/LO, channels/playmode, file/folder WAV/ZIP and waveform/chop. SpeedUpperCut → My EP batch preview pending ZAT-79.
- **My EP:** firmware-scoped Sample Library/FILE, MOVE/COPY/DELETE, projects/read-only pads, restricted legacy 16-step editor, guarded legacy ZIP/TAR recovery. COPY performs full PCM GET after PUT (PR #163); **ordinary Upload does not** (only FILE_INFO/metadata/size).
- **REPITCH implemented**: ON-by-default per-session toggle; provenance preflight and x2/−12 preparation. Physical playback not accepted: [ZAT-77](https://linear.app/clouded/issue/ZAT-77) In Review.
- **Official .pak/.ppak:** read-only archive/slot preview (PR #164); detached offline PCM/TAR staging (PR #165); **actual Restore OFF** ([ZAT-92](https://linear.app/clouded/issue/ZAT-92) In Progress).
- **Pads:** EP-133 2.5.1 scoped READ; WRITE disabled, [PR #139](https://github.com/Zatumanen/Ko-tool/pull/139) still Draft.
- **Visuals:** seven browser-input dock meters, RMS dBFS ≠ LUFS, no verified EP USB Audio or advanced recorder. Approved standalone Sequencer, FX-MIC, EP-136 stages remain future work.

## Evidence and release

- [CI #43707438664](https://github.com/Zatumanen/Ko-tool/actions/runs/43707438664): 848/848 Node, 113/113 fake-EP Chromium, 1/1 versioned-dist Chromium, Pages/preflight PASS on snapshot SHA. Fake EP is **not hardware acceptance**.
- Scoped owner-observed EP-133 2.5.1 Pad READ/UI HIL (P01/A) recorded in [TESTING](TESTING.md) and [history](history/PROJECT_STATE-2026-11-12.md). COPY/REPITCH/restore/interruption acceptance remains open; further HIL deferred by owner 2026-11-14 ([ZAT-68](https://linear.app/clouded/issue/ZAT-68)).
- [Earlier Pages #43586790943](https://github.com/Zatumanen/Ko-tool/actions/runs/43586790943) was automatic Jekyll. Owner switched Settings → Pages → Source to GitHub Actions on 15-Nov; no automatic Pages deployment followed PR #166. Admin setting not independently readable here. First manual deploy remains untested and requires explicit approval. See [RELEASE](RELEASE.md) and [ZAT-93](https://linear.app/clouded/issue/ZAT-93).
- Release 1.0 not accepted; [owner decisions](roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) prescribe six sequential stages. [AGENTS](../AGENTS.md) controls permissions; [Linear](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca) tracks live tasks.
