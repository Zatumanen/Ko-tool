---
name: release-verification
description: Use when preparing a K.O. Tool release candidate, auditing readiness, or deciding Go/No-Go against approved Linear scope and evidence. Do not invoke for ordinary fixes or drafts.
---

# K.O. Tool release verification

Review the exact proposed commit/PR, the approved Release 1.0 scope in Linear,
root AGENTS.md and only relevant sections of docs/TESTING.md and the hardware
compatibility matrix. Use current live source and tracker state; historical
summaries are navigation, not acceptance evidence.

1. State candidate SHA, source branch, intended target and release scope. Check
   that release blockers and required dependencies are closed with actual evidence.
   Do not silently change old Linear issues or declare completeness from issue status.
2. Separate source review, Node tests, built Pages artifact, Chromium/fake EP E2E,
   retained real-device traces and physical HIL. Green CI cannot replace real
   hardware evidence for firmware, FILE writes, pad/project mutation or USB Audio.
3. Verify relevant checks for the same SHA: `npm test`, `npm run build:pages`,
   `npm run test:e2e`, and applicable approved device tests. Report failures,
   skipped checks and untested model/firmware combinations without overclaiming.
4. Confirm release safety: no unreviewed native MOVE/pad-reference mutation,
   bypassed write gate, destructive retry, changed journal/rollback semantics or
   unsupported firmware; double confirmation before referenced deletion and
   authoritative readback after allowed mutations remain mandatory.
5. Distinguish CI readiness from authorization to deploy. A release requires an
   explicit owner decision and any required GitHub environment approval; never
   merge, tag, dispatch a deploy workflow or manipulate the physical EP yourself
   without permission specific to that action.
6. Return a short Go / No-Go / Insufficient evidence verdict, candidate SHA,
   blocker issue links, scope of each verified check, HIL coverage gaps and the
   smallest next step. Keep secrets, private captures and serials out of reports.

Do not duplicate the acceptance matrix, regenerate a long task history, or
write a release status back to Linear without authorization.
