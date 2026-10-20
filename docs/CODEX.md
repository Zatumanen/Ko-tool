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

## Portable Codex setup and dated runtime notes

For every **new** checkout/session, inspect actual branch/status and execute
`node scripts/check-codex-env.mjs`. Use Node.js 22, then install dependencies
with `npm install --no-audit --no-fund` until a verified `package-lock.json`
is available; only then switch the setup/CI to `npm ci`. Run focused tests
first; full gates are selected by docs/TESTING.md and AGENTS.md. For E2E use
`npx playwright install chromium` followed by `npm run test:e2e`.
The test server owns port 4173: stop only a manual server you started.
Generated assets and diagnostics belong in ignored `dist/`, `work/`,
`test-results/`, `playwright-report/` rather than commits.

Cloud runtimes are **not portable** by assumption. Check `node --version`,
`npm --version`, browser availability and file paths before configuring an
override. Never change application code or relax TLS/CI assertions to bypass a
restricted cloud runner. Report environment-specific failures as unverified.

Historical environment, **2026-10-19 only**: Node 22.22.0 at
`/workspace/.ko-tool-setup/node_modules/node/bin`, default Node 24.19.0,
Chromium at `/usr/bin/chromium` and browser override at
`/workspace/.ko-tool-setup/playwright.config.mjs`. The restricted runner showed
`spawnSync ... EPERM` and child stdout limitations; these observations do not
prove anything about another Codex workspace. Prefer a minimal reproduction
and normal permission workflow if a similar failure appears.

## Activation and verification limits

A new Codex Cloud task must discover this checkout's AGENTS.md,
`.agents/skills/` and selected `.codex/config.toml` roles. Files alone do not
prove skill/role activation, environment trust or published Cloud settings.
Verify discovery in a fresh session; do not alter sandbox/network protection
or install optional global tools solely to make discovery work. The 2026-10-19
Cloud start-skill/environment observations were draft state, not a portable
or activated guarantee. No new MCP/plugin is required by default.

[Release verification skill](../.agents/skills/release-verification/SKILL.md)
is opt-in for release readiness, not every patch. Existing
[session-handoff](../.agents/skills/session-handoff/SKILL.md) is already the
canonical way to hand off unfinished work; do not create another handoff skill.

Config-only verification covers frontmatter, TOML, paths/links, archive hash,
tracked-file scope and the actual current environment. CI/workflow changes
need workflow inspection and a new Actions run; no local documentation check
proves GitHub deployment gates. Full application suites are not rerun solely
for prose edits; previous results remain dated evidence for earlier code.
