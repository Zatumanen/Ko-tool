# Codex project configuration

## Loading and budgets

Load root AGENTS, branch/status and PROJECT_STATE, then only the matching skill
body and relevant code/spec sections. Descriptions support skill discovery;
they do not require loading all bodies or the archive. No global plugin/model,
reasoning, billing or token-limit settings are changed.

[Original AGENTS](history/AGENTS-2026-10-18-before-token-efficient.md) is byte-identical:
50,908 bytes, SHA-256 6cd682ceb7f634ce0e8158c6a09ad0ca76cdca796100b71c31bc216d3b899a0b.
Targets: root <=8KiB; PROJECT_STATE and each SKILL <=3KiB. The official Codex
schema's default project_doc_max_bytes is32,768 bytes across selected project
instructions. The compact root fits; that does not guarantee a context window,
cost saving or a live Cloud reload. Archive uses a non-AGENTS basename.

## Approved decision homes

| Detail | Canonical source section |
| --- | --- |
| Product identities, priorities, future REPITCH/import-only −12 convention | [Research](PRODUCT_RESEARCH.md): philosophy, REPITCH |
| Connected Projects, both Saved views/placement, verified Live, AUTO OFF/20s | [Sequencer](SEQUENCER.md): scope, Saved, Live |
| Seven meters, exact built-in order/weights/minima, hidden/pair resize, restore picker | [Visuals](VISUALS.md): bottom strip, Balanced, configurable strip |
| Named layouts vs current snapshot, committed writes, failure warning, Close/unload | [Visuals](VISUALS.md): browser-only saved layouts |
| Three global color modes, verified identity/fallback, Auto Theme | [Visuals](VISUALS.md): theme-only coloring and Auto Theme |
| Visibility, collapse/auto-hide, height, capture cleanup and start policy | [Visuals](VISUALS.md): visibility, lifecycle, source policy |
| Exact evidence/firmware, confirmation/readback and captures | [Testing](TESTING.md), [matrix](testing/ep-device-compatibility-matrix.md), [captures](testing/ep-file-capture-workflow.md) |
| DSP/WAV/metadata/ABI/names | [Audio contract](testing/audio-x2-pipeline.md), audio-regression skill |

Archive-only operational safeguards remain active in root: authorization,
languages, paused redesign, runtime/session/scheduler/journals, ambiguous-failure
retry prohibition, release/privacy/provenance. The exact My EP prefix grammar
is in audio-regression. Latest owner instructions supersede historical choices;
code proves implementation, not approval or HIL. Read only the needed archive
passage if a canonical document lacks an owner choice.

## Optional roles

[Project config](../.codex/config.toml) declares exactly two custom roles:
[code-explorer](../.codex/agents/code-explorer.toml) for bounded related-code
research and [regression-reviewer](../.codex/agents/regression-reviewer.toml)
for one independent review of complex/high-impact changes. Both are read-only,
inherit the chosen model and forbid recursive delegation. No automatic spawning
or fixed expensive model. The project limits spawned threads to two and depth
one where supported; V2 can ignore depth and host settings can override limits.
Simple tasks stay with the primary agent. State the independent subtask/benefit;
no duplicate reviewer or wholesale context reload.

CLI0.159.2 reports multi-agent support. TOML is checked against the
[official schema](https://raw.githubusercontent.com/openai/codex/main/codex-rs/core/config.schema.json)
(2026-10-18); installed CLI also parsed the agent limits and role declaration.
Its prompt renderer could not run because platform state storage is read-only;
the --strict-config flag is unsupported by its debug/features commands.
Runtime trust/config loading and custom role selection remain
separate. This chat's host spawn tool has no agent-type field; if authorized,
pass the matching role brief explicitly. Do not claim named-role/concurrency
activation in Cloud merely because repository files exist.

## Existing cloud runtime

Node22.23.3 is retained at /workspace/.ko-tool-tools/node_modules/node/bin:
prepend it to PATH per shell. Playwright is in node_modules; system Chromium is
/usr/bin/chromium. Existing commands: npm test, npm run build:pages,
npm run test:e2e. Cloud browser override:
/workspace/.ko-tool-tools/playwright.cloud.config.mjs. It selects system Chromium;
the managed-browser CDN previously hit network policy. Preserve TLS/integrity.
The test server fixes port4173; stop only your own manual server before E2E.
No package.json, lockfile or Actions change is needed for this configuration.

## Activation and verification limits

Files are implemented locally. A new Cloud task must discover this checkout's
AGENTS and .agents/skills; the current conversation is not proof of reload.
.codex/config.toml depends on runtime support/trust. If your interface requires
it, trust only this project and start a new task; do not weaken sandbox/network.
No live Cloud dashboard setting was applied by this task. The existing start_skill
draft was shortened from3,899 to1,386 characters, removing stale results and
delegating selective context to AGENTS/PROJECT_STATE. Install script, repositories,
network and credential requirements were preserved. The confirmed draft save does
not execute it or publish a snapshot: review/save in environment settings, then
publish the environment and verify discovery in a new task. Earlier CDN additions
remain draft settings until applied. No new MCP/plugin is needed.

Config-only verification covers sizes, YAML/TOML, relative links, archive hash,
selective-routing cases, unchanged application/test/dependency/CI hashes and
runtime tool/browser availability. Full suites are not rerun solely for docs;
previous application results remain dated evidence for earlier code changes.
