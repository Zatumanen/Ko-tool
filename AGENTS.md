# K.O. Tool — agent instructions

These rules apply to the existing `Zatumanen/Ko-tool` repository. They adapt the
working agreement of [`di-sukharev/vibe`](https://github.com/di-sukharev/vibe)
to this project. **Do not replace the stack or copy the template architecture.**

## Working agreement

- The owner decides product behavior and approves changes. A question, source
  review, issue audit, or request for recommendations does **not** authorize code
  edits. Obtain explicit approval for code or configuration changes. A request
  to prepare documentation covers documentation only, not deployment.
- Talk with the owner in Russian. The root README serves both users and
  developers: lead with product usage in Russian, then explain engineering
  details. Keep agent instructions and technical references in concise English
  unless the owner chooses another documentation language.
- Before proposing a change, inspect its **current implementation on the target
  branch**, connected callers, relevant tests, and authoritative documents.
  Commit titles and Linear status alone are not implementation proof.
- Choose the smallest safe, reversible solution. Explain the scope, observable
  behavior, regression risk, and evidence before making significant changes.
- Do not turn the paused Speeduppercut OS preview into the active implementation
  without a new owner decision. The classic `main` app is the active product;
  PR #110 is paused Draft at the time these rules were drafted.

## Product identity and owner-approved direction

- **K.O. Tool** is the product and virtual desktop. **SpeedUpperCut** is the
  audio optimization application; **My EP** is the physical EP companion.
  Do not rebrand the entire repository or desktop as SpeedUpperCut.
- Core values: reduce sample storage usage, make sample transfers effortless,
  augment the physical device, visualize sequencer data, aim for parity with
  the official EP Sample Tool, and build a joyful musician-first experience.
- **Owner-approved sequencer direction (2026-10-17):** first a safe read-only
  visualization of saved projects, then a separate real-time device view only
  after hardware/protocol verification. The user chose **both Step Sequencer
  and Piano Roll**, switching between two views of the same saved data.
  **Approved placement: inside My EP → Projects → project → Sequencer,**
  not a separate desktop app or icon. **Owner-approved connected-device-only
  rule:** My EP Projects and Saved/Live Sequencer are accessible only with a
  physically connected EP and authorized session; do not add an offline
  local-project-archive viewer/editor. Disconnection must disable device
  operations and clarify that cached results are stale. This does **not**
  restrict standalone SpeedUpperCut audio conversion. Preserve the shared
  project context, existing read-only and firmware evidence gates.
  Existing read-only project inspector and gated 16-step authoring UI are not
  proof of a full piano roll or live playhead sync. Consult docs/SEQUENCER.md.
- **Owner-approved placement for future Visuals (2026-10-17):** a **separate
  desktop app with its own K.O. Tool icon**, not a tab or panel inside My EP.
  Target use is optional audio-reactive visualization for live performances
  and on-camera sessions. This is **planned only**: do not claim an existing
  Visuals app, working capture, or permission to add code. **Owner-approved
  source policy (option C):** the user selects a browser-visible live audio
  input — EP USB Audio only if exposed as a real audio input, or another
  compatible input (audio interface/line-in, microphone, etc.). **Do not
  require an EP connection** for Visuals when another input is chosen. Explicit
  browser permission, visible selected-source state and honest disconnection
  behavior are required; never silently fall back to the microphone.
  USB MIDI/SysEx is not audio. See docs/VISUALS.md.
- Future possibilities also include context-aware onboarding and a community
  sample/project library; neither is implemented nor a code-change mandate.
- **Approved future product contract (not yet implemented):** My EP gets a
  `REPITCH` toggle **ON by default**, manually switchable OFF. With ON, parse
  incoming WAV Teenage Engineering `LIST/INFO/TNGE` metadata. An exact
  `sound.pitch = -12` is the owner-approved marker to skip x2 repitch; preserve
  that pitch compensation through any necessary format-only conversion.
  Otherwise process x2 and attach `sound.pitch = -12` before sample upload.
  With OFF, preserve the current direct-upload path without automatic x2.
  Scope the toggle to *new local sample imports*; do not mutate existing
  on-device data during MOVE/COPY/backup/restore. This is a new feature that
  requires explicit code-change authorization, tests and HIL.
- A `-12` metadata marker is **a product convention, not proof** of a past
  x2 transform. On invalid/corrupt metadata, fail transparently rather than
  treating unreadable metadata as absent. Do not overwrite source local files.
  **Current implementation differs:** SpeedUpperCut applies x2/-12, while My EP
  upload currently does not automatically do so. Do not claim feature parity.
- The official tool's features are an aspiration for parity, not grounds to
  describe unimplemented device writes as supported. Use exact device/firmware
  evidence. Optional live visualizers must not be presented as reading audio
  over SysEx: Web MIDI and USB Audio are distinct channels.
- User research and competitor UX are inspiration, **not licenses to copy
  code, SVG graphics, UI assets, trademarks or proprietary data**.

## Actual architecture

This is a **static HTML/CSS/native JavaScript application**, published through
GitHub Pages. Node.js is used for builds and tests, not as a production API.
It does not use the Vibe template's Bun/React/Hono/Prisma/PostgreSQL stack.

| Path | Responsibility |
| --- | --- |
| `index.html`, `css/` | Classic application interface and styling |
| `js/app.js` | Original converter UI and orchestration |
| `js/audio/` | Shared decode, resample, WAV, import and chop logic |
| `js/ep133/` | EP-series device, SysEx/FILE, transactions, project formats and safety |
| `js/ep133/ui/` | My EP workflow controllers and presentation |
| `js/platformSupport.js` | Browser and feature preflight, without permission requests |
| `scripts/build-pages.mjs` | Versioned static GitHub Pages bundle in `dist/` |
| `tests/` | Node tests, fixtures and Playwright Chromium browser tests |
| `docs/testing/` | Existing canonical audio, browser, device and capture contracts |

Inspect the source of truth at the relevant boundary before adding new code.
Prefer the existing shared modules and project-specific conventions over
introducing a competing implementation, framework, abstraction or dependency.

## Hardware / MIDI safety: release-blocking requirements

- Treat USB MIDI SysEx and FILE writes as **critical hardware operations**.
  Read-only inspection is distinct from mutation.
- Keep the existing `deviceRuntime`, transport scheduler, session ownership,
  firmware/SKU evidence gates, strict FILE transactions, project dependency
  checks, post-write device readback, and recovery journals intact.
- A recognized model, valid firmware handshake, FILE bitmask, or simulator
  result alone is **not** permission to write. Capability approval depends on
  exact firmware-scoped evidence from `js/ep133/evidenceRegistry.js` and the
  compatibility matrix. Fail closed on unknown state.
- Do not bypass busy/unsafe/recovery states, permissions, active-project
  restrictions, checksum/CRC checks, or user confirmation. Do not perform
  speculative retries after ambiguous errors or disconnections.
- Distinguish a saved project archive from an unsaved in-memory device state.
  Project polling is **opt-in (`AUTO: OFF` by default)** and read-only, on a
  20-second interval when enabled. It is not a true live playhead or unsaved
  MIDI-event feed. Never accelerate hardware FILE reads to fake live sync.
  Never authorize project writes by making archive parsing more permissive.
- Deleting samples referenced by project pads requires the **second explicit
  informed confirmation** in the current My EP flow; cancellation must do
  nothing. Never automate destructive hardware acceptance against real data.
- For physical EP HIL: first back up the device, use expendable test slots,
  record model/firmware/host and expected results, and obtain specific owner
  approval before write/destructive/interruption scenarios.
- Fake EP browser tests and synthetic golden vectors **do not** prove that
  physical EP hardware behaves the same way. Do not claim real-device support
  or successful HIL unless traceable hardware evidence exists.

## Audio and file semantics

- The converter's canonical x2 pipeline is in `js/audio/processor.js` and
  `js/audio/audioEngine.js`. Do not introduce a second DSP implementation.
- x2 conversion and My EP direct uploads are **currently distinct operations**.
  Introduce the owner-approved REPITCH behavior only in a separately authorized,
  tested change. Reuse the shared DSP instead of duplicating it.
- Preserve reference resampler/WASM ABI expectations, explicit cancellation,
  PCM/metadata output contracts, and named HI/MID/LO presets. Never substitute
  an unverified resampler fallback without a reviewed change in contract.
- Batch import skips macOS `._*` and `__MACOSX` metadata, invalid/empty files,
  and reports individual decoder failures without losing successful outputs.
- **Converter exports preserve source-number prefixes**; My EP can remove a
  1–3-digit slot prefix (1–999) followed by whitespace or `_` when assigning
  device filenames/slots. Do not conflate export paths and device names.
- Consult `docs/testing/audio-x2-pipeline.md` before changing DSP, naming,
  audio metadata or folder conversion.

## Implementation and test workflow

1. Read the issue/request, `AGENTS.md`, relevant README/test guides, the
   target-branch code, and the current relevant Linear/GitHub history.
2. Reproduce the issue or demonstrate its source-level cause. Separate known
   facts, assumptions, and unknown device behavior.
3. For behavior changes or bug fixes, add a focused failing test when feasible,
   then implement the smallest authorized change. Do not update fixture
   expectations just to make a regression pass.
4. Run focused `node --test ...` tests, then `npm test`,
   `npm run build:pages`, and `npm run test:e2e` as relevant. For protocol,
   firmware, recovery, project write or DSP changes, run the full suite and
   perform the specified hardware checks if real-device behavior is claimed.
5. Review the diff for unintended hardware writes, cross-feature effects,
   accidental fixture churn, sensitive data and license/attribution issues.
6. Report the exact tests executed and their results; mark skipped or
   unavailable tests clearly. Never report simulated CI as HIL evidence.
7. Update Linear issue descriptions/statuses only when authorized and backed
   by the correct acceptance evidence. Merged code does not by itself close a
   user-reported hardware incident.

Use [docs/TESTING.md](docs/TESTING.md) for local commands and the HIL gate.

## Git, deployment and dependencies

- Inspect the current branch, working tree and remote before any Git action.
- Do not switch/create branches, commit, push, open/merge PRs, rebase, reset,
  or deploy without explicit authorization for that action. Preserve other
  worktrees and uncommitted changes.
- Do not change `.github/workflows/`, dependencies, build scripts, protocol
  guards, or the live Pages deployment as a side effect of documentation work.
- Deployment of `main` can automatically trigger GitHub Pages; a documentation
  merge may still be a release event. Get explicit release approval.
- Never include credentials, device serial numbers, private raw captures or
  user data in issues, commits, logs or fixtures. Redact before sharing.
- The current repository has no declared root license file. Do not assume
  third-party reference code, official tools, bundled binaries or artwork can
  be copied. Check provenance and applicable licenses before importing assets.

## Completion report

State: what changed; which branch/commit; what was inspected; commands actually
run; pass/fail/not-run; hardware evidence and limitations; risks and rollback;
and the next action requiring owner approval. Keep product decisions with the
owner and avoid claiming certainty beyond the evidence.