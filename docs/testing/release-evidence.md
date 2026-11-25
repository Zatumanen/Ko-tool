# K.O. TOOL release evidence

`docs/release-evidence.json` records the latest verified source, tested, merged,
manually published and served SHAs. The five values can differ. A fresh public
`build-version.json` observation belongs in `LIVE_SHA`. A completed manual Pages
workflow belongs in `PUBLISHED_SHA`. `MATCH` compares those two values only.

Enroll the registry in a PR dedicated to evidence and checking tools. For a
subsequent protected implementation change, set the affected feature
`evidenceUpdate` with the PR `baseSha`, a `tests` array of tracked executable
regressions, and a `note` explaining the verification. After CI, record the
exact tested SHA and run. Retained historical PASS records need their own `ci`
run link when the software checkpoint advances. Use `npm test` and
`node scripts/check-release-evidence.mjs --write-docs` to regenerate the marked
blocks before committing evidence changes. The CI check compares those blocks
and preserves historical prose outside them. On GitHub pull requests it also
checks changed source paths against the base registry. Source paths listed in a
feature record are watched, including paths removed by the change.

In the PR body, a change restricted to evidence documentation can include
`Release evidence exception (docs-only) <reason>`. A change restricted to
physical evidence documentation and fixture data can use
`Release evidence exception (HIL-only) <reason>`. The exception is scoped to
that PR and checks the changed paths. HIL fixtures use data file extensions.
Application code, scripts, CI and executable
tests still follow the regular validation. There is no override for contradictory
SHA, status or acceptance claims.

A feature records CODE, AUTOMATED, HIL and OWNER separately. Keep `HIL PENDING`
until the exact device and operation have recorded evidence. CI proves
repeatability for source and synthetic fixtures. An owner acceptance record
requires an explicit decision and an evidence link. A release GO requires a
single tested and merged RC SHA. Source-scoped feature acceptance, host and
security checks, and documented distribution rights must cover that candidate.

## Safe acceptance sequence

Record the app SHA, host, Chromium version, device model, exact firmware, enabled
routing, starting state, observed result and evidence link. Keep raw captures and
original audio private. Use expendable projects and slots for writes after the
owner authorizes the specific scenario. Stop on a scope violation, identity or
session change, unexpected device traffic, or missing readback.

| Stage | Minimum acceptance still needed | Evidence to retain |
| --- | --- | --- |
| 01 · My EP | On each exact model/firmware in the [device matrix](ep-device-compatibility-matrix.md), connect and read first. Back up project and slot data before authorized PUT/COPY/MOVE/Rename/DELETE and legacy Restore, use sacrificial fixtures and verify the required second delete confirmation. Obtain separate authorization for recovery interruption. Pad write and official PAK/PPAK Restore require firmware-scoped evidence before enabling a write path. | Session and model, expected and actual slot/project PCM and CRC, dependencies, preflight and readback, cancellation and journal evidence. Follow the [capture workflow](ep-file-capture-workflow.md). |
| 02 · SpeedUpperCut | On a supported EP, compare an expendable raw WAV, ZIP/drag-prepared WAV and normal ×2/−12 import using the same mono/stereo and loop/one-shot controls. Confirm the delivered PCM and metadata, and compare playback and duration. | Source input hash, fidelity and output sample rate, KORP status, destination and authoritative readback, audio observation and owner decision. |
| 03 · Visuals | On the designated MacBook Pro 2017, first record the input, sample rate and OS/Chromium baseline. Run 15 minutes with all seven modules, one hour switching visibility, themes and segmented recordings, and four hours of capture/endurance with the agreed windows. | Per-run CPU/RAM/FPS and track checks, expected hidden/collapsed behavior, zero unexpected fallback, recorded sample counts and WAV header/duration checks, owner acceptance of each module. PCM capture is capped per recording at 64 MiB, so use segments for long runs. |
| 04 · Sequencer | Use one authorized EP with external clock/thru sources documented. Capture passive MIDI while the owner operates Start, Stop, Continue, taps known pads and selects a pattern during playback. Keep the screen and trace order together. Repeat with a deliberately different pattern while leaving Save and all host-side mutation untouched. | EVENTS ONLY JSON and analyzer output, independent physical observations, loss/truncation flags, timestamps and event provenance. Require authoritative current project/pattern and timing evidence for each future Live operation. [Sequencer contract](sequencer-session.md). |
| 05 · FX-MIC Studio | Verify stock 1.1.2 diagnostics against read-only saved config and the hardware display. For the separately authorized 1.0.8 LOWPASS trial only, back up presets, use safe output level, compare before/after readback and verify restoration. | Firmware, prompt readiness, original and restored values, timeout/disconnect outcome and a physical audio comparison. Keep new firmware write permissions gated. [FX-MIC contract](fx-mic-studio.md). |
| 06 · EP-136 | In Visuals, select the owner-confirmed EP-136 browser audio input. Record OS/Chrome, EP routing, advertised and actual channel count, and the effect of reconnect. Feed distinguishable low-level signals to left/right and verify both PCM output and all modules. | Browser-exposed pair and order, clean WAV header/data for PCM16 and PCM24, missing/mono/multichannel diagnostic and reconnect result. [Official EP-136 guide](https://teenage.engineering/guides/ep-136). |

### DevTools evidence for an unsupported Live claim

With a separately authorized physical EP, open DevTools Sources for the
approved build or official tool. Identify its MIDI receive callback and outgoing
transport call site. Record relative monotonic timestamps, direction, message
family, command and result or timeout around one owner action per run. Correlate
each marker with the physical display. The app's passive EVENTS ONLY export
already records the supported input events. A lossless external MIDI capture
can supplement it when signal coverage is in question. Use an unmodified device
configuration between comparisons and record MIDI thru/clock settings.

For read-only discovery, do not send commands from the console or change the
renderer. Avoid breakpoints that pause timing during the test. Redact device
serials and unique port IDs, user sample names, raw PCM, USB descriptors and
private project JSON. Retain only the information required to replay the
observation. Clock spacing and SPP alone leave EP pattern and absolute playhead
unconfirmed.

### User smoke and rollback

Open the candidate on a supported desktop Chromium host in a fresh profile.
Open each available workspace by keyboard and pointer, resize with DevTools
undocked and docked, test device and audio permission denial and select a real
approved input explicitly. Verify import/export, cancel and local settings with
expendable content, then close and reopen each workspace. Check that the app
remains usable after a rejected file and that recovery stays visible after a
failed approved operation. Record hardware-dependent outcomes separately.

For an authorized publication, compare the workflow artifact and the public
version to the accepted RC SHA. On regression, preserve device data and logs and
use a separate approved rollback through the manual Pages workflow. Record the
previous verified version, both CI runs, affected functions and the live version.
