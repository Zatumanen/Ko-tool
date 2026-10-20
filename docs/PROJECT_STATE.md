# K.O. Tool — project state

Updated: 2026-10-20 (Europe/Moscow). Snapshot; tracker is live elsewhere.
Basis: GitHub main d01ce5e7c71be28b29a54245b2028faa0793490b, reviewed PRs; no new CI/HIL run.
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
- Real captures lack GET/MOVE and timeout/late-response/firmware-debug/interrupted-session. Firmware write gates remain mandatory.
- HIL requires renewed owner approval, exact model/firmware/browser, backup and authoritative readback.
- Release priorities live in Linear; historical ZAT-48/ZAT-9 and incomplete device evidence are not silently closed.
- [Reference catalog](REFERENCE_SOURCES.md) keeps official Sample Tool provenance and retained external artifacts outside Git.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
