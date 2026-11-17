---
name: project-context
description: Use when entering an unfamiliar project area, reviewing status/architecture, locating approved decisions and roadmap evidence, or resolving remembered-versus-current behavior.
---

# Project context

Start with request, git branch/status, root AGENTS and
[PROJECT_STATE](../../../docs/PROJECT_STATE.md). This is navigation, not a whole
repository survey for every small task.

1. Use rg for the exact surface: converter js/app.js/js/audio; device js/ep133/ui;
   Visuals js/visuals; build scripts/build-pages.mjs. Inspect affected current code,
   immediate callers and tests. Reuse unchanged context; expand for real dependencies.
2. Select a relevant section of [Sequencer](../../../docs/SEQUENCER.md),
   [Visuals](../../../docs/VISUALS.md), [research/REPITCH](../../../docs/PRODUCT_RESEARCH.md)
   or [TESTING](../../../docs/TESTING.md). The [decision index](../../../docs/CODEX.md)
   routes historical choices; never auto-load the archive or every skill/document.
3. Before app edits, follow the [implementation gate](../../../docs/IMPLEMENTATION_GATE.md)
   and [matrix](../../../docs/IMPLEMENTATION_MATRIX.md): inspect real existing code,
   direct callers/tests and approved behavior, then identify a reproducible gap.
   Memory, commit titles and Linear Done are not proof. Distinguish IMPLEMENTED,
   PARTIAL, MISSING, broken behavior and HIL PENDING; HIL-only is not a code task.
   A decision authorizes neither physical writes nor Pages deployment.
4. Read Linear through available authorized tools. If unavailable, say live status
   is unverified; do not invent issues/closure or edit tracker records without
   authorization and acceptance evidence.
5. Complex task: short impact/verification plan. Small task: direct execution.
   No automatic subagent; delegate only an independent bounded question with a
   clear benefit or one review of a risky change.

Return a short scope map, sources, current facts/gaps and next action. Update
PROJECT_STATE only after material state changes, with date and evidence; do not
turn it into a transcript. A stale snapshot requires a targeted code check, not
automatic full-history or full-suite repetition.
