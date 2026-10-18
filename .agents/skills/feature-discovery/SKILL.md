---
name: feature-discovery
description: Clarify an uncertain new Ko-tool feature or irreversible design decision with a bounded interview and record approved vocabulary. Use only when the owner explicitly asks to design/interview or a consequential product choice is genuinely unresolved.
---

# Feature discovery (inspired by Matt Pocock's grill-with-docs)

This is not a mandatory interview before every coding task. Existing approved decisions in docs/SEQUENCER.md, docs/VISUALS.md, docs/PRODUCT_RESEARCH.md and relevant AGENTS.md win over speculative alternatives.

1. Inspect only the feature's actual implementation and pertinent approved specification. Find factual answers in source; never make the owner re-answer known decisions.
2. Separate facts, product decisions, assumptions and open hardware behavior.
3. Ask a small coherent round of dependent product decisions only when necessary. Prefer 1-3 material questions; do not exhaustively interrogate the owner.
4. Offer a default and consequence for each unresolved choice. Do not implement or silently decide unapproved behavior.
5. Record an approved term in a glossary only if a persistent language ambiguity was resolved. Record a brief ADR only for a hard-to-reverse trade-off, and only within an authorized documentation scope.
6. End with a short decision summary and remaining blockers. Do not create issues, merge PRs, touch device hardware or update app code without separate authorization.

Keep conversations in Russian. Avoid repeated discussion of settled details.

Approach credit: https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs
