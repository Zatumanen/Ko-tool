# K.O. Tool — testing and hardware acceptance

This is the entry point for the **existing** test suites and the canonical specifications in [docs/testing/](testing/). Do not replace the evidence registry or present browser simulations as hardware verification.

## Test tools and commands

The project is static HTML/CSS/JavaScript. CI in [tests.yml](../.github/workflows/tests.yml) uses **Node.js 22**. Package scripts in [package.json](../package.json):

| Command | Purpose |
| --- | --- |
| `npm test` | Node built-in unit and behavioral tests (`node --test`) |
| `npm run build:pages` | Build versioned GitHub Pages bundle in `dist/` |
| `npm run test:e2e` | Playwright **Chromium** browser E2E, one worker, fake EP |

```bash
npm install --no-audit --no-fund
npx playwright install chromium
npm test
npm run build:pages
npm run test:e2e
```

For focused checks:

```bash
node --test tests/audio-pipeline-golden.test.mjs
node --test tests/project-sequencer-ui.test.mjs
npx playwright test tests/e2e/my-ep-live-project-refresh.spec.mjs
```

[playwright.config.mjs](../playwright.config.mjs) starts `node tests/e2e/server.mjs` on `http://127.0.0.1:4173` automatically. Stop a manually launched server before E2E because `reuseExistingServer: false` and the port is fixed. Browser automation uses `tests/e2e/fake-ep-browser.js`.

**This document is instructions, not a claim that these commands were run during documentation work.** GitHub Actions on `main` runs tests and Pages build; a push to `main` also triggers [Pages deployment](../.github/workflows/deploy-pages.yml).

## Evidence levels

1. **Source review:** confirms implementation paths, not behavior on a physical EP.
2. **Node tests:** check the exact code and fixtures executed; no browser claim.
3. **Chromium E2E with fake EP:** browser workflow against simulated MIDI/FILE; no physical hardware claim.
4. **Captured real-device protocol traces:** only the exact supported command and firmware scope. Retain provenance and SHA-256.
5. **Physical HIL:** real model and firmware, explicit procedure, backed-up state, result and readback. This alone supports the corresponding hardware acceptance criterion.

A merged PR, green CI, or passing fake device test does **not** automatically close [ZAT-9](https://linear.app/clouded/issue/ZAT-9) or [ZAT-48](https://linear.app/clouded/issue/ZAT-48).

## Regression test selection

| Change area | Focused tests and evidence |
| --- | --- |
| x2, channels, metadata, WASM | `tests/audio-pipeline-golden.test.mjs`, `tests/processor.test.mjs`, `tests/resampler-zip.test.mjs`, converter E2E |
| Folder/ZIP/names | `tests/audio-import-policy.test.mjs`, `tests/output-name.test.mjs`, `tests/e2e/folder-import-recovery.spec.mjs`, `tests/e2e/output-file-names.spec.mjs` |
| Sample upload and slot numbering | `tests/ep-sample-numbered-upload.test.mjs`, `tests/sample-upload-name-normalization.test.mjs`, `tests/e2e/my-ep-numbered-upload-choice.spec.mjs` |
| MOVE/COPY/DELETE and dependencies | `tests/sample-dependency-index.test.mjs`, `tests/e2e/sample-dependency-guard.spec.mjs`, sample transaction and recovery tests |
| Projects, sequence, recovery | `tests/projects-readonly.test.mjs`, `tests/project-sequencer-ui.test.mjs`, `tests/project-recovery.test.mjs`, `tests/project-write-diff.test.mjs`, project E2E |
| Browser/firmware capability | `tests/platform-support.test.mjs`, `tests/device-compatibility-matrix.test.mjs`, `tests/device-identity-as002.test.mjs`, platform E2E |

These focused tests do not replace the full suite for changes involving production audio bytes, transport, firmware evidence, device writes, recovery, project archives, or release behavior. Always preserve the existing public behavior unless a change is explicitly approved.

## Audio and browser acceptance

- The converter applies x2 with `sound.pitch=-12`, s16 WAV, preset rates HI 46875 / MID 32000 / LO 26250 Hz; test mono/stereo/original, one-shot/loop/original, trim, cancellation, names and byte-aware golden fixtures.
- Batch cases must cover a valid file, corrupt/unsupported audio, empty files, `._*` and `__MACOSX`; successful files survive per-file failures.
- Converter exports retain numeric filename prefixes. My EP may interpret slot prefixes **1–999** for destination placement and device-only name stripping.
- Web MIDI permission is distinct from Web Audio. Converter remains accessible without Web MIDI; My EP requires desktop Chromium, HTTPS or localhost, SysEx authorization, recognized SKU and firmware-scoped permission.
- Check missing Web MIDI, denied SysEx, restricted permissions policy, unavailable file/folder picker, disconnected or unsupported device, and download fallback.

Authoritative references: [audio x2 pipeline](testing/audio-x2-pipeline.md), [browser support](testing/browser-platform-support.md), [device compatibility](testing/ep-device-compatibility-matrix.md).

## Hardware-in-the-loop gate

Before **any** device write, destructive action, firmware test, or deliberately interrupted transfer:

- Obtain explicit owner approval for the hardware scenario.
- Back up valuable device data and use sacrificial slots/projects.
- Record commit/PR, Linear ticket, tester/date, host OS/browser, USB connection, GREET-confirmed model/SKU, **exact firmware**, initial slot/project contents, space, metadata/CRC, expected and actual outcome.
- Close other device-managing applications; never assume an unknown session is safe.
- Keep redacted diagnostic logs and trace provenance outside public commits when private device data is present.
- After write, read back authoritative FILE info, metadata, CRC and dependent project state. Test recovery after interrupted sessions only with expendable content.

| HIL scenario | Required verification |
| --- | --- |
| Connection and permission | Reject unsupported firmware, ambiguous SKU, permission denial, unsafe/reconnected session **without mutation** |
| Numbered / batch PUT | Correct free destination, content and metadata, 16-char EP names, file CRC; occupied/duplicate slot, full storage, cancel, reconnect |
| Native MOVE | CRC checked at destination; source availability and recovery on failure |
| Option-drag COPY | Source unchanged, new bytes equal and read back; full-storage and rollback cases |
| Rename / metadata | Read back fields; deny unsupported changes and stale data |
| DELETE | Unreferenced delete; referenced pads require **second explicit informed confirmation**, cancel performs no write |
| Projects | Read-only display and backup; write only with proof; block missing scene refs, 27-byte pad records and unsafe active projects |
| Opt-in auto refresh | `AUTO: OFF` has no periodic reads; `AUTO: ON` reads saved data, stops when hidden/busy/disconnected; no writes |

Refer to [EP FILE hardware capture workflow](testing/ep-file-capture-workflow.md) for missing GET/MOVE traces and failure cases. Do not convert synthetic data into “real hardware” evidence.

## Future-feature acceptance, not yet implemented

### My EP REPITCH (owner-approved behavior)

- REPITCH **ON by default**, manually switchable OFF.
- ON + valid Teenage Engineering WAV `LIST/INFO/TNGE` with exact `sound.pitch=-12`: **no second x2**; if formatting is required, preserve pitch and playback duration.
- ON without that marker: apply the existing x2 pipeline and set `sound.pitch=-12` before upload. Corrupt metadata must fail explicitly.
- OFF: use current direct upload path without automatic x2.
- All three cases: preserve original local file, device capability and upload transaction guards, occupied-slot policy, metadata verification, and batch cancellation.

### Saved sequencer — both views

- **Owner-approved access rule:** real My EP Projects and Sequencer views require a physically connected, recognized EP with an authorized session. With no EP attached, local project archives must not enable an offline project viewer/editor; show a clear disconnected state. On disconnect while viewing, disable interactions and do not present stale data as live.
- **Scope:** test fixtures and offline parser unit tests remain valid developer tooling; **SpeedUpperCut audio conversion** must continue to work without an EP.
- On saved read-only archives obtained through the connected device, **Step Sequencer and Piano Roll render the same events**. Switching modes never mutates the archive or device.
- Check groups A–D, multiple 16-step pages, variable note lengths, off-grid ticks, melody pitch, velocity, unknown events, missing scene refs, unsupported firmware and 27-byte pad records.
- Viewing must work safely even when project authoring is forbidden; simulated FILE logs must show no PUT/MOVE/DELETE/METADATA SET.

### Live sequencer

- No claim of exact live playhead or unsaved patterns until real EP MIDI/transport traffic has been captured and proven on specified firmware.
- Show truthful modes: saved-only, events-only and hardware-synchronized only when supported. Test PLAY/STOP, tempo, drift, interruption, loss of clock, reconnect, instrument response and FILE contention.
- **Do not turn the opt-in 20-second saved-project poll into “live” by shortening the timer.**

Detailed requirements: [SEQUENCER.md](SEQUENCER.md).

### Future Visuals: selectable live audio source (owner option C)

- **Visuals is a separate app within the K.O. Tool browser virtual desktop**, not a My EP tab or host-OS native app, and is not implemented yet. Test without an EP attached using an explicitly selected compatible microphone/audio interface.
- List permitted browser audio input devices; EP may appear **only** when USB Audio capture is genuinely exposed by the OS/browser. No fake audio path through Web MIDI or SysEx.
- Confirm permission prompts, permission-denied and missing-device states, switching sources, device disconnect/reconnect, and termination of old media tracks; **no silent fallback** to another microphone.
- Test HTTPS/localhost and restricted browser permissions, performance on Mac and Windows, and real-device capture separately with model/firmware/browser/OS evidence.
- **Owner-approved browser-only placement (choice A):** launch Visuals from an icon **inside the K.O. Tool virtual desktop**. Render its horizontal bottom-docked strip **only in the K.O. Tool browser viewport** while Visuals is open. Test page/window resizing, browser viewport bounds, coexistence with SpeedUpperCut/My EP, and unobstructed access to essential controls. The strip must not be described as an OS-global always-on-top overlay; it will not remain atop other macOS/Windows applications. Do not ship or require a native wrapper, OS overlay service or promised separate desktop phase.
- Test that existing **visible by default, optional auto-hide, manual collapse** semantics apply only to the in-browser strip; reopening other host applications is not an overlay or always-on-top test.
- **All seven V1 modules are in scope:** Waveform, Spectrum, Loudness, Stereo Meter, Output Meters, Oscilloscope and Spectrogram. Check for real input-driven output, no false live data, stable performance, stereo limitations on mono inputs and narrow-screen overflow. Exact numerical sizes/order remain undecided.
- **Default Balanced acceptance (owner choice C):** initial strip contains all seven modules; Waveform and Spectrum are visually large/prominent, Spectrogram medium, Loudness/Stereo Meter/Output Meters/Oscilloscope compact but readable. Test switching to another layout and restoring Balanced without loss of saved custom presets, including viewport shrink/scroll scenarios. No implied fixed left-to-right order or arbitrary pixel-width assertions until designed.
- **Owner-approved strip height choice B acceptance:** drag the **top edge** of the bottom-docked Visuals strip upward/downward; the **bottom edge stays anchored** inside the K.O. Tool browser viewport. Check continuous/responsive resizing and visual redraw at small and large viewport heights, legible meters, usable controls, no clipped/irretrievable resize affordance, intact module order/visibility and unchanged audio-capture/source state. There must be **no dependency on Compact/Standard/Expanded height presets**. **Owner-approved height memory choice A and standard-height choice B:** after dragging to a different height, close/reopen Visuals and separately reload K.O. Tool, then reopen: in both cases the strip must return to exactly **150 CSS px** at normal desktop viewport sizes. Confirm that browser-local custom layout presets preserve their module order/visibility/intended widths but **do not persist the strip height**. Do not create a browser-global height preference or require Compact/Standard/Expanded size modes. Test the 150 CSS px default across browser zoom/device pixel ratios without mistaking CSS pixels for physical display pixels. **Owner-approved height limits choice A:** enforce **minimum 90 CSS px** and **maximum 40% of K.O. Tool's browser viewport CSS height** where both constraints can hold. Example: at 800 CSS px viewport height, max = 320 px and the default = 150 px; at 300 CSS px viewport height, max = 120 px so launch no higher than 120 px. Test dragging to each bound, resizing the browser, zoom/device pixel ratios, bottom docking and access to My EP and SpeedUpperCut controls. When viewport height is **under 225 CSS px**, the cap is lower than the minimum: document the conflict and do not assert an unapproved fallback. Same-session preset-switch height behavior remains unresolved.
- **Owner-approved configuration acceptance:** reorder modules via drag, resize their widths, hide and restore all seven, apply built-in presets for beatmaking/mixing/live recording, save a custom layout and reload it without changing its intended selection/order/sizes. Test restoring defaults, switching between presets without unintended overwrite, and unworkable width/viewport conditions. Precise min/max sizes, scrolling behavior and storage record schema require separate design.
- **Browser-local layout storage acceptance (owner choice A):** save multiple named presets including module visibility, order and intended widths. Close/reopen Visuals and separately reload K.O. Tool in the **same browser profile and site origin**; verify the presets can be recalled with no file picker. Test switching layouts, unsaved changes, no accidental overwrite and viewport narrowing/widening without mutating stored widths. Do not require file Export/Import, account, server or cross-device sync. Test blocked storage, private mode, cleared site data and a different browser profile; report missing saves honestly. Confirm that restoring saved layouts does not disable the separate per-launch Auto Theme reset. Exact browser storage API/schema remains undecided; **strip height must not persist** in saved presets or browser settings.
- **Owner-approved visibility acceptance:** entire strip **visible by default** while Visuals is open; opt-in auto-hide retracts the strip and pointer movement to the bottom viewport edge reveals it; explicit manual collapse/restore works without closing Visuals. Test visible/revealed/collapsed states, keyboard-accessible restore, no accidental loss of module visibility/layout/presets and no interruption to essential My EP controls. Decide and separately test audio capture behavior during hidden state before implementing; never leave hidden microphone capture without clear user status/controls.
- **Responsive choice C acceptance:** resize the viewport through ample, narrow and minimum widths. Visible modules shrink only to an accessible minimum; when the layout cannot fit, users can scroll the bottom strip horizontally to reach every selected module. No unintended hiding, reordering, clipped-unreachable meters, loss of keyboard access, or mutation of saved preset widths. Restoring window width restores intended sizing where possible. Set precise min widths and scrolling mechanisms before coding.
- **Owner-approved revised theme acceptance:** expose exactly four selectable themes (**Retro/WIN, EP-133, EP-40, Minimal**) with independent module color controls. Retro inherits the actual K.O. Tool Win-like styling (including teal `#008080`, gray `#c0c0c0`, navy `#000080`) rather than an invented palette.
- **Device-driven selection:** after validated My EP identity/GREET, resolved `TE032AS001` -> EP-133 theme and `TE032AS006` -> EP-40 theme; before a model is recognized the baseline is Retro/WIN. Test disconnected startup, exact model/firmware session evidence, failed identity, reconnection, rapid swaps and EP-133 identity variant `TE032AS002` with verified/unverified `base_sku` cases. **EP-1320 Medieval `TE032AS005` maps to Retro/WIN in Auto Theme (owner choice A)**, while the displayed device model must remain EP-1320; no fifth theme and no false EP-133/EP-40 identity. **Owner choice A:** on real disconnection while Auto Theme is ON return to Retro/WIN immediately, keep Auto Theme ON, clear stale identified-device state, and allow a newly validated EP to select its theme again. Test physical removal, software disconnect, rapid reconnects, model swaps and connection failure; never leave an old EP theme falsely indicating live device identity. Unknown/ambiguous identities still require a later decision.
- **Theme precedence acceptance (owner choice B):** Auto Theme starts ON. With no verified identity show baseline Retro/WIN; a validated EP-133/EP-40 connection in auto mode selects its theme. Manually choosing **any** built-in theme disables Auto Theme **for the current Visuals session**, and the manually selected theme remains unchanged on connecting, disconnecting, reconnecting or swapping EPs. An explicit Auto Theme ON action restores model-based selection for verified EP-133/EP-40, or Retro/WIN for verified EP-1320 or no recognized device identity. Never infer the model from the audio input's name, auto-select on an unverified alias, poll the device merely for theme changes, or make changes to device state. Test the manual override with every one of the four themes. Unknown/ambiguous identity fallback remains an open design decision.
- **Theme restart acceptance (owner choice A):** after choosing a manual theme (and thus Auto Theme OFF), **close and reopen Visuals**, then separately **reload the K.O. Tool page** and reopen Visuals. In both cases Auto Theme MUST start ON and must not restore the previous session's manual theme. With verified EP-133, verify EP-133 theme; with EP-40, verify EP-40; with verified EP-1320 or no verified identity, verify Retro/WIN. Reject stale cached identity or restored manual mode as a theme source. Verify layout presets/module settings are not deleted and resetting theme mode never silently activates an audio input or bypasses permission.
- **Theme disconnect isolation:** while Auto Theme is OFF, manually selected Retro/WIN, EP-133, EP-40 or Minimal stays active across EP disconnection. Verify the device indicator shows disconnected in both modes. Changing back to Retro/WIN in Auto Theme must not silently switch microphone/audio inputs, terminate an independent live input, or leave a disconnected audio input falsely labeled as live.
- **Theme isolation:** change theme without resetting chosen audio input, layout/presets or module selection/order/sizes. Manual module colors stay independent, text/scales/peak/status/warnings readable. Device identity for theme selection does not prove USB Audio availability and cannot authorize hardware writes. Exact EP-themed palettes, custom override persistence and relationship to layout presets require separate design; browser/cloud sync is not implied.
- Do not claim a USB Audio HIL pass from a fake-EP E2E suite. See [VISUALS.md](VISUALS.md).

## Completion checklist

- [ ] Inspected actual target-branch code and relevant authoritative contracts.
- [ ] Added regression tests where the behavior changed and reviewed any fixture modifications.
- [ ] Ran and reported exact commands/results, or explicitly reported skipped/unavailable tests.
- [ ] Reviewed permission, model/firmware evidence, device recovery, destructive confirmations and source-file preservation.
- [ ] For hardware-critical changes, obtained real-device HIL evidence and owner acceptance.
- [ ] Distinguished shipped, planned, simulated and physically verified behavior; updated Linear only from evidence and authorization.
