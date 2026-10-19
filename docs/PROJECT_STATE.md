# K.O. Tool — project state

Updated: 2026-10-19 (Europe/Moscow). Snapshot, not live tracker state.
Basis: origin/main b696eac (same source tree as tested dac76e4), source inspection and verification.
Verify current code before edits; update this file only for material state changes.

## Architecture and implemented scope

Static HTML/CSS/ES modules on GitHub Pages; Node.js 22 builds/tests, no production backend/database.
- K.O. Tool: browser virtual desktop, classic UI active; OS redesign paused pending owner decision.
- SpeedUpperCut: x2/−12 audio preparation, WAV/ZIP, file/folder imports, Original channels/playmode, waveform/chop editing.
- My EP: physical-device sample/project companion; exact firmware/evidence gates. Project inspector, opt-in saved refresh and restricted 16-step authoring exist.
- Visuals: separate browser dock from 52fc858/PR133, seven modules, selected audio input, layouts/local snapshots, themes, explicit START; physical USB Audio compatibility still needs HIL.
- Codex: compact root rules, selective project/research skills and two optional read-only roles; runtime role activation is separate.

## Owner decisions and remaining features

Projects/Sequencer need a connected authorized EP. Saved Step Sequencer/Piano Roll belong inside My EP Projects; complete read-only views remain pending. LIVE needs protocol evidence, not faster polling. Converter/Visuals with another selected input work independently of EP.
Future My EP REPITCH defaults ON: incoming exact pitch−12 skips x2; malformed metadata fails. Direct upload does not implement it yet. Community/sharing/donations remain proposals.

## Current work and limits

- Branch fix/visuals-capture-and-upload-drag based on b696eac. Patch: stale Visuals START guard + regression; MOVE E2E waits for post-upload row cleanup. Prior local pair-width/COPY fixes are not in this checkout.
- Fresh Node22.22.0:622 tests passed,0 failed/skipped; Pages build passed. Chromium:63 passed,0 failed. Restricted-runner child-process failures are environmental; see [runtime](CODEX.md#existing-cloud-runtime). No hardware claim.
- Real captures lack GET/MOVE and timeout/late-response/firmware-debug/interrupted-session. Exact-firmware write gates remain mandatory.
- HIL next: owner reported EP-133 connected, EP-40 available, macOS12.7.6/Chrome; exact firmware/browser versions and physical results pending. Recheck connection.
- Priorities remain ZAT-48 stabilization and ZAT-9 HIL; ZAT-39 folder retest and ZAT-44 physical saved-project refresh acceptance remain open. No blanket hardware-compatibility claim.
- [Reference catalog](REFERENCE_SOURCES.md): official Sample Tool primary; all five supplied WASM exactly match ours. Both ZIPs/19 files retained outside Git with hashes; local workspace retention is not remote backup.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
