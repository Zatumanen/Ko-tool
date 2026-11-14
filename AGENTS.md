# K.O. Tool — agent instructions

## Scope, permission and architecture

- Talk to the owner in Russian. Technical references stay concise English; root README is for shipped user features; engineering belongs in AGENTS/docs.
- Reviews do not authorize edits. Before app code: align Linear, user README, AGENTS and skills/runtime. Docs permission covers docs only. Linear is the ongoing engineering work log: creating and updating issues, comments, checklists, evidence links and accurate workflow statuses needs no separate owner permission. Record work as it happens, including blockers, CI/E2E/HIL results and PR/commit links. Never mark Done without applicable acceptance evidence or imply owner acceptance.
- Inspect branch/status before Git actions. Do not edit main directly, switch/create branches, commit, push, open/merge PRs, rebase, reset or deploy without authorization for that action. Preserve user changes/worktrees. Main can publish GitHub Pages; release needs explicit approval.
- Use this isolated cloud checkout; no worktree unless explicitly requested. Prefer small reversible patches. Docs/config work must not alter application code, DSP, protocols, tests, dependencies, lockfiles, CI or builds as a side effect.
- Never disclose credentials, serials, private captures or user data. Check provenance/license before importing third-party code/assets. The repository currently has no root license granting reuse.
- K.O. Tool is the browser virtual desktop; SpeedUpperCut prepares audio; My EP manages physical EP; Visuals analyzes a selected browser audio input. Stack: static HTML/CSS/native JS, Node.js 22 for builds/tests; no production API/database or template/framework replacement.
- Paths: converter `js/app.js`, `js/audio/`; device/protocol `js/ep133/`, UI `js/ep133/ui/`; Visuals `js/visuals/`; `index.html`, `css/`; Pages `scripts/build-pages.mjs`; tests `tests/`.

## Binding product boundaries

- Classic app stays active. Do not activate the paused OS redesign/PR #110 without a new owner decision; verify live PR status only when relevant.
- My EP Projects and Saved/Live Sequencer require a physically connected, authorized EP. No offline archive viewer/editor. Disconnect invalidates actionable state and labels cached results stale. Standalone conversion remains independent.
- Approved Sequencer is a standalone icon/window using an authorized connected EP. The existing My EP 16-step editor is legacy, not final. Saved Step/Piano Roll and bidirectional Live require protocol/HIL evidence; no fake playhead or faster FILE polling.
- Saved-project polling is opt-in, AUTO OFF by default, about 20 seconds when enabled; stop when hidden/busy/disconnected. It is not unsaved/live state.
- Visuals is a separate in-browser icon/dock, not a native OS overlay or My EP panel. It may use another selected audio input without EP. Require explicit permission/source choice; no silent microphone fallback. MIDI/SysEx is not audio.
- Converter x2/−12 and My EP import are distinct. REPITCH is approved but unimplemented; pitch=-12 alone is not provenance. Never double-process.

## EP and audio safety — always applies

- Preserve deviceRuntime, scheduler/session ownership, exact-firmware evidence gates, strict FILE transactions, dependency checks, readback and recovery journals.
- Recognition, handshake minimums and raw FILE bitmasks do not authorize writes. Resolve operation permissions from current evidence/profile; unknown SKU/firmware/state fails closed. Never bypass busy/unsafe/recovery states, CRC/checksums, permissions or confirmation; no speculative retries after ambiguous failure/disconnect.
- Physical writes/destruction/interruption require scenario-specific owner approval, backup, expendable slots/projects and exact model/firmware/host recording. Read back authoritative state after writes. Referenced-sample deletion needs a second informed confirmation; cancel performs no write.
- Fake EP, synthetic vectors, green CI and existing HIL registry assertions are not a new hardware test. Report evidence scope accurately.
- Reuse canonical DSP in processor/audioEngine. Preserve PCM/metadata, channels/playmode, cancellation, HI/MID/LO and WASM ABI/integrity; no unverified resampler fallback or source-file overwrite. Converter keeps numeric prefixes; My EP has its own naming rule.

## TOKEN-EFFICIENT

1. Start with request, current branch/status, [PROJECT_STATE](docs/PROJECT_STATE.md) and relevant rules. Verify current code before editing; memory and commit titles are navigation, not proof.
2. Use rg to locate specific functions/files, immediate callers and tests. Read needed ranges; expand only for real dependencies. Reuse unchanged context. Do not auto-read the repository, all docs/history, archives or every skill.
3. Load only matching skill bodies. Small tasks: direct work and brief impact assessment, no elaborate plan, forced interview or extra approval round for already authorized work.
4. Complex bugs: short plan → reproduce/root cause → focused failing test when feasible → minimal patch → verification. Investigate repeated failures; do not retry or rewrite working code without evidence.
5. No subagents for simple work. Use only the two optional [roles](docs/CODEX.md) for independent work with a concrete benefit; one reviewer per change, no duplicate reviews/recursive spawning. Avoid unnecessary plugins, MCP servers and dependencies.
6. Prefer repository answers; use authoritative external documentation only for a missing answer. Store long logs in scratch, show results/errors only. Do not repeat completed research without new evidence.
7. Keep safety checks. This policy is not a token quota, billing setting or guaranteed cost reduction.

## Selective references

Read [23-Oct owner decisions](docs/roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) if scope conflicts. Six stages: My EP → SpeedUpperCut → Visuals → standalone Sequencer → FX-MIC → EP-136 in Visuals. Read relevant sections only; code proves implementation, not approval.

| Scope | Load only when relevant |
| --- | --- |
| New area/status review | [project-context](.agents/skills/project-context/SKILL.md), [state](docs/PROJECT_STATE.md) |
| EP, firmware, FILE/SysEx, recovery/writes | [ep-protocol-safety](.agents/skills/ep-protocol-safety/SKILL.md), [matrix](docs/testing/ep-device-compatibility-matrix.md), [HIL/testing](docs/TESTING.md); captures: [workflow](docs/testing/ep-file-capture-workflow.md) |
| DSP/WAV/metadata/import/export names | [audio-regression](.agents/skills/audio-regression/SKILL.md), [audio contract](docs/testing/audio-x2-pipeline.md) |
| Browser/UI/uploads/Playwright/fake EP | [browser-qa](.agents/skills/browser-qa/SKILL.md), [browser policy](docs/testing/browser-platform-support.md) |
| Visuals layout/theme/capture | Relevant [Visuals](docs/VISUALS.md) section; audio/browser skill only for affected surface |
| Saved/Live project views | [Sequencer](docs/SEQUENCER.md), owner decisions and device safety/testing |
| Owner roadmap/future REPITCH/community | Relevant [research](docs/PRODUCT_RESEARCH.md) section; proposals do not authorize implementation |

[Original AGENTS](docs/history/AGENTS-2026-10-18-before-token-efficient.md) preserves all owner choices verbatim. Unique decisions remain binding unless superseded by the owner. Consult only the needed archived passage if canonical docs omit/conflict; never auto-load the archive. [Codex setup](docs/CODEX.md) indexes decision homes.

## Checks and report

- Select by impact using [TESTING](docs/TESTING.md), starting with focused tests. Docs/skills/config need structure/link/schema/consistency checks, not full application E2E.
- Run npm test, npm run build:pages and npm run test:e2e when scope/risk warrants. Protocol/firmware/FILE writes/recovery/project mutation/DSP retain full mandatory suites and applicable HIL gates. Never weaken assertions or relabel fixtures for green.
- Reuse successful checks while relevant inputs remain unchanged. Repeat only after changes, failure or unresolved concern. Separate passed/failed/skipped/unrun; zero tests and simulations do not prove hardware readiness.
- Reply briefly: changed files/reason, branch/base, actual results, material limits and next action. No file/diff dumps or long progress narration. Keep Linear current without a separate permission request; base statuses and completion on real evidence. Linear tracking never authorizes code edits, Git operations, merge/deploy, device writes or release acceptance.
