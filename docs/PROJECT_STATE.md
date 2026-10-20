# K.O. Tool — project state

Updated: 2026-10-20 (Europe/Moscow). Snapshot; tracker is live elsewhere.
Basis: main 406edd9367881ccb1fa87f03e2b01521b0abb0a3 plus the owner-approved ZAT-61 Sample Library slice below. Local implementation and verification used checkout HEAD 487526ae61da3d007d846e070a8abb9763a4b2f9, whose tree matched that main before these edits. This snapshot records verification before packaging into a Draft PR; subsequent CI evidence belongs to the exact PR HEAD.
Check current code before edits; update for material changes.

## Architecture and implemented scope

Static HTML/CSS/ES modules on GitHub Pages; Node.js 22 builds/tests, no production backend/database.
- K.O. Tool: browser virtual desktop, classic UI active; OS redesign paused pending owner decision.
- SpeedUpperCut: x2/−12 audio preparation, WAV/ZIP, file/folder imports, Original channels/playmode, waveform/chop editing.
- My EP: physical-device sample/project companion; exact firmware/evidence gates. Project inspector, opt-in saved refresh and restricted 16-step authoring exist.
- Visuals: browser dock, seven modules, selected audio input, layouts, themes, explicit START; real USB Audio still needs HIL.
- Codex: compact root rules, selective project/research skills and two optional read-only roles; runtime role activation is separate.

## Owner decisions and remaining features

Projects/Sequencer need a connected authorized EP. Saved Step Sequencer/Piano Roll belong inside My EP Projects; complete read-only views remain pending. LIVE needs protocol evidence, not faster polling. Converter/Visuals with another selected input work independently of EP.
Future My EP REPITCH defaults ON: incoming exact pitch−12 skips x2; malformed metadata fails. Direct upload does not implement it yet. Community/sharing/donations remain proposals.

## Current work and limits

- `main` includes merged [PR #138](https://github.com/Zatumanen/Ko-tool/pull/138): stale Visuals capture and operation-indicator drag cleanup fixes. The former fix branch is not ongoing work. Recheck `main` on new tasks.
- PR #138 passed earlier Node/Chromium/Pages checks; these are dated CI evidence, not a new run or hardware claim.
- [Release 1.0 Linear project](https://linear.app/clouded/project/ko-tool-release-10-2f713ebc0fca): 20 scoped issues ZAT-52–ZAT-71 in 8 milestones. Release remains unapproved; scope, dependencies, physical evidence and RC verdict are tracked there, not inferred from this snapshot.
- Draft PRs [#137](https://github.com/Zatumanen/Ko-tool/pull/137) MOVE and [#139](https://github.com/Zatumanen/Ko-tool/pull/139) pad metadata need physical evidence; CI is not permission to write.
- Merged [PR #142](https://github.com/Zatumanen/Ko-tool/pull/142) provides temporary MOVE protection: a mandatory strict FILE transaction scans every saved project's pad dependencies for the complete source set before the first MOVE. Referenced samples and unreadable/unsupported dependency data fail closed; CRC/readback and session guards remain. This does not rewrite TAR archives or implement project-preserving MOVE; ZAT-58/PR #137 remain incomplete.
- Baseline main verification: [Actions run 39485310267](https://github.com/Zatumanen/Ko-tool/actions/runs/39485310267) passed Node 645/645, Chromium 70/70 and Pages build for 406edd9. This evidence does not cover the local library changes.
- Local ZAT-61 package selectively reuses the library controller and library tests from PR #139 at e8af28843d716901516e041110dd8168eeefec25. PITCH, PLAY MODE and TIME MODE use the existing profile permissions and strict FILE transactions; canonical metadata and SAVED require matching SET/GET readback. Rapid edits retain the latest intent, fractional pitch is preserved, and PLAY MODE takes its release companion after acquiring the FILE lease. Malformed readbacks report NOT SAVED. Queued writes and recovery reads check the original device session inside their lease; disconnect/reset invalidates them. Closing properties ends gestures and hides the menu while an already chosen edit may finish in the same session; outside clicks deselect without navigation.
- This package adds no assigned-pad UI/controller/runtime/writer, pad SET/restore or recovery. Library defaults and assigned-pad parameters remain separate. No FILE protocol, firmware gate, project, journal, sample transfer or DSP implementation changes; MOVE protection remains intact.
- Local ZAT-61 verification: 109/109 focused Node checks passed (37 new library regressions plus 72 existing helper/dependency/MOVE checks), Pages build and preflight passed (existing missing-lockfile warning). Full `npm test` is not green here: 93/96 file wrappers passed; child-process `spawnSync EPERM`/empty stdout blocks `ep133`, `waveform-editor` and `ep-file-golden-runtime.behavior`. Per-file runs with process isolation disabled report 675/682 checks passed; the seven failures are two subprocess syntax checks, four empty-stdout runtime scenarios and their parent test. Direct syntax checks (62 files) and the four standalone synthetic runtime scenarios passed; they do not replace the full gate. Playwright discovers 75 cases, including five new library scenarios, but E2E is unrun under the known Chromium sandbox restriction (`setsockopt EPERM`/SIGTRAP). Independent review found and verified fixes for queued cross-session recovery GET and malformed zero readback; no remaining findings. No new CI run or physical EP/HIL operations were performed. Library editing has automated software evidence only; pad editing remains unintegrated and unconfirmed.
- Real captures lack GET/MOVE and timeout/late-response/firmware-debug/interrupted-session. Firmware write gates remain mandatory.
- HIL requires renewed owner approval, exact model/firmware/browser, backup and authoritative readback.
- Release priorities live in Linear; historical ZAT-48/ZAT-9 and incomplete device evidence are not silently closed.
- [Reference catalog](REFERENCE_SOURCES.md) keeps official Sample Tool provenance and retained external artifacts outside Git.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
