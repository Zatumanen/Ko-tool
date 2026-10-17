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
  in-browser K.O. Tool virtual-desktop app with its own in-page icon**, not a
  host-OS desktop program, tab or panel inside My EP.
  Target use is optional audio-reactive visualization for live performances
  and on-camera sessions. This is **planned only**: do not claim an existing
  Visuals app, working capture, or permission to add code. **Owner-approved
  source policy (option C):** the user selects a browser-visible live audio
  input — EP USB Audio only if exposed as a real audio input, or another
  compatible input (audio interface/line-in, microphone, etc.). **Do not
  require an EP connection** for Visuals when another input is chosen. Explicit
  browser permission, visible selected-source state and honest disconnection
  behavior are required; never silently fall back to the microphone.
  USB MIDI/SysEx is not audio. **Owner-approved Visuals layout:** primary
  presentation is a long meter strip docked along the **bottom edge of the
  K.O. Tool browser viewport** (choice B). **V1 includes all seven modules**
  (choice C): Waveform, Spectrum, Loudness, Stereo Meter, Output Meters,
  Oscilloscope and Spectrogram. **Owner-approved configuration choice C:**
  drag to reorder, resize module widths, hide and restore any module,
  built-in beatmaking/mixing/live-video layout presets, and save/reload
  custom arrangements. **Owner-approved Beatmaking membership/order
  choice B:** on selecting the built-in Beatmaking preset show precisely
  **Waveform → Spectrum → Spectrogram → Output Meters → Loudness**,
  left-to-right; **Stereo Meter and Oscilloscope start hidden in this
  preset only** but remain available for explicit reveal/reordering.
  Restoring Beatmaking must not modify built-in Balanced, user-saved
  layouts, the current session's strip height or selected audio input.
  Existing module minimums still apply (five-module sum **752 CSS px**
  before spacing/controls); if space is insufficient, use horizontal
  scrolling. Do NOT invent Beatmaking module width percentages yet;
  Mixing/Live preset compositions remain undecided.
  **Owner-approved default Balanced layout (choice C):**
  show all seven modules initially; Waveform and Spectrum are large, Spectrogram
  medium; Loudness, Stereo Meter, Output Meters, and Oscilloscope compact.
  All seven remain available even when users hide some. This is relative
  emphasis, **not fixed pixel widths**. **Owner-approved default Balanced
  module order (choice A), left-to-right: Waveform → Spectrum → Spectrogram → Loudness → Stereo Meter → Output Meters → Oscilloscope.**
  All seven are visible initially; drag-reordering and separately saved
  custom arrangements remain supported. Restoring the built-in Balanced
  defaults must restore this approved order without overwriting saved custom
  presets. **Owner-approved Balanced width proportions (choice A):**
  Waveform 25%; Spectrum 25%; Spectrogram 18%; Loudness 8%; Stereo Meter 8%; Output Meters 8%; Oscilloscope 8% (total 100%). These are the seven initial relative widths
  when space allows, **not immutable pixel widths or module minimums**.
  Preserve user-adjusted widths and custom saved presets; on narrow
  viewports shrink only to readable module minimums and then scroll
  horizontally, never hide/reorder automatically. **Owner-approved
  minimum width choice B:** Waveform **200 CSS px**, Spectrum **200 CSS px**,
  Spectrogram **160 CSS px**, Loudness / Stereo Meter / Output Meters /
  Oscilloscope **96 CSS px each**. With all seven visible, sum of module
  minimums = **944 CSS px**, excluding gaps, borders and controls. Treat
  these as hard readability lower bounds, which override ideal Balanced
  percentage shares when needed. When the visible minimums plus UI spacing
  cannot fit the viewport, expose horizontal scrolling; never forcibly
  shrink below minimum, auto-hide/reorder, or overwrite saved user widths.
  **Owner-approved manual-hide redistribution choice A:** when a user hides
  one or more modules, let the remaining visible modules expand to use
  freed horizontal room **proportionally to their existing intended width
  ratios**, preserving visible order, without auto-hiding additional modules.
  Keep hidden modules' intended widths/settings for restoration; re-showing
  a module recomputes from the underlying intended widths, NOT rounded,
  temporarily expanded displayed widths. Never overwrite browser-saved
  layout presets because of proportional redistribution. Enforce approved
  per-module minimum widths and horizontal overflow scrolling if necessary;
  don't force a fit to the viewport. Detailed allocation while modules
  hit their minima, manual width adjustments with hidden modules and other
  workflow preset contents remain undecided.
  **Owner-approved manual width resize choice A:** dragging the shared
  right-hand divider changes only the selected module's width and the
  immediately adjacent visible right-hand module's width, with equal and
  opposite changes. Other modules retain their intended widths. This is
  separate from the proportional expansion rule after explicitly hiding
  a module. Honor each module's approved minimum width; do not silently
  reorder/hide other modules or overwrite saved layout presets.
  **Owner-approved neighbor-minimum choice A:** when expansion would
  shrink the immediately visible right neighbor to/below its approved
  minimum, **clamp and stop the shared divider at that minimum**.
  Never take width from further-right modules, extend the strip's scroll
  width, auto-hide modules or violate the minimum to continue this drag.
  The selected module's own minimum likewise stops contraction.
  **Owner-approved rightmost-module resize choice A:** resize the last
  visible module via the **left-hand shared divider** with its immediate
  visible left neighbor. Dragging this divider changes only that pair's
  widths by equal/opposite amounts, observing both minimums and stopping
  at either minimum. No independent right outer-edge drag, cascading
  changes, scroll expansion, or implicit saved-preset overwrite is implied.
  If there is only a single visible module, its resize control is still
  undecided; do not invent a neighbor or an unapproved mechanism.
  **Owner-approved preset storage choice A:**
  store saved custom module layouts **only in browser-local site storage**,
  available on future Visuals openings in the same profile/origin. Store at
  least module visibility, ordering and intended widths. Do NOT add preset
  export/import files, accounts, cloud storage, or cross-device sync. Browser
  site-data clearing/private mode can lose presets; report failed writes.
  Exact storage API/schema remain undecided. **Strip height is excluded
  from local presets (height memory choice A).** This does not change the
  Auto Theme per-launch reset or
  decide persistence of per-module color overrides. **Owner-approved
  responsive choice C:** shrink visible modules proportionally only to a
  comfortable minimum; then use horizontal strip scrolling when they cannot
  fit. Never auto-hide/reorder modules or overwrite saved preset widths as
  a side effect of viewport resizing. The minimum widths above are approved;
  exact breakpoints depend on measured module spacing and controls, which
  remain engineering/design decisions. **Owner-approved strip height choice B:** allow
  free **vertical resizing of the entire strip** by dragging its top edge
  up/down while the lower edge stays docked inside the browser viewport.
  Do not impose Compact/Standard/Expanded height presets. Preserve readable
  meters, selected modules, usable desktop controls and source/session state.
  **Owner-approved height memory choice A:** manual height adjustment is
  session-only; on closing/reopening Visuals or reloading K.O. Tool, use a
  **standard launch height of 150 CSS px (owner choice B)**, **not the
  user's last adjusted height**. Never persist strip height globally or
  within a locally saved layout preset. **Owner-approved height bounds
  choice A:** minimum **90 CSS px**, maximum **40% of the K.O. Tool browser
  viewport's CSS height**. Launch at 150 CSS px whenever these bounds
  allow; otherwise respect the 40% cap on shorter but viable viewports.
  **Owner-approved very-short viewport choice A:** below **225 CSS px**
  viewport height, the **90 CSS px minimum overrides the 40% cap**; the
  strip may occupy more than 40% of the window. Do not force an automatic
  collapse or shrink below 90 CSS px just to preserve the percentage.
  Test layout feasibility and accessible controls even for tiny viewports;
  technical details of a viewport shorter than the strip itself require
  implementation validation. **Owner-approved same-session preset-switch choice A:**
  preserve the currently adjusted Visuals strip height when switching
  Balanced, Beatmaking, Mixing, Live, or custom presets. Preset switching
  must not reset to 150 CSS px, nor persist/load any preset-specific height;
  keep within the approved viewport bounds where satisfiable. Only a new
  Visuals launch resets to the 150 CSS px standard. **Owner-approved
  viewport height restoration choice A:** retain the **latest manually
  selected preferred height only in memory for the current Visuals session**.
  On viewport shrink, clamp the *rendered* height to allowed bounds without
  overwriting that preferred value; on viewport growth automatically
  restore it when allowed. Example: user sets 250px at 800px viewport;
  at 500px viewport cap display to 200px; returning to 800px shows 250px.
  A new deliberate manual drag replaces the preferred value. Switching
  presets does not change it; closing/reopening Visuals or K.O. Tool reload
  resets it to the 150px launch target. For short viewports below 225px,
  honor the already approved 90px minimum over 40%, and do not invent OS
  overlays or browser-persistent height settings. Very tiny-window
  accessibility/recovery details remain engineering work.
  **Owner-approved strip visibility choice C:** the entire bottom dock is
  **visible by default**; optional auto-hide reveals it by pointing at the
  lower viewport edge, while manual collapse has an explicit restore control.
  Keep keyboard-accessible restoration and preserve module layout/presets.
  Hidden-state audio capture and transition details are undecided; do not
  invent capture/pause semantics. Full-screen alternatives are not approved.
  **Owner-approved updated Visuals themes (replaces Studio/Retro/Neon/Minimal):**
  exactly **Retro/WIN, EP-133, EP-40, Minimal**, plus independent per-module
  color overrides. Retro uses the existing `css/base.css` Win-style tokens
  (teal desktop `#008080`, gray `#c0c0c0`, navy `#000080`). **Retro is
  the baseline when no model is identified.** After verified My EP device
  recognition/GREET, automatically select **EP-133** for resolved
  `TE032AS001` and **EP-40** for `TE032AS006`; rely on
  `js/ep133/deviceCompatibilityMatrix.js` and do not infer models from
  audio-input names. `TE032AS002` is EP-133 only after the existing
  validated `base_sku` alias resolution. **Owner-approved EP-1320 fallback
  (choice A):** resolved EP-1320 Medieval (`TE032AS005`) maps to existing
  **Retro/WIN** while Auto Theme is ON; still identify the hardware as EP-1320.
  Do not invent a fifth theme or claim EP-133/EP-40 hardware. **Owner-approved
  theme precedence (choice B):** Auto Theme is
  ON by default. Manually selecting any theme turns Auto Theme OFF; retain
  the user's selected theme across device connects, disconnects and model
  swaps until they explicitly turn Auto Theme back ON **within the current
  Visuals session**. If Auto Theme is
  re-enabled with verified EP-133/EP-40 attached, resolve its theme via the
  existing validated identity; for verified EP-1320 use Retro/WIN. Without
  verified identity the baseline is Retro/WIN. Do not let device events override manual selection, conflate
  theme detection with capture audio input, or start background polling.
  **Owner-approved disconnect choice A:** upon real EP disconnection while
  Auto Theme is ON, switch promptly to Retro/WIN, invalidate stale EP
  identity, and keep Auto Theme enabled for subsequent reconnection. With
  Auto Theme OFF keep the manual theme unchanged. React to existing
  `DEVICE_DISCONNECTED`/connection state, not invented FILE polling;
  theme changes alone do not stop/switch a separately chosen audio capture
  input or authorize hardware operations. Fallback for unknown/ambiguous
  identities remain undecided. **Owner-approved theme restart choice A:**
  every newly opened Visuals session, including close/reopen or K.O. Tool
  reload, starts with **Auto Theme ON**, not the prior session's manual theme.
  Resolve the currently verified EP-133/EP-40 model, or Retro/WIN for EP-1320
  or no verified device; never trust stale cached identity. This theme-mode
  reset does **not** erase locally saved layout presets, individual color
  overrides, or unrelated settings. Local-browser persistence is approved
  **for layouts only**; do not imply color override or cloud persistence.
  Changing themes must not reset layout, audio source or modules.
  Color override persistence and precise EP colors still require design.
  Preserve readable scales, status and warning indications.
  **Owner-approved placement scope (choice A):** Visuals' dock is only within
  the K.O. Tool browser virtual desktop/viewport. Do not introduce a native
  macOS/Windows wrapper or standalone desktop companion, host-OS always-on-top
  overlays, multi-application floating bars, or a promised later OS-overlay
  phase. The MiniMeters reference is about meter-strip design only. Scope
  the existing always-visible/auto-hide/manual-collapse options to Visuals
  while open **inside the browser**. Existing `index.html` and
  `css/base.css` form the current browser desktop; Visuals is not
  implemented. See docs/VISUALS.md.
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