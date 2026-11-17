# K.O. Tool — agent instructions

## Scope, permission and architecture

- Use Russian with the owner, concise English for technical references. README describes shipped features; engineering belongs in AGENTS/docs.
- Reviews do not authorize edits. Before app code: align Linear, README, AGENTS and skills/runtime. Docs permission covers docs only. Linear issues, comments, statuses, blockers, CI/HIL results and PR links need no separate approval. Done requires acceptance evidence.
- Verify approvals and branch before Git actions; preserve user changes. Never edit `main` directly. Deploy manual-test and release builds only to public GitHub Pages, without private copies. Deployment requires separate approval; see [release workflow](docs/RELEASE.md).
- Use isolated checkout, no worktree unless requested, and reversible patches. Docs-only edits must not change app code, tests, dependencies or CI as a side effect.
- Never disclose credentials, serials, private captures or user data. Check provenance/license before importing third-party code/assets. The repository currently has no root license granting reuse.
- K.O. Tool is the browser virtual desktop; SpeedUpperCut prepares audio; My EP manages physical EP; Visuals analyzes a selected browser audio input. Stack: static HTML/CSS/native JS, Node.js 22 for builds/tests; no production API/database or template/framework replacement.
- Paths: converter `js/app.js`, `js/audio/`; device/protocol `js/ep133/`, UI `js/ep133/ui/`; Visuals `js/visuals/`; `index.html`, `css/`; Pages `scripts/build-pages.mjs`; tests `tests/`.

## Binding product boundaries

- Owner authorized ZAT-50 queue exception on 2026-11-15; ZAT-63/48/9 remain open. [FX-MIC contract](docs/testing/fx-mic-studio.md): offline/approximate preview; physical Live acceptance, merge and deploy remain separately gated.

- Classic app stays active. Do not activate the paused OS redesign/PR #110 without a new owner decision; verify live PR status only when relevant.
- My EP Projects and Saved/Live Sequencer require a physically connected, authorized EP. No offline archive viewer/editor. Disconnect invalidates actionable state and labels cached results stale. Standalone conversion remains independent.
- Approved Sequencer is a standalone icon/window using an authorized connected EP. The existing My EP 16-step editor is legacy, not final. Saved Step/Piano Roll and bidirectional Live require protocol/HIL evidence; no fake playhead or faster FILE polling.
- Saved-project polling is opt-in, AUTO OFF by default, about 20 seconds when enabled; stop when hidden/busy/disconnected. It is not unsaved/live state.
- Visuals is a separate in-browser icon/dock, not a native OS overlay or My EP panel. It may use another selected audio input without EP. Require explicit permission/source choice; no silent microphone fallback. MIDI/SysEx is not audio.
- Converter x2/−12 and My EP import are distinct. REPITCH is implemented (toggle ON by default, provenance preflight), but physical playback acceptance ZAT-77 remains open. Pitch=-12 alone is not provenance; never double-process.

## EP and audio safety — always applies

- Preserve deviceRuntime, scheduler/session ownership, exact-firmware evidence gates, strict FILE transactions, dependency checks, readback and recovery journals.
- Recognition, handshake minimums and raw FILE bitmasks do not authorize writes. Resolve operation permissions from current evidence/profile; unknown SKU/firmware/state fails closed. Never bypass busy/unsafe/recovery states, CRC/checksums, permissions or confirmation; no speculative retries after ambiguous failure/disconnect.
- Physical writes/destruction/interruption require scenario-specific owner approval, backup, expendable slots/projects and exact model/firmware/host recording. Read back authoritative state after writes. Referenced-sample deletion needs a second informed confirmation; cancel performs no write.
- Fake EP, synthetic vectors, green CI and existing HIL registry assertions are not a new hardware test. Report evidence scope accurately.
- Reuse canonical DSP in processor/audioEngine. Preserve PCM/metadata, channels/playmode, cancellation, HI/MID/LO and WASM ABI/integrity; no unverified resampler fallback or source-file overwrite. Converter keeps numeric prefixes; My EP has its own naming rule.

## TOKEN-EFFICIENT

1. Before app code, use [implementation gate](docs/IMPLEMENTATION_GATE.md): verify current main/open PRs/Linear, approved contract, existing code/callers/tests and real gap. Classify IMPLEMENTED/PARTIAL/MISSING/BROKEN/HIL PENDING in the [matrix](docs/IMPLEMENTATION_MATRIX.md). If only HIL is missing, do not recreate code.
2. Inspect relevant functions, direct callers, tests and dependencies; reuse unchanged context. Never auto-read archives or all docs.
3. Load only matching skill bodies. Small tasks: direct work and brief impact assessment, no elaborate plan, forced interview or extra approval round for already authorized work.
4. For bugs: reproduce → focused failing test when feasible → minimal patch → verify. Do not rewrite working code without evidence.
5. No subagents for simple work. Only the two optional [roles](docs/CODEX.md) for useful independent work; one reviewer per change, no duplicates/recursive spawning. Avoid unnecessary plugins, MCP servers and dependencies.
6. Prefer source evidence; check external references for gaps. Keep long logs outside commits.
7. Keep safety checks. No token quota, billing or cost guarantee.

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
| Owner roadmap/future audio/community | Relevant [research](docs/PRODUCT_RESEARCH.md) section; proposals do not authorize implementation |

[Original AGENTS](docs/history/AGENTS-2026-10-18-before-token-efficient.md) preserves all owner choices verbatim. Unique decisions remain binding unless superseded by the owner. Consult only the needed archived passage if canonical docs omit/conflict; never auto-load the archive. [Codex setup](docs/CODEX.md) indexes decision homes.

## Checks and report

- Select by impact using [TESTING](docs/TESTING.md), starting with focused tests. Docs/skills/config need structure/link/schema/consistency checks, not full application E2E.
- Run npm test, npm run build:pages and npm run test:e2e when scope/risk warrants. Protocol/firmware/FILE writes/recovery/project mutation/DSP retain full mandatory suites and applicable HIL gates. Never weaken assertions or relabel fixtures for green.
- Reuse successful checks while relevant inputs remain unchanged. Repeat only after changes, failure or unresolved concern. Separate passed/failed/skipped/unrun; zero tests and simulations do not prove hardware readiness.
- Report files/reason, branch/base, actual test results and limits. Keep Linear current; status does not grant further code/Git/deploy/device permissions.
