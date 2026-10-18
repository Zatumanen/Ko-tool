---
name: feature-spec
description: Draft a compact implementation-ready specification from approved Ko-tool decisions when explicitly asked; trace source evidence and tests, but do not automatically edit code or publish issue tracker items.
---

# Feature spec (adapted from Matt Pocock's to-spec)

Use after feature decisions are settled, not for routine bug fixes. Read only relevant code, existing domain docs and tests. If a decision is unresolved, flag it; do not overwrite an approved requirement.

Produce a document with:
- Problem and observable user outcome.
- Approved user scenarios, failure/disconnect states and out of scope.
- Existing implementation and extension seam; reuse modules over new abstractions.
- Specific data/protocol contracts and UI behavior only where supported by evidence.
- Acceptance criteria testable at the highest useful boundary.
- Focused Node/Playwright checks and HIL gate for real EP writes, firmware or transport claims.
- Risks, dependencies and owner decisions requiring approval.

Keep the spec brief unless the feature is genuinely large. Link to canonical docs rather than duplicating their details. Separate simulated evidence from captured or physical-device evidence. Do not automatically post to Linear, create a GitHub issue, commit, push or modify product code.

Credit: https://github.com/mattpocock/skills/tree/main/skills/engineering/to-spec
