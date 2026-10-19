# K.O. Tool — project state

Updated: 2026-10-20 (Europe/Moscow). Not live tracker state.
Basis: origin/main d01ce5e (PR138 merged), inspected source.
Verify current code before edits.

## Architecture and implemented scope

Static HTML/CSS/ES modules on GitHub Pages; Node.js 22 builds/tests, no production backend/database.
- K.O. Tool: browser virtual desktop, classic UI active; OS redesign paused pending owner decision.
- SpeedUpperCut: x2/−12 audio preparation, WAV/ZIP, file/folder imports, Original channels/playmode, waveform/chop editing.
- My EP: physical-device sample/project companion; exact firmware/evidence gates. Project inspector, opt-in saved refresh and restricted 16-step authoring exist.
- Visuals: separate browser dock from 52fc858/PR133, seven modules, selected audio input, layouts/local snapshots, themes, explicit START; physical USB Audio compatibility still needs HIL.

## Owner decisions and remaining features

Projects/Sequencer need a connected authorized EP. Saved Step Sequencer/Piano Roll belong inside My EP Projects; complete read-only views remain pending. LIVE needs protocol evidence, not faster polling. Converter/Visuals with another selected input work independently of EP.
Future My EP REPITCH defaults ON: incoming exact pitch−12 skips x2; malformed metadata fails. Direct upload does not implement it yet. Community/sharing/donations remain proposals.

## Current work and limits

- PR138 merged: stale Visuals START and native drag cleanup fixes; CI622 Node/65 Chromium and Pages passed. Runner limits: [runtime](CODEX.md#existing-cloud-runtime).
- [Draft PR139](https://github.com/Zatumanen/Ko-tool/pull/139): confirmed-only properties, session guards, outside deselection, waveform bounds and WAV smpl metadata. Prior CI: Node633; Chromium70 passed +1 retried/flaky; Pages build passed. Local Chromium failures remain separate. No new HIL.
- Owner approved [pad design](superpowers/specs/2026-10-19-my-ep-pad-properties-design.md), [plan](superpowers/plans/2026-10-19-my-ep-pad-properties.md) and delegated execution. Tasks 1–4 implemented/reviewed; Task 5 adds synthetic browser/recovery evidence. Task 6 cumulative checks/release pending. ZAT-49 remains open: production pad writes are evidence-denied; sample/archive HIL does not authorize them.
- Real captures lack GET/MOVE and failure sessions. Exact-firmware write gates remain mandatory.
- ZAT-44 Done: PR117/125 plus owner acceptance on 2026-10-19. ZAT-9 interruption/recovery was not performed and is deferred by owner; keep open. ZAT-39 still awaits original folder retest. ZAT-48 remains stabilization priority.
- [Reference catalog](REFERENCE_SOURCES.md): official Sample Tool primary; all five supplied WASM exactly match ours. Both ZIPs/19 files retained outside Git with hashes; local workspace retention is not remote backup.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
