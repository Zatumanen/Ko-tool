# K.O. Tool — Visuals (product specification)

**Status:** owner-approved direction, 17 October 2026. **Visuals is not implemented in `main`.** This document describes intended behavior, not authorization to change application code.

## Product role and placement

- **K.O. Tool** is the virtual desktop and product; **Visuals** will be a **separate application with its own desktop icon** (owner choice A).
- Visuals is **not** a tab or panel inside My EP. The sequencer stays at `My EP → Projects → Sequencer` and requires a connected EP for project access.
- Goal: make live performances and on-camera sessions visually engaging with audio-reactive graphics. **Owner-approved default presentation:** a long, low-profile **meter dock strip along the bottom edge** of the K.O. Tool screen/browser viewport (owner choice B); not a large conventional app window. This resembles the overall arrangement in the owner's supplied concept image, but is not a mandate to copy any existing product. Exact sizing, full-screen alternatives and OS-level windowing are not yet approved.
- Reference for independent design research: [MiniMeters](https://minimeters.app/). Do not copy proprietary branding, code or graphic assets.

## Bottom meter strip — owner-approved layout and v1 modules

**Default layout (owner choice B):** a continuous horizontal **Visuals meter strip across the bottom** of the available K.O. Tool viewport, intended to stay visible while using My EP and for filming hardware performances. The width should follow the available screen/viewport; ensure readability at realistic desktop widths.

**First-version module scope (owner choice C, seven distinct modules):**

1. **Waveform** — incoming time-domain audio shape.
2. **Spectrum** — frequency-domain energy distribution.
3. **Loudness** — visible loudness level readout/meter; exact algorithm (e.g. LUFS) requires separate technical specification and verification.
4. **Stereo Meter** — stereo imaging/correlation visualization, only when input channels provide meaningful stereo data.
5. **Output Meters** — channel level/peak display for the audio being analyzed; **this does not imply browser capture of the system's output**.
6. **Oscilloscope** — detailed time-domain trace; distinct display mode from overview waveform.
7. **Spectrogram** — frequency energy over time.

All seven are **approved as the v1 feature set**, but their exact order, default widths, simultaneous visibility at small viewport sizes, collapse/overflow behavior, presets and drag/reorder controls are still to be decided. Do not silently drop one from the intended module scope. Input-channel limitations should be explained honestly (e.g. mono input does not provide stereo spread).

**Browser boundary:** a web page can dock the strip at the **bottom of its own window/viewport**, not automatically create an OS-wide always-on-top strip over arbitrary desktop applications. Any true system-overlay behavior, native app wrapper, or beyond-browser windowing would require separate research and owner approval. Neither a fullscreen performance mode nor auto-hide has been approved.

## Audio source policy — owner choice C (approved)

**Universal selectable audio input**, not restricted to the EP device:

1. If the connected EP appears to the OS and browser as a **capture-capable USB Audio input**, the user may select it.
2. The user may instead choose **another browser-accessible audio input**, e.g. audio interface/line-in, USB microphone, built-in microphone, or an OS virtual audio input that is explicitly exposed to the browser.
3. Visuals **must not require a connected EP** when the user chooses another compatible audio input. Conversely, an EP's Web MIDI/SysEx connection does not automatically make its audio available.
4. The user controls input selection; Visuals must display the active source and live/permission/disconnected status. Do not silently switch to a microphone or another input when the chosen source disappears. Any fallback must be clear and user-approved.

**Source is the user's chosen live audio input**, not an implicit output-device/system-audio loopback or audio extracted from MIDI events. Support for capture of computer playback or mixing multiple sources is **not approved** by the C selection and requires its own design decision.

## Technical boundary and external sources

Current repository `main` contains a SpeedUpperCut audio converter and My EP (Web MIDI/SysEx) but no Visuals app or verified browser audio-capture implementation. It is not valid to infer a supported EP USB-audio stream from a firmware changelog alone.

Relevant standard web APIs (prospective implementation, **not current code**):

- [MDN `MediaDevices.enumerateDevices()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices): lists permitted hardware audio input devices, subject to permissions and secure context; some labels/devices remain hidden until permission is granted.
- [MDN `MediaDevices.getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): asks permission for a requested audio input and yields a `MediaStream` when supported. Explicit user permission and secure context (HTTPS/`localhost`) are required.
- Web Audio analysis can consume a granted media stream, but the exact pipeline, latency, quality, DSP visualization and browser support are still design/implementation work.
- **USB Audio, Web MIDI, and device FILE/SysEx are separate interfaces.** Do not promise cross-OS simultaneous performance or assume device exposure just because My EP connects.

## Proposed UX contract (to validate before implementation)

- Opening Visuals shows a clear **Select audio input** control and idle state; no permission prompt or audio recording without an explicit user action.
- After permission is granted, list available browser audio inputs with names when permitted, including the EP if the OS and browser expose it.
- Switching inputs must stop the previous media track and release any unused audio stream; do not leave hidden microphone capture running.
- Clearly handle permission denied/revoked, no available device, unplugging EP/interface, OS device change, tab hidden, and browser loss of capture.
- When an audio input is missing/unsupported, display an explanation and possible corrective action, not a fake animation falsely labeled as live audio.
- Independently of My EP connection, users should be able to use Visuals with another selected audio interface or microphone, where the browser supports it.
- Performance graphics should favor smooth response, legibility from a camera, restrained CPU load, and a non-distracting presentation.

## Verification and acceptance plan (future code authorization required)

| Scenario | Expected |
| --- | --- |
| No EP, supported microphone / audio interface | Explicit permission then live visualization from chosen input |
| EP present as browser `audioinput` | EP selectable, input works if actually exposed and authorized |
| EP connected only for Web MIDI | No false promise of audio input; user can choose another audio source |
| No permission / denied permission | Clear explanation; no live capture or false success state |
| Source disconnects | Show disconnect, stop old track, no silent microphone fallback |
| Switch sources | Release old audio stream and use only new selected input |
| No secure context / unsupported browser | Clear compatibility error instead of broken interface |
| Hardware test | Actual Mac/Windows browser, exact OS version, EP model/firmware, selected input and observed audio capture evidence |

No fake-EP browser test or UI mockup alone proves USB Audio behavior on physical EP hardware.

## To be decided in future interviews

- **Resolved:** default is a bottom docked meter strip; v1 includes all seven named modules (Waveform, Spectrum, Loudness, Stereo Meter, Output Meters, Oscilloscope, Spectrogram).
- **Still open:** exact left-to-right arrangement, module resizing/reordering, responsive overflow, always-visible vs auto-hide; any alternate full-screen performance mode.
- Theme/palette/presets, overlays and performance-friendly controls.
- Recording/export of Visuals (not currently authorized), if desired.
- Audio capture latency and performance budget, and supported platforms.

For the broader roadmap and qualitative source research see [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md). See [TESTING.md](TESTING.md) for the team's verification rules.
