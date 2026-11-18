# Pre-implementation audit (required)

<!-- Complete every section before requesting review. The CI audit checks structure, not truth. -->
<!-- First inspect main, issue, approved contract, implementation, direct caller and test. -->
<!-- Do not treat Linear Done, a passing fake EP suite or a merged PR as physical acceptance. -->

## Baseline and sources

<!-- Specify exact main@SHA, Linear issue, approved requirement, reference and relevant reviewed date. -->

## Existing implementation

<!-- Identify current source paths/functions and related tests. A docs-only PR must say why app code is not relevant. -->

## Verified gap

<!-- State a reproducible failed criterion or an evidenced missing path. If none: do not create an app-code PR. -->

## Decision and scope

<!-- SKIP, FIX, BUILD, HIL ONLY or RECONCILE. List files changed, non-goals, permissions and the reason changes are required. -->

## Concurrent PRs and integration

<!-- Give the date/current main SHA, open PRs inspected, overlapping paths and PR numbers (or explicitly state no overlap). -->
<!-- For shared UI/audio/transport paths: link to one combined-head regression CI, or mark integration BLOCKED/NOT TESTED. Separate green PR runs are insufficient. -->
<!-- See docs/PR_INTEGRATION.md. -->

## Tests and evidence

<!-- Record focused tests, complete CI SHA/run, fake EP vs real device, skipped/blocked steps and remaining uncertainty. -->

## Hardware and release

<!-- HIL model/exact firmware/authorization/readback if applicable; otherwise explicitly say HIL pending or not applicable. State if Pages deploy is authorized; merge is NOT deployment. -->
