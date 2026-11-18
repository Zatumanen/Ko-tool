# Implementation matrix: K.O. TOOL 1.0

**Snapshot:** 2026-11-17, source inspected at `main@23a814154047b732a6fb7884be9d9e95cdb065af`; latest PR state and Linear must be rechecked before starting work. This is a **navigation/evidence snapshot**, not a guarantee about later `main` or a claim that all acceptance criteria passed.

**Visuals-only addendum (18 November 2026):** integration PR #194 is merged as `main@ab5706e425c20e06ede35012053d5b211846d53c`. [Post-merge CI](https://github.com/Zatumanen/Ko-tool/actions/runs/44267219851) passed 1055 Node, 161 Chromium source and 2 Pages-dist E2E. The Visuals software rows below exist together on this commit, but owner appearance, endurance and actual EP USB Audio remain unaccepted. Other matrix evidence retains its dated snapshot. Do not re-merge #188–#193.

The owner-approved six-stage sequence remains in [roadmap](roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md). Use this matrix with the [pre-implementation gate](IMPLEMENTATION_GATE.md), [TESTING](TESTING.md) and the relevant exact-firmware evidence. It does not authorize product changes, physical device operations or a Pages deployment.

### Meaning of columns

- **Software:** `IMPLEMENTED` = relevant app path exists; `PARTIAL` = only a subset exists; `MISSING` = approved target is not present; `BLOCKED` = deliberately disabled by a safety gate. These are **not release statuses**.
- **Automated:** `PASS` = matching Node/browser cases exist and the recorded CI was green **for this snapshot**, not proof of a complete feature; `PARTIAL` = tests cover only a related/legacy subset; `NOT TESTED` = no acceptance evidence for the target.
- **Hardware:** `SCOPED` = some earlier specifically bounded HIL exists, but not general approval; `HIL PENDING` = required physical acceptance not established for this scope; `BLOCKED` = software safety gate prevents the physical scenario; `NOT APPLICABLE` = browser-only acceptance (other app integration may still need HIL).
- Linear **Done is not an evidence level**. A missing physical criterion must remain visible even when the tracker says Done. All PASS entries refer to the **test scope**, not to all requirements of the associated issue.

