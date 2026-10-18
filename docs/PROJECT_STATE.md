# K.O. Tool — project state

Updated: 2026-10-18 (Europe/Moscow). Snapshot, not live tracker state.
Basis: main/checkout base 52fc858, relevant source inspection and local verification.
Verify current code before edits; update this file only for material state changes.

## Architecture and implemented scope

Static HTML/CSS/ES modules on GitHub Pages; Node.js 22 builds/tests, no production backend/database.
- K.O. Tool: browser virtual desktop, classic UI active; OS redesign paused pending owner decision.
- SpeedUpperCut: x2/−12 audio preparation, WAV/ZIP, file/folder imports, Original channels/playmode, waveform/chop editing.
- My EP: physical-device sample/project companion; exact firmware/evidence gates. Project inspector, opt-in saved refresh and restricted 16-step authoring exist.
- Visuals: separate browser dock in main52fc858/PR133, seven modules, selected audio input, layouts/local snapshots, themes, explicit START; physical USB Audio compatibility still needs HIL.
- Codex: compact root rules, four selective project skills and two optional read-only roles; runtime role activation is separate.

## Owner decisions and remaining features

Projects/Sequencer need a connected authorized EP. Saved Step Sequencer/Piano Roll belong inside My EP Projects; complete read-only views remain pending. LIVE needs protocol evidence, not faster polling. Converter/Visuals with another selected input work independently of EP.
Future My EP REPITCH defaults ON: incoming exact pitch−12 skips x2; malformed metadata fails. Direct upload does not implement it yet. Community/sharing/donations remain proposals.

## Current work and limits

- Branch work has local uncommitted Visuals stale-resume/pair-width fixes and COPY readiness correction; not published/merged. Prior run:624 Node tests, build,65 Chromium E2E passed; independent review clean. These are dated software results, not fresh checks/HIL.
- Real captures lack GET/MOVE and timeout/late-response/firmware-debug/interrupted-session. Exact-firmware write gates remain mandatory.
- HIL next: owner reported EP-133 connected, EP-40 available, macOS12.7.6/Chrome; exact firmware/browser versions and physical results pending. Recheck connection.
- README priorities: ZAT-48 stabilization and ZAT-9 HIL; live Linear statuses were unavailable. No blanket hardware-compatibility claim.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
