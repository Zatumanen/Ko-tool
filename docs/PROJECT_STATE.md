# K.O. Tool — current project state

**Checkpoint:** 14 November 2026, audited `main@7e89fdd2b5e6772905a8ee0a44106f4007a2a7e4` (PR #165). This is a **dated checkpoint**, not a claim that HEAD stays fixed. Check GitHub and Linear before new work. Full 12-Nov evidence/PR history is preserved [unchanged](history/PROJECT_STATE-2026-11-12.md).

## Product and active code

- Static HTML/CSS/native ES modules; Node 22 tooling, GitHub Pages, no application backend. Classic SpeedUpperCut UI active. OS redesign [PR #110](https://github.com/Zatumanen/Ko-tool/pull/110) remains paused Draft.
- **SpeedUpperCut:** x2/−12, HI/MID/LO, channel/playmode choices, file/folder batch conversion, WAV/ZIP export; waveform/chop exists in current classic UI but differs from approved minimal target. SpeedUpperCut→My EP batch destination preview is pending [ZAT-79](https://linear.app/clouded/issue/ZAT-79).
- **My EP:** firmware-scoped EP companion, Sample Library, upload/MOVE/COPY/DELETE with independent safety guards; project read/restricted editor, backup, read-only pad view. COPY now performs destination **full PCM readback** ([PR #163](https://github.com/Zatumanen/Ko-tool/pull/163)); ordinary Upload confirms FILE_INFO/metadata/size but does **not** read back full PCM. Do not claim every path byte-verified.
- **REPITCH is implemented**, not pending code: session-local toggle ON by default, per-batch preflight/provenance checks and x2/−12 preparation in `myEpRepitch.js`/`sampleUploadController.js`. Physical playback acceptance remains [ZAT-77](https://linear.app/clouded/issue/ZAT-77) In Review.
- **Official PAK/PPAK:** ZIP/WAV/TAR inspection and per-slot read-only preflight ([PR #164](https://github.com/Zatumanen/Ko-tool/pull/164)); detached offline PCM/project staging ([PR #165](https://github.com/Zatumanen/Ko-tool/pull/165)). **Production official PAK/PPAK RESTORE DISABLED**; [ZAT-92](https://linear.app/clouded/issue/ZAT-92) still In Progress. Legacy ZIP/TAR recovery is separate.
- **Pad properties:** scoped EP-133 OS 2.5.1 read-only view; production pad metadata WRITE disabled. [PR #139](https://github.com/Zatumanen/Ko-tool/pull/139) remains Draft, no hardware approval.
- **Visuals:** browser audio-input dock with seven v1 modules; RMS dBFS is not LUFS; advanced meters/recorder pending. Actual USB Audio flow remains unverified.
- **Sequencer:** existing restricted in-My-EP 16-step editor is legacy; approved standalone Saved/Live app, FX-MIC Studio and EP-136 Sidekick are future stages.

## Evidence and release blockers

- [Post-merge CI #43586791491](https://github.com/Zatumanen/Ko-tool/actions/runs/43586791491) for above SHA: **847/847 Node, 113/113 fake-EP Chromium**, Pages build and preflight PASS. Simulation is not physical HIL.
- Earlier owner-observed EP-133 OS 2.5.1 Pad READ/UI acceptance is scoped to P01/Group A; captures and limitations remain in [TESTING](TESTING.md) and [12-Nov history](history/PROJECT_STATE-2026-11-12.md). Other physical COPY/REPITCH/restore/interruption tests are **not verified** and were deferred by owner on 14-Nov; [ZAT-68](https://linear.app/clouded/issue/ZAT-68) stays In Progress.
- **Deployment discrepancy:** actual [Pages #43586790943](https://github.com/Zatumanen/Ko-tool/actions/runs/43586790943) was an automatic branch-triggered **Jekyll** deployment, not `dist` from manual `deploy-pages.yml`. GitHub repository **Settings → Pages → Source** must be changed to **GitHub Actions** by authorized admin before relying on a controlled manual release. Never claim the source is changed without confirming it. See [release runbook](RELEASE.md).
- Current hardening tracked in [ZAT-93](https://linear.app/clouded/issue/ZAT-93), on a separate branch; unmerged work is not a shipped feature. Do not merge while branch-based auto-publishing remains active without a separately approved release decision.

## Canonical decisions

[23-Oct owner scope](roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) → six sequential stages. [TESTING](TESTING.md) → evidence and tests. [AGENTS](../AGENTS.md) → permissions and safety. [Linear project](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca) → live task states. Code at the checked HEAD → implementation truth.
