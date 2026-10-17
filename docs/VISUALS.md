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

All seven are **approved as the v1 feature set** and must remain available for selection. **Initial Balanced layout (owner-approved option C)** displays all seven modules when space permits. Users may subsequently hide/restore individual modules. Input-channel limitations should be explained honestly (e.g. mono input does not provide stereo spread).

### Default Balanced composition (owner-approved)

- **Large / prominent:** **Waveform** and **Spectrum** receive the most horizontal emphasis.
- **Medium:** **Spectrogram** receives moderate space.
- **Compact:** **Loudness**, **Stereo Meter**, **Output Meters**, and **Oscilloscope** are smaller but readable.
- The default must preserve the seven-module scope and never violate the responsive sizing rule: on narrow screens, shrink only to usable minimums and then **scroll horizontally**, not hide modules automatically.
- **Exact left-to-right order, numerical widths and ratios, minimum widths and scrollbar design are not selected.** Do not assume the numbered feature list above defines the visual order.
- This is the *default starting arrangement*, not a ban on user customizations or replacement of the three separate workflow presets (beatmaking, mixing, live filming). Restoring defaults should recover the Balanced composition without overwriting user-saved presets.

## Configurable strip and presets — owner choice C (approved)

The bottom meter strip is a **customizable modular workspace**:

- **Reorder:** drag modules left or right, preserving the user's selected order.
- **Resize:** change module widths within usable limits; avoid invisible controls or broken layouts.
- **Show / hide / restore:** temporarily remove individual modules from view without removing their feature or input configuration. Make all seven discoverable and restorable.
- **Built-in layout presets:** offer starting arrangements for **beatmaking**, **mixing**, and **recording/filming live performances**. Their exact compositions and visual appearance are **proposals requiring later design**; the three workflow purposes are approved.
- **Custom presets:** save user-configured layouts and recall them without reconstructing the strip manually. A custom preset records at minimum module selection, order and sizes; do not silently overwrite a saved preset when switching to another.
- **Responsive sizing (owner-approved choice C):** first proportionally fit visible modules into the current viewport width **down to a comfortable, accessible minimum per module**, while respecting the user's intended relative sizing and arrangement. If the sum of those minimum widths still exceeds the available width, enable **horizontal strip scrolling**. Do not automatically hide modules, reorder them, clip them without access, or squeeze them to an unusable width. User-hidden modules remain intentionally hidden and restorable.
- **Preset protection:** temporary responsive shrinking must not overwrite the user's stored module widths or custom preset. When the viewport widens, restore the chosen layout to the extent it fits.
- **Navigation:** the horizontally scrollable strip should have visible/understandable affordances and keyboard/pointer/trackpad access; details of scroll controls, minimum widths and breakpoint thresholds remain engineering/design decisions.

The **product contract includes saving and loading layouts**, but persistence implementation and scope (browser-local storage, account sync, import/export, cross-device use) remain undecided. Do not promise cloud synchronization or any particular storage service.

## Device-aware themes and module colors — owner-approved revision

The owner **replaced** the earlier Studio/Retro/Neon/Minimal proposal. The **exactly four** built-in theme names are now:

| Theme | Source of visual identity | Selection |
| --- | --- | --- |
| **Retro / WIN** | **K.O. Tool's actual Windows 95-inspired interface**; reuse its palette and classic beveled UI styling | Initial/no-device baseline; also manually selectable |
| **EP-133** | Design/color language of the physical **EP-133 K.O. II** | Automatically select after verified EP-133 identification |
| **EP-40** | Design/color language of the physical **EP-40 Riddim** | Automatically select after verified EP-40 identification |
| **Minimal** | Restrained uncluttered appearance, not specific to an EP model | Manually selectable |

