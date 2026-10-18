---
name: browser-qa
description: Use when a task changes browser UI, file/folder uploads or downloads, accessibility/layout, Visuals capture controls, or Playwright/fake-EP behavior and browser regressions.
---

# Browser QA

Locate the affected UI/event boundary and matching tests/e2e spec first. Read
relevant [TESTING](../../../docs/TESTING.md) and
[browser policy](../../../docs/testing/browser-platform-support.md) sections.
For Visuals use only the affected [Visuals](../../../docs/VISUALS.md) contract.

1. State observable behavior and affected callers. Reproduce a bug, add a focused
   failing browser test before the minimal fix when feasible. Reuse fake EP/input
   fixtures; preserve real gestures and existing assertions.
2. Run the matching spec/title, e.g. `npm run test:e2e -- tests/e2e/visuals.spec.mjs`.
   Repository config owns server4173, reuseExistingServer=false. Stop only a manual
   server you started. Use the existing [cloud override](../../../docs/CODEX.md)
   if needed; do not change production browser behavior for the harness.
3. Inspect assertions, console/page errors and traces before retrying. SYNCED can
   precede metadata hydration: native drag needs draggable=true and global progress
   hidden before geometry. Use observable readiness, not sleeps or weaker checks.
4. Check affected flows: capture permission/denial/cleanup; import/export names,
   partial failures and downloaded bytes; layout focus/keyboard, minima/overflow
   and viewport. A port/PID or zero-test run is not functional evidence.
5. Broaden to full Node/build/E2E for shared events or cross-feature risk. Protocol
   and DSP impacts retain their mandatory safety suites. Docs/skill/config-only
   work normally needs structural/link checks, not application E2E.

Keep long logs outside tracked files; report targeted/full scope, counts, browser
version and actionable errors. Fake EP and synthetic input never establish physical
EP USB Audio, latency, firmware or device-write compatibility.
