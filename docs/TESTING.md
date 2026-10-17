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

## Completion checklist

- [ ] Inspected actual target-branch code and relevant authoritative contracts.
- [ ] Added regression tests where the behavior changed and reviewed any fixture modifications.
- [ ] Ran and reported exact commands/results, or explicitly reported skipped/unavailable tests.
- [ ] Reviewed permission, model/firmware evidence, device recovery, destructive confirmations and source-file preservation.
- [ ] For hardware-critical changes, obtained real-device HIL evidence and owner acceptance.
- [ ] Distinguished shipped, planned, simulated and physically verified behavior; updated Linear only from evidence and authorization.
