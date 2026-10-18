---
name: architecture-graph
description: Build or query a scoped Graphify code knowledge graph only when explicitly requested for cross-module analysis; prefer rg and source for small changes.
---

# Graphify pilot for Ko-tool

Graphify is optional and not part of the default context. It is useful for tracing complicated paths under js/ep133/, not a reason to index all of Ko-tool on every task.

1. Start with rg and relevant callers/tests; skip Graphify if those answer the question.
2. When graph analysis is authorized, verify the trusted package source and Python >= 3.10, then obtain/install the pinned graphifyy package in an isolated disposable Python environment. Do not install into production dependencies or edit pyproject/package.json.
3. Pilot only on js/ep133/ or a narrower selected module. Prefer deterministic AST/code extraction and `--no-viz` for first pass. Do not spawn semantic agents or analyze all docs/images without a separately justified request.
4. Read at most GRAPH_REPORT.md or bounded `graphify query ... --budget 1000` results. Treat INFERRED graph edges as hypotheses; verify every consequential relation in source.
5. Keep graphify-out/ and caches in scratch/untracked files; do not commit them, expose private reference artifacts, add auto hooks, or call `graphify codex install` (it rewrites AGENTS.md).
6. Report commands, version, corpus, evidence quality, tokens/latency observed (if actually measured) and whether the graph added value. Remove scratch files when finished.

Upstream: https://github.com/mbilalnust/Graphify (branch v3); package name graphifyy, CLI graphify. Project documentation: docs/CODEX_ADDONS.md.
