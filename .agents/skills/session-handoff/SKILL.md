---
name: session-handoff
description: Create a small, redacted handoff for the next Codex Cloud session when explicitly requested or a long task must continue elsewhere. Do not invoke during normal tasks.
---

# Session handoff (adapted from Matt Pocock's handoff)

Trigger only on an explicit handoff/continuation request. Use current task evidence; do not re-scan the repository.

Write a short Markdown handoff to a temporary location outside the tracked repository (for example `/tmp/ko-tool-handoff.md`). If the user explicitly wants it versioned, ask for or follow authorization to store a sanitized copy under docs.

Include:
1. Repository, actual branch and base SHA; state whether work is committed or unpublished.
2. Goal, owner-approved decisions and what remains out of scope.
3. Exact changed file paths and existing PR/issue links, not pasted diffs.
4. Checks run and their real pass/fail/not-run status.
5. Risks, device/HIL unknowns and the smallest next action.
6. Only the relevant skills/specification paths to load next time.

Target <= 1000 words; prefer <= 500. Do not paste archives, large logs, private captures, tokens, machine-identifying device IDs or raw protocol dumps. Never present fake EP tests as real hardware results. A handoff is navigation, not proof of current code.

Reference: https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff
