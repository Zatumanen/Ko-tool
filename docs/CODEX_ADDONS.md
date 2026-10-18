# Optional Codex Cloud add-ons for K.O. Tool

These project skills complement the compact AGENTS.md and existing four skills from the token-efficient Codex configuration. They are **not** always-on instructions, agents, hooks, MCP registrations or new production dependencies. The existing PR introducing .agents/skills may still be awaiting merge; check current target branch.

| Skill | Call only when |
| --- | --- |
| `session-handoff` | Handing off an unfinished task between sessions |
| `feature-discovery` | Explicit owner interview about a new feature/decision |
| `feature-spec` | Turning settled decisions into a testable specification |
| `architecture-graph` | Investigating a large, connected set of modules where simple source navigation fails |
| `reference-reverse-engineering` | Examining actual owner-supplied reference artifacts |

## Optional third-party runtime tools

**Graphify.** Upstream: https://github.com/mbilalnust/Graphify (v3). Requires Python >= 3.10. Package `graphifyy`, executable `graphify`. Only after the owner requests a graph, inspect and pin a reviewed version, create a disposable venv, and run a scoped pilot such as `graphify js/ep133 --no-viz`. It writes `graphify-out/` in the working directory: keep this scratch/untracked, do not add its Codex always-on hook or modify AGENTS.md. The first run and optional semantic extraction can cost more than direct navigation. Report measured value rather than claiming automatic token savings.

**REA.** Upstream: https://github.com/morluto/rea. Requires Node 22.x >= 22.19 (or supported newer major) and additional analysis providers for some targets. Static extracted JS/ASAR can be investigated through a reviewed/pinned `rea-agents` CLI without registering a persistent MCP. Do not run `npx ... setup` or edit cloud-wide Codex configuration by default. Native, firmware, WASM, Android and capture analysis have separate prerequisites. See [reference intake](REFERENCE_ANALYSIS.md).

**Matt Pocock.** Adapted workflow concepts, not vendored files: https://github.com/mattpocock/skills . These skills avoid upstream auto issue publishing, mandatory interviews and dependencies on Claude's Skill tool. No full plugin installation.

## Token and trust limits

- No always-on graph, subagents, global plugins or automatic reverse-engineering tools.
- Read one matching skill body only; keep results in a short evidence summary.
- Pin/review external packages before installation and use a sandbox with least privilege.
- No deployment, firmware writes, branch actions or third-party asset publication without owner authorization.
- For quick fixes, use existing source navigation, focused tests and present the diff; none of these optional skills is required.