<!-- MATRIX_ROWS_START -->
| ID | Roadmap scope | Software | Automated | Hardware | Evidence and remaining gap |
| --- | --- | --- | --- | --- | --- |
| MEP-LIBRARY | 01 · My EP sample library and sync | IMPLEMENTED | PASS | SCOPED | `js/ep133/ui/sampleLibrarySync.js`, `tests/e2e/my-ep.spec.mjs`; exact model/firmware permissions still apply |
| MEP-UPLOAD | 01 · Upload + authoritative PCM readback | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/ui/sampleUploadController.js`, `tests/e2e/sample-upload-pcm-readback.spec.mjs`; physical readback not newly accepted |
| MEP-MOVE | 01 · Transactional sample MOVE | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/ui/sampleMoveController.js`, `tests/e2e/sample-move-dependencies.spec.mjs`; latest dependency/rollback behavior needs scoped HIL |
| MEP-COPY | 01 · PCM-verified COPY | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/ui/sampleCopyController.js`, `tests/e2e/sample-copy-pcm-readback.spec.mjs`; physical acceptance open |
| MEP-DELETE | 01 · Guarded DELETE and project dependencies | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/ui/sampleDeleteController.js`, `tests/e2e/sample-dependency-guard.spec.mjs`; no destructive HIL run |
| MEP-PADS-READ | 01 · Saved pad parameters | PARTIAL | PASS | SCOPED | `js/ep133/ui/padPropertiesReadOnlyController.js`, `tests/e2e/my-ep-pad-readonly.spec.mjs`; narrowly scoped EP-133 2.5.1 READ only |
| MEP-PADS-WRITE | 01 · Editing assigned pad state | BLOCKED | PASS | BLOCKED | `js/ep133/ui/padPropertiesReadOnlyController.js`; WRITE is disabled; Draft PR #139 is **not merged**; PASS refers to read-only guard |
| MEP-PROJECTS | 01 · Project authoring, readback and recovery | PARTIAL | PASS | HIL PENDING | `js/ep133/ui/projectSequencerController.js`, `tests/project-sequencer-ui.test.mjs`; existing editor is restricted, not final sequencer |
| MEP-PAK-EXPORT | 01 · Official PAK/PPAK export | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/officialPak.js`, `tests/official-pak-export.test.mjs`; physical interchange acceptance remains separate |
| MEP-PAK-PREVIEW | 01 · Official PAK/PPAK read-only inspection | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/officialPakReader.js`, `js/ep133/officialPakPreviewPlan.js`, `tests/official-pak-preview-plan.test.mjs`; no write permission implied |
| MEP-PAK-RESTORE | 01 · Actual official PAK/PPAK Restore | PARTIAL | PASS | BLOCKED | `js/ep133/officialPakRestoreStaging.js`, `js/ep133/ui/backupRestoreController.js`, `tests/official-pak-restore-staging-integration.test.mjs`; **offline integrity staging only, Restore disabled** |
| MEP-REPITCH | 01 · My EP x2/−12, KORP anti-double-process | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/myEpRepitch.js`, `js/ep133/repitchProvenance.js`, `tests/e2e/my-ep-repitch.spec.mjs`; actual device playback/CRC acceptance open |
| SUC-X2 | 02 · SpeedUpperCut reference x2 engine | IMPLEMENTED | PASS | HIL PENDING | `js/audio/processor.js`, `tests/audio-pipeline-golden.test.mjs`; synthetic golden ≠ physical playback |
| SUC-FOLDERS | 02 · Folder WAV/ZIP export | IMPLEMENTED | PASS | NOT APPLICABLE | `js/app.js`, `tests/e2e/folder-import-recovery.spec.mjs`; browser-only export scope |
| SUC-TO-MYEP | 02 · Multi-drag, destination preview | IMPLEMENTED | PASS | HIL PENDING | `js/ep133/ui/sampleUploadChoice.js`, `tests/e2e/my-ep-numbered-upload-choice.spec.mjs`; physical transfer still unaccepted |
| VIS-BASE | 03 · Seven basic Visuals panels | IMPLEMENTED | PASS | NOT APPLICABLE | `js/visuals/app.js`, `tests/e2e/visuals.spec.mjs`; input-driven browser baseline only, not completed advanced meters; permission discovery releases temporary capture before asynchronous device enumeration (`tests/visuals-audio.test.mjs`) |
| VIS-TRIGGER | 03 · Attack-centered held waveform | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/transientTrigger.js`, `tests/visuals-trigger.test.mjs`; continuous PCM trigger and controls; exact-head browser/CI and owner visual acceptance tracked in PR, video comparison unverified |
| VIS-SPECTRUM | 03 · Continuous logarithmic Spectrum curve | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/spectrum.js`, `tests/visuals-spectrum.test.mjs`; float FFT/log Hz/dBFS display and time-based release; exact-head CI and owner aesthetic acceptance recorded in PR |
| VIS-SPECTROGRAM | 03 · Timestamped right-to-left history | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/spectrogram.js`, `tests/visuals-spectrogram.test.mjs`; bounded FFT queue survives resize and repaint changes; exact-head CI and owner visuals/performance acceptance tracked in PR |
| VIS-THEMES-PERF | 03 · Mono variants / adaptive Canvas / offscreen | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/renderClock.js`, `tests/visuals-render-clock.test.mjs`, `tests/e2e/visuals-themes-performance.spec.mjs`;3 globals, dark/light mono, independent snapshot cadence and Canvas60/30/15; owner/device palette, MBP performance and endurance pending in PR |
| VIS-XY | 03 · Stereo XY / labeled Artistic XY | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/xy.js`, `tests/visuals-xy.test.mjs`; direct L/R mapping and bounded timed afterglow; mono technical trace refused, derived mode explicit; exact-head CI and owner visuals tracked in PR |
| VIS-STEREO | 03 · Spectral Plasma Vector / correlation / balance | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/stereo.js`, `tests/visuals-stereo.test.mjs`; frequency-aware display, mono/silence guards and format-change stop; exact-head CI and owner visual acceptance tracked in PR |
| VIS-OUTPUT | 03 · L/R sample Peak / Hold / CLIP | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/outputMeters.js`, `tests/visuals-output-meters.test.mjs`, `tests/e2e/visuals-output-meters.spec.mjs`; continuous measurement independent of repaint, explicit mono/reset; exact-head CI and owner visual/endurance acceptance tracked in PR |
| VIS-LUFS | 03 · ITU-R BS.1770 LUFS | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/loudness.js`, `tests/visuals-loudness.test.mjs`; mono/stereo M/S/I gates/reset with18FFmpeg vectors and worklet; exact-head CI and owner/endurance acceptance tracked in PR |
| VIS-RECORDER | 03 · WAV 16/24-bit Recorder | IMPLEMENTED | PARTIAL | NOT APPLICABLE | `js/visuals/recorderPcm.js`, `js/visuals/recorder.js`, `tests/e2e/visuals-recorder.spec.mjs`; bounded64MiB PCM, pause/resume, explicit interrupted prefix, preview/save/discard; exact-head CI in PR, owner/endurance/physical input acceptance pending; unlimited disk streaming absent |
| SEQ-STANDALONE | 04 · Separate Step/Piano Roll app | PARTIAL | PARTIAL | HIL PENDING | `js/sequencer/app.js`, `js/sequencer/session.js`, `tests/sequencer-session.test.mjs`, `tests/e2e/sequencer.spec.mjs`; separate icon/window observes authorized shared runtime without MIDI acquisition or FILE traffic; Saved Step/Piano Roll still missing; legacy My EP editor unchanged |
| SEQ-LIVE | 04 · Hardware-authoritative bidirectional Live | MISSING | NOT TESTED | BLOCKED | `docs/SEQUENCER.md`; protocol/event/playhead evidence not established; no simulated Live authority |
| FXM-OFFLINE | 05 · FX-MIC offline pack/editor/audition | IMPLEMENTED | PASS | NOT APPLICABLE | `js/fxMic/app.js`, `tests/e2e/fx-mic-studio.spec.mjs`; audition is approximate Web Audio |
| FXM-LIVE | 05 · EP-2350 production Live | PARTIAL | PASS | HIL PENDING | `js/fxMic/liveSession.js`, `js/fxMic/serialTransport.js`, `tests/fx-mic-live.test.mjs`; stock 1.1.2 config read-only; Live writes not broadly enabled |
| EP136-SIDEKICK | 06 · EP-136 USB Audio inside Visuals | MISSING | NOT TESTED | HIL PENDING | `docs/roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md`; no separately accepted EP-136 integration |
<!-- MATRIX_ROWS_END -->

### Tracker inconsistencies and concrete evidence

- As of this snapshot, **Linear ZAT-77, ZAT-79 and ZAT-92 show Done**, but their issue descriptions still contain physical acceptance criteria. Their *software portions* have merged PRs; that does not turn these missing device tests into PASS or enable official Restore.
- PAK/PPAK reader/preview/staging existed **before** PR #179 (see PR #164 and #165). [PR #179](https://github.com/Zatumanen/Ko-tool/pull/179) surfaced existing CRC staging in the UI; [PR #180](https://github.com/Zatumanen/Ko-tool/pull/180) added a raw pitch-preservation guard; [PR #181](https://github.com/Zatumanen/Ko-tool/pull/181) added mandatory full-batch destination confirmation. They were **incremental changes, not original feature implementations**.
- Relevant merged-main full CI checks: [PR #179 post-merge](https://github.com/Zatumanen/Ko-tool/actions/runs/44052065091), [PR #180 post-merge](https://github.com/Zatumanen/Ko-tool/actions/runs/44054880413), [PR #181 post-merge](https://github.com/Zatumanen/Ko-tool/actions/runs/44070697069). These establish *automated* checks on their respective SHAs only, not the whole physical matrix.
- No new physical HIL was run for this audit. Earlier narrowly documented hardware reads do not transfer to a different firmware or operation. Owner defers new hardware acceptance until after software work. No deployment follows from a merge.

### Maintenance

Update a row only after inspecting the **current** source, direct caller and matching test plus the corresponding Linear issue/PR. Add PR and CI SHA to the row or its linked evidence whenever status materially changes. Never auto-upgrade `PARTIAL` to `IMPLEMENTED` or `HIL PENDING` to `SCOPED`/`PASS` solely because a PR merged or the tracker changed. The CI audit checks **structure and evidence paths**, not factual truth; review remains mandatory.
