# Pre-implementation audit gate

**Purpose:** prevent implementation of a feature that already exists, mistaken promotion of a tested software path to hardware acceptance, and PRs without a demonstrable need. This gate operates **before changing app code**, not as a replacement for unit tests, review, CI, or hardware readback.

## Required order

1. **Confirm authority and current base.** Read owner permissions and applicable AGENTS/skill, verify current `main` SHA, checkout/working tree, open PRs and current Linear description/status. Paused or draft work is not merged code. Do not infer GitHub Pages deployment from a merge.
2. **Map the approved behavior.** Read the specific owner roadmap/contract and relevant reference. Locate the actual UI → controller → core/transport → tests for the *exact* feature. Check both a happy path and one relevant failure/permission path. Memory, PR titles, old reviews, simulations and Linear labels are navigation only.
3. **Record a per-criterion status.** Choose `IMPLEMENTED`, `PARTIAL`, `MISSING`, `BROKEN`, `HIL PENDING` or `UNVERIFIED` with concrete source location and evidence. A function can be IMPLEMENTED in code **and** HIL PENDING at the same time. Do not let a Done issue override that fact.
4. **Choose what work is actually needed:**
   - `SKIP`: implementation already matches the requirement and automated evidence covers it; do not rewrite. Move to the next **real** software gap.
   - `HIL ONLY`: software complete, but device acceptance pending; log blocked/awaiting HIL, do not invent a software feature or mark physical PASS.
   - `FIX`: behavior is broken; show a reproducible failure/guard gap and add a regression before a minimal fix where feasible.
   - `BUILD`: missing approved behavior; point to absent module/route and define pass/fail acceptance before coding.
   - `RECONCILE`: source, owner contract and Linear disagree; document the inconsistency and resolve the factual question before modifying runtime behavior.
5. **Keep proof and scope together.** Open an isolated feature branch, update only the impacted code/tests/docs and any materially affected [implementation matrix](IMPLEMENTATION_MATRIX.md) row. Record the base SHA, existing behavior, exact delta, tests to run, HIL status and release/deployment scope in the PR.
6. **Verify and report accurately.** Run focused cases, then the full CI prescribed by [TESTING](TESTING.md) for that scope. Wait for all required checks on the *exact* PR SHA, merge only with appropriate permission when green, then verify `main` CI. A device write/interruption requires separately scoped owner approval, backup and expendable data. Never claim fake EP proves a physical scenario.

**Stop rule:** If no independently supported difference exists between the approved requirement and tested implementation, do **not** create an app-code PR. A documentation/evidence correction can still be appropriate, with no changed runtime behavior.

## Minimal evidence to put in each PR

The repository's [PR template](../.github/pull_request_template.md) captures six required headings, validated structurally in CI:

- **Baseline and sources:** current base SHA, relevant Linear issue, reference/owner contract.
- **Existing implementation:** exact functions, callers and existing test coverage, not a generic assertion that it is missing.
- **Verified gap:** one independently checkable absent or broken scenario, or a clear docs-only inconsistency. An empty gap means `SKIP`.
- **Decision and scope:** `SKIP/FIX/BUILD/HIL ONLY/RECONCILE`, changed files, non-goals, permissions.
- **Tests and evidence:** focused/full results or stated not-run; distinguish Node, fake-EP Chromium, recorded traces, HIL.
- **Hardware and release:** exact hardware scope where relevant, any remaining HIL gate and whether Pages publication was authorized. A merge never authorizes publishing.

The CI script checks that the table and these sections exist, contain substantive text and use valid statuses. **It cannot prove the truth of an audit or hardware result.** Reviewers must open the source/test/CI links and reject fabricated or stale claims.

## Special cases and status reconciliation

- **Docs-only/CI-only:** the same headings remain required, but explicitly say why runtime/physical acceptance is not applicable. Do not run unrelated E2E merely to pad a documentation PR; CI still runs repository checks on GitHub.
- **A Linear issue already Done:** cross-check each acceptance criterion. If HIL or write activation is unmet, note `tracker Done / evidence HIL PENDING` in the matrix and the issue; do not silently claim release readiness or reopen/close as a substitute for checking. Escalate actual status correction to issue review.
- **Only read-only physical evidence:** use `SCOPED` for the precise validated operation/model/firmware, not a broad PASS. HIL for other operations remains pending.
- **Future app work:** this standing procedure must be performed again at the *new* main SHA. Never use the snapshot matrix as automatic proof.

**Owner instruction, 17 Nov 2026:** approved software roadmap development may continue; new physical verification is deferred until the software tasks finish. This does not enable device writes, deletion, firmware modification, induced USB disconnect or Pages deployment.
