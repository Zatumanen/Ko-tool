# K.O. Tool — project state

Updated: 2026-10-21 (Europe/Moscow). Snapshot; tracker is live elsewhere.
Basis: main eabb12f797582971bf4c9c3d9795bfefa6ed78ff plus the local read-only Pad Properties package. Local implementation used checkout HEAD 4f4ceb78c4dc8b5d6f4ee3e3dd5c459fca5548eb; both commits had tree 34ab753911124ba888a5b319206ef26afdc03ab4 before these edits. This snapshot records local verification before Draft PR packaging; subsequent CI belongs to its exact HEAD. Merge, deployment and hardware operations remain unauthorized.
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
- Merged [PR #143](https://github.com/Zatumanen/Ko-tool/pull/143) is the Sample Library source of truth: existing profile permissions, strict SET/GET confirmation, truthful status, latest intents, fractional PITCH and session-safe writes/recovery GET. [PR-head CI](https://github.com/Zatumanen/Ko-tool/actions/runs/39498118967) passed Node 682/682, Pages build and preflight; Chromium reported 74 passed + 1 flaky native Option-drag COPY (retry #1). No HIL claim follows.
- Local Read-only Pad Properties selectively extracts LIST/INFO discovery and metadata GET from #139 at e8af28843d716901516e041110dd8168eeefec25. Independent read-only reader/controller receive no writer, restore or pad recovery capabilities; FID, names, parents, node rights, assignment, session and late-response checks fail closed. Unknown/missing values remain UNVERIFIED; no library/TAR fallback. The modal isolates background keyboard/paste/drop and restores focus.
- **Scoped Pad Metadata READ (Draft PR #144, commit `8c25ab230470aac7189536df6d6df01de1facc05`):** owner-authorized `capture-observed` READ only for EP-133 `TE032AS001` with exact connected-device `metadata.os_version` 2.5.1, supported compatibility and matching firmware READ evidence. No firmware fallback or unscoped #139 READ. EP-40, EP-1320, unknown SKU/OS and other firmware remain denied before FILE. All pad WRITE remains false; no writer/restore/recovery integration. Existing identity/assignment/session/late-response and MOVE guards are unchanged.
- [Sanitized capture audit](testing/ep133-pad-read-capture-audit.md): two owner-audited private EP-133 2.5.1 captures, each 21 outbound READ / 20 successful RX, no writes. Complete FID 3201 GET pair confirms 12 fields; final FID 3202 RX is missing in both raw traces despite a complete application summary. Captures are incomplete, not independently hash-verified here. This supports scoped GET, not accuracy of all UI fields relative to a saved project or full UI/HIL acceptance. Raw traces remain private; EP-40/EP-1320 READ is unverified.
- **Scoped READ CI baseline at `8c25ab2` ([Actions 39600248174](https://github.com/Zatumanen/Ko-tool/actions/runs/39600248174)):** full Node suite, Pages build and Codex preflight passed; Chromium 78 passed, 3 failed, 1 flaky. Two negative Pad READ tests were blocked by a global error modal: right-click sample selection also opened the independently permission-gated Sample Library editor. The unknown-OS test expected transient `CONNECT EP SERIES` while session ownership displayed `CLOSE OTHER EP TOOLS BEFORE FILE OPERATIONS`, so its subsequent no-FILE assertion did not execute. The positive production EP-133 2.5.1 fake-EP UI path passed. This follow-up adjusts E2E selection/connection assertions and updates CI documentation; a new exact-head E2E run is required. Earlier isolated local checks: focused Node 167/167, full npm test blocked by subprocess EPERM in three wrappers, Chromium server bind EPERM.
- Prior #144 verification (does not cover the subsequent local evidence/gate changes): 168/168 targeted Node checks (59 new plus 109 library/MOVE/helper/dependency checks), 67 direct syntax checks and Pages build passed. Full npm test is not green: 95/98 file wrappers passed. Per-file runs without process isolation: 734/741 passed; two child syntax checks, four child runtime scenarios and their parent fail through subprocess EPERM/empty stdout in ep133, waveform-editor and ep-file-golden-runtime.behavior. These diagnostic runs do not replace the full gate. Preflight passed with the existing missing-lockfile warning. Playwright discovers 78 cases, including three real UI denial/isolation/library-preservation scenarios. E2E execution is blocked at server startup by `listen EPERM 127.0.0.1:4173`, before Chromium; sandbox was not disabled. No hardware or new CI was run. Independent review found and verified the modal-isolation fix with real sample memory; keyboard/paste/drop perform no background operations. Raw metadata disclosure is included in the Tab cycle.
- [COPY investigation / separate ZAT-59 proposal](testing/option-drag-copy-investigation.md): old test readiness can succeed during hydration with draggable=false; a synthetic reproduction cancels drag with zero transfers. The exact CI cause remains unproven without trace. No COPY fix is included. ZAT-58 and physical compatibility remain open.
- Supplied pad captures include scoped GET but lack the final FID 3202 RX. MOVE and timeout/late-response/firmware-debug/interrupted-session evidence remains incomplete. Firmware write gates remain mandatory.
- HIL requires renewed owner approval, exact model/firmware/browser, backup and authoritative readback.
- Release priorities live in Linear; historical ZAT-48/ZAT-9 and incomplete device evidence are not silently closed.
- [Reference catalog](REFERENCE_SOURCES.md) keeps official Sample Tool provenance and retained external artifacts outside Git.

## Sources

[Rules](../AGENTS.md) · [Codex](CODEX.md) · [Testing/HIL](TESTING.md) · [Visuals](VISUALS.md) · [Sequencer](SEQUENCER.md) · [Owner research/REPITCH](PRODUCT_RESEARCH.md).
