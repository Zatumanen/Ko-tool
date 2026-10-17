# K.O. Tool — Visuals (product specification)

**Status:** owner-approved direction, 17 October 2026. **Visuals is not implemented in `main`.** This document describes intended behavior, not authorization to change application code.

## Product role and placement

- **K.O. Tool** is the virtual desktop and product; **Visuals** will be a **separate application with its own desktop icon** (owner choice A).
- Visuals is **not** a tab or panel inside My EP. The sequencer stays at `My EP → Projects → Sequencer` and requires a connected EP for project access.
- Goal: make live performances and on-camera sessions visually engaging with audio-reactive graphics (potential spectrum, waveform, oscilloscope, meter, spectrogram). Exact launch views, visual style, controls and exports remain open decisions.
- Reference for independent design research: [MiniMeters](https://minimeters.app/). Do not copy proprietary branding, code or graphic assets.

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

- Preferred launch layout: windowed meter workspace, full-screen performance stage, or both?
- Priority visualization types and whether they can be stacked/arranged as panels.
- Theme/palette/presets, overlays and performance-friendly controls.
- Recording/export of Visuals (not currently authorized), if desired.
- Audio capture latency and performance budget, and supported platforms.

For the broader roadmap and qualitative source research see [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md). See [TESTING.md](TESTING.md) for the team's verification rules.
