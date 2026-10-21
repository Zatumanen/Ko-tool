# Native Option-drag COPY — investigation and separate ZAT-59 proposal

Date: 2026-10-21 (Europe/Moscow). Research only; no COPY implementation,
test timeout, assertion or retry setting changed. No hardware operations.

## Observed CI failure

[PR #143 run 39498118967](https://github.com/Zatumanen/Ko-tool/actions/runs/39498118967)
tested HEAD `4f4ceb78c4dc8b5d6f4ee3e3dd5c459fca5548eb` against `406edd9`.
`my-ep-navigation-delete-upload-name.spec.mjs:109` first timed out at line 126:
slot 010 metadata name was undefined instead of `kick808` after 20 seconds.
Retry #1 passed, including byte equality and unchanged source. Final result:
74 passed + 1 flaky. Its existing `retries: 2` was unchanged. Baseline run
39485310267 completed 70/70 without retry. No trace artifacts were published.

## Reproduced and inspected

- The test's `open()` waits only for substring SYNCED and the visible source
  name. Production sync emits SYNCED with LOADING before metadata hydration
  ends; rows have no draggable attribute while mutations are disabled.
- A Node reproduction using the actual library sync controller, sample store
  and sample memory, with a deferred metadata read, satisfies both old test
  predicates while draggable=false. Its dragstart is cancelled and transfer
  count remains zero. This proves a readiness defect in the test, not the exact
  cause of this native Chromium failure.
- After hydration, synthetic events with no altKey flags and Alt keyup before
  drop still reach transfer(copy=true). Existing document Option tracking,
  copyAtDragStart and COPY preview preserve intent in that exercised path.
- An unrelated metadata update replaces the source row object through the
  existing full-list render. A native gesture may therefore lose its node;
  the reproduction establishes replacement, not native Chromium cancellation.
- COPY dispatch follows accepted drop and the existing transfer coordinator,
  strict FILE lease, upload/readback and source/byte checks. The fake EP relies
  on serialized reads/uploads; this scenario activates no new metadata fault.
  The failing target-name assertion cannot distinguish absent/cancelled drop,
  missing modifier, refused transfer, failed/rolled-back copy or missing metadata.

The synthetic diagnostic is retained locally under
`work/pad-readonly/copy/readiness-repro.mjs` with detailed notes alongside it;
scratch files are not part of the release package. Chromium/HIL were not used
for that reproduction. Exact CI root cause remains unconfirmed without trace.

## Proposed minimal ZAT-59 package — separate authorization

1. Before native drag or geometry, wait for SYNCED without LOADING, hidden global
   progress and source draggable=true. Reuse the established library-editing
   readiness checks; preserve native gestures and byte/source assertions.
2. Record pointer/drag/Option events, source/target node identity and attributes,
   COPY preview, runtime/scheduler state, error UI and fake request log on failure.
   Publish trace/error-context even when a retry succeeds; retain no private data.
3. Add deterministic delayed-hydration coverage and repeat the native Chromium
   scenario. Distinguish readiness, node replacement, modifier and transaction
   failures before changing production COPY. Do not increase retries/timeouts.
4. If traces prove ready-state row replacement cancels the gesture, address that
   render boundary in a separately reviewed fix. Preserve FILE/session ownership,
   MOVE dependency protection, recovery and authoritative readback.

No conclusion here confirms physical COPY compatibility or closes ZAT-58/HIL.