**Source-backed Retro/WIN palette:** current `css/base.css` on `main` defines a teal desktop `#008080`, classic window gray `#c0c0c0`, navy title bars `#000080`, plus white `#fff` and gray `#808080` highlights/borders. These are **existing UI values**, not newly invented colors. The exact meter accent colors, and precise EP-133 / EP-40 / Minimal color tokens, still require dedicated visual study/design. For EP-device inspiration refer to official [EP-133](https://teenage.engineering/products/ep-133) and [EP-40](https://teenage.engineering/products/ep-40) product references, without copying trademarks/artwork/code.

### Automatic mapping after reading the connected device

Use the **validated device identity from My EP's existing connection/session**, not a guessed device name, audio-input label, or MIDI event alone. In `main`, `js/ep133/device.js` performs identity discovery and GREET/metadata validation, and `js/ep133/deviceCompatibilityMatrix.js` defines the supported SKUs:

| Confirmed identity/profile | Theme to open |
| --- | --- |
| `TE032AS001` — **EP-133 K.O. II** | **EP-133** |
| `TE032AS006` — **EP-40 Riddim** | **EP-40** |
| No verified device identity | **Retro / WIN** baseline; Visuals can still use any separately chosen audio input |

- Trigger device-specific styling **after successful device recognition/read** via My EP. Theme mapping is **visual only**: it does not enable device writes, assert project support, select an audio capture input, or bind Visuals to the EP.
- An observed `TE032AS002` identity may only be treated as the EP-133 profile when the existing GREET `base_sku=TE032AS001` rule has actually resolved it to that identity; an unverified alias must not be upgraded by Visuals.
- The existing matrix also recognizes **EP-1320 Medieval (`TE032AS005`)**. **No EP-1320-specific theme was requested**; never incorrectly label it EP-133 or EP-40. A final fallback/handling decision is still needed and must not silently add a fifth built-in theme.
- Keep all four themes **manually available** and retain **independent per-module color controls** from the previously approved customizable-themes direction. Changing the theme must not reset selected audio source, module visibility, layout/order/sizes or saved presets.
- **To decide:** how automatic device-based selection interacts with a *manually chosen* theme, how an unmatched/EP-1320 device or disconnection affects an active theme, and persistence of custom module colors. Do not invent precedence or background device polling until separately approved.
- Maintain readable scale/labels/status/warnings and visible permission/device provenance for every palette. Neither a model-themed UI nor an attached EP proves that USB Audio capture is available.

**Status:** owner-approved future product behavior, **not implemented** and not permission to change code or deploy.

## Strip visibility — owner choice C (approved)

- **Default: always visible.** When Visuals is open, show the docked bottom strip during normal K.O. Tool work and live recording.
- **Optional auto-hide:** users may explicitly enable a mode that retracts the strip when not interacting with it, and restores it when the pointer moves to the **bottom edge** of the K.O. Tool viewport. The trigger must not unexpectedly prevent access to desktop content.
- **Manual collapse/expand:** users may deliberately collapse the whole strip and bring it back via a visible, discoverable affordance without closing Visuals.
- **Accessibility:** hover-only interaction is not sufficient. Provide a focusable keyboard-accessible mechanism for restoring a hidden/collapsed strip; specific touch behavior remains subject to platform/browser feasibility.
- **Separate concepts:** hiding one meter module in a preset is different from auto-hiding or collapsing **the entire strip**. Do not silently delete a custom layout or reset the seven available modules when changing strip visibility.
- **Still to specify:** transition duration, reveal target size, manual-collapse vs auto-hide precedence, whether the preference is stored in presets or application settings, and what happens to audio capture/resource usage while hidden. Do not assume hidden means audio capture stops or continues; determine this explicitly before implementation and test permissions/privacy.

**No code has been approved or implemented by this design decision.**

**Browser boundary:** a web page can dock the strip at the **bottom of its own window/viewport**, not automatically create an OS-wide always-on-top strip over arbitrary desktop applications. Any true system-overlay behavior, native app wrapper, or beyond-browser windowing would require separate research and owner approval. Auto-hide and manual collapse **are approved as optional strip behaviors**; a fullscreen performance mode has **not** been approved.

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
- **Resolved:** the bottom strip supports drag-reordering, width adjustments, hide/restore, built-in layouts for beatmaking, mixing and live recording, and saving/reloading custom presets (owner choice C).
- **Resolved:** strip **always visible by default**, optional pointer-to-bottom-edge auto-hide, and explicit manual collapse/restore (owner choice C).
- **Resolved:** responsive choice C — shrink visible modules only to a comfortable minimum, then allow horizontal scrolling; no automatic hiding or reordering, and do not overwrite preset widths on viewport resize.
- **Resolved:** default **Balanced** starting layout: large Waveform/Spectrum, medium Spectrogram, compact Loudness/Stereo Meter/Output Meters/Oscilloscope (owner choice C).
- **Still open:** exact left-to-right order, numeric widths/ratios and minimum sizes, contents of three workflow presets, breakpoint thresholds, scrolling affordances, reveal/collapse details, hidden-state audio capture policy, and any alternate full-screen performance mode.
- **Resolved (supersedes old themes):** exactly four **Retro/WIN, EP-133, EP-40, Minimal** themes; Visuals starts with the current K.O. Tool Win-like Retro appearance when no supported device has been identified, then selects EP-133/EP-40 styling after validated device recognition. Per-module color customization remains.
- **Still open:** precedence of automatic themes vs manual choice, behavior for EP-1320/unknown device and disconnection, exact EP-133/EP-40/Minimal palette values, persistence of custom colors, overlay controls, layout preset persistence, and performance-friendly interaction details.
- Recording/export of Visuals (not currently authorized), if desired.
- Audio capture latency and performance budget, and supported platforms.

For the broader roadmap and qualitative source research see [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md). See [TESTING.md](TESTING.md) for the team's verification rules.
