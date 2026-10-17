# K.O. Tool — Visuals (product specification)

**Status:** owner-approved direction, 17 October 2026. **Visuals is not implemented in `main`.** This document describes intended behavior, not authorization to change application code.

## Product role and placement

- **K.O. Tool** is the **browser-based virtual desktop** and product; **Visuals** will be a **separate app with its own icon inside that virtual desktop** (earlier owner choice A for app placement). It is **not** a native macOS/Windows app or an icon on the host operating system's desktop.
- Visuals is **not** a tab or panel inside My EP. The sequencer stays at `My EP → Projects → Sequencer` and requires a connected EP for project access.
- Goal: make live performances and on-camera sessions visually engaging with audio-reactive graphics. **Owner-approved default presentation:** a long, low-profile **meter dock strip along the bottom edge** of the K.O. Tool browser viewport (owner choice B); not a large conventional app window. This resembles the overall arrangement in the owner's supplied concept image, but is not a mandate to copy any existing product. Exact sizing and optional **in-browser** performance views remain separate decisions; host-OS overlays/windowing are **outside the chosen product scope**.
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
- **Resize module widths:** change individual module widths within usable limits; avoid invisible controls or broken layouts.
- **Resize the entire strip's height — owner choice B (approved):** the user may drag the **top border/resize handle** of the bottom-docked strip **up or down** to freely adjust its height. **Do not require Compact, Standard or Expanded height presets**; those options were explicitly not selected. The lower edge remains docked to the bottom of the K.O. Tool browser viewport while the upper edge moves.
- **Usable bounds:** the resizing interaction should preserve readable meter controls and enough reachable K.O. Tool workspace; define actual minimum/maximum heights based on tested viewport constraints before implementation, rather than inventing pixel values. Avoid covering critical My EP/SpeedUpperCut controls or trapping the resize handle.
- **Behavior while resizing:** all seven available modules remain selectable and the current visible layout/order is preserved. Visualizations should reflow/re-render to the new height without falsely reporting new audio measurements or breaking input capture. Ensure pointer/keyboard/touch interaction and discoverability are considered during implementation.
- **Unresolved:** numeric default height, minimum/maximum constraints, whether adjusted height is stored per custom layout / globally / per session, and what happens to height when changing layouts. This choice does not imply height persistence or a native fullscreen mode.
- **Show / hide / restore:** temporarily remove individual modules from view without removing their feature or input configuration. Make all seven discoverable and restorable.
- **Built-in layout presets:** offer starting arrangements for **beatmaking**, **mixing**, and **recording/filming live performances**. Their exact compositions and visual appearance are **proposals requiring later design**; the three workflow purposes are approved.
- **Custom presets:** save user-configured layouts and recall them without reconstructing the strip manually. A custom preset records at minimum module selection, order and sizes; do not silently overwrite a saved preset when switching to another.
- **Responsive sizing (owner-approved choice C):** first proportionally fit visible modules into the current viewport width **down to a comfortable, accessible minimum per module**, while respecting the user's intended relative sizing and arrangement. If the sum of those minimum widths still exceeds the available width, enable **horizontal strip scrolling**. Do not automatically hide modules, reorder them, clip them without access, or squeeze them to an unusable width. User-hidden modules remain intentionally hidden and restorable.
- **Preset protection:** temporary responsive shrinking must not overwrite the user's stored module widths or custom preset. When the viewport widens, restore the chosen layout to the extent it fits.
- **Navigation:** the horizontally scrollable strip should have visible/understandable affordances and keyboard/pointer/trackpad access; details of scroll controls, minimum widths and breakpoint thresholds remain engineering/design decisions.

### Browser-only saved layouts — owner choice A (approved)

- **Custom layouts are saved locally in the user's browser**, without an account or server. After saving a named arrangement, it becomes available again when Visuals is reopened or K.O. Tool is reloaded in the **same browser profile and site origin**, without requiring an external file.
- A saved layout records at least module visibility, order and intended widths. Loading it must not silently overwrite other saved presets. Temporary viewport resizing and horizontal scrolling must not change stored widths.
- **Do not implement Export/Import preset files, cloud accounts, backend storage or cross-device/browser synchronization** as part of this approved choice. The exact browser storage API and record/version schema remain technical decisions to review before implementation.
- Browser-local data can be lost through clearing site data, browser storage eviction or use of private mode; it is not automatically available in a different browser/profile/origin. Never guarantee recovery or survival after deleting local data. Handle denied/unavailable storage without claiming successful saves.
- **Not resolved here:** whether the manually adjusted height of the whole strip belongs to a saved layout; whether separate module color overrides or other application settings persist. The independently approved rule that **Auto Theme resets ON at each new Visuals launch** remains in force.

This is future behavior only. No application code has been approved or implemented by this decision.

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
| `TE032AS005` — **EP-1320 Medieval** | **Retro / WIN** (owner choice A, no fifth theme) |
| No verified device identity | **Retro / WIN** baseline; Visuals can still use any separately chosen audio input |

- Trigger device-specific styling **after successful device recognition/read** via My EP. Theme mapping is **visual only**: it does not enable device writes, assert project support, select an audio capture input, or bind Visuals to the EP.
- An observed `TE032AS002` identity may only be treated as the EP-133 profile when the existing GREET `base_sku=TE032AS001` rule has actually resolved it to that identity; an unverified alias must not be upgraded by Visuals.
- **Resolved (owner choice A):** the existing matrix recognizes **EP-1320 Medieval (`TE032AS005`)** and, with **Auto Theme ON**, selects **Retro / WIN**. Keep the device label/identity as **EP-1320 Medieval**; assigning a generic visual theme must not misrepresent its detected model or grant hardware permissions. Do not introduce a fifth built-in theme. Unrecognized/ambiguous identities still require conservative handling.
- Keep all four themes **manually available** and retain **independent per-module color controls** from the previously approved customizable-themes direction. Changing the theme must not reset selected audio source, module visibility, layout/order/sizes or saved presets.
### Auto Theme versus manual theme — owner choice B (approved)

- **Auto Theme ON by default:** when Visuals is opened without a verified EP identity, use Retro/WIN as the baseline. After My EP successfully identifies a supported EP-133 (`TE032AS001`) or EP-40 (`TE032AS006`) in the current device session, Auto Theme selects that model's theme; for an identified EP-1320 Medieval (`TE032AS005`), it selects Retro/WIN.
- **Manual choice takes priority during the current Visuals session:** choosing any of the four themes manually **turns Auto Theme OFF** and keeps the chosen theme active across subsequent EP connections, disconnections and swaps **until the user deliberately re-enables Auto Theme or starts a new Visuals session**. Never overwrite a manual choice on a device event during that session.
- **Explicit return to automatic:** a discoverable **Auto Theme** toggle/action allows the user to re-enable device-based selection. Apply the matching theme for a currently confirmed EP-133 or EP-40; apply Retro/WIN for a confirmed EP-1320 or when no verified device identity exists. An *unknown or ambiguous* identified device is not necessarily EP-1320: do not infer a model or secretly remap it.
- **Separate state:** manual/automatic mode is a theme preference and must not alter the chosen audio input, start/stop sound capture, change a project or issue SysEx/FILE commands. The existing device connection notification may inform visual selection; do not add device polling just to switch themes.
- **Auto Theme disconnect rule (owner choice A, approved):** when a confirmed EP connection is lost and **Auto Theme is ON**, promptly return to **Retro / WIN** regardless of whether the previous automatic theme was EP-133, EP-40 or Retro/WIN. Treat the previous device identity as stale; update device connection/status indicators honestly. **Keep Auto Theme ON** so a later validated reconnection can select the appropriate theme again.
- **Manual override exception:** when Auto Theme is OFF because the user selected a theme manually, disconnection **does not change that theme**. Do not silently re-enable Auto Theme.
- **Separate audio policy:** a theme change or EP MIDI disconnection **must not automatically replace the selected audio source, silently activate a microphone, or assert that audio capture has stopped**. If the *selected audio capture input* also disconnects, follow the separate live-input disconnection policy and show the proper status. An unrelated audio interface/microphone can continue if its own stream remains available.
- **Source-backed device event:** existing `js/ep133/device.js` in `main` clears `deviceInfo` and publishes `DEVICE_DISCONNECTED` in `disconnectEp133()`. The future theme integration should react to the verified session's connection/disconnection notifications, not poll device FILE or use a guessed timeout.
- **New Visuals session/restart (owner choice A, approved):** every time Visuals is **opened anew**, including reopening the app after closing it or reloading K.O. Tool, **initialize Auto Theme to ON**, **do not restore a previously manually selected theme or the previous Auto Theme OFF setting**, and resolve the theme from the **currently verified** My EP session. If EP-133 is verified, select EP-133; if EP-40 is verified, select EP-40; if EP-1320 is verified or there is no verified device, use Retro/WIN. A stale remembered device identity cannot select a theme; a subsequently verified device may trigger the matching theme.
- This reset applies to **theme mode/active theme only**: it is **not permission to delete saved layout presets, per-module custom colors or unrelated settings**, whose respective storage/behavior requires separate decisions. Resetting theme mode must never bypass browser audio permissions or silently choose an audio input.
- **Still open:** treatment of unknown/ambiguous identities. EP-1320 mapping, manual override priority *within a session*, disconnection behavior and reset-to-Auto Theme on the next Visuals launch are settled. Keep independent module color controls.

Do not invent automatic precedence over a manual theme or background device polling.
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

## Platform and placement boundary — owner choice A (approved)

**Visuals operates only inside the K.O. Tool browser page / virtual desktop.** Launch it through its **K.O. Tool desktop icon**; its modular strip is **docked to the bottom edge of the application's browser viewport**, not the physical monitor or other OS application windows. The current repository `main` implements its shell as a browser page (`index.html`, `.desktop-apps` desktop container, browser window styling in `css/base.css`). Visuals is not yet present in that shell.

**Explicitly excluded from approved implementation scope:** native macOS or Windows companion app, system-level always-on-top overlay, positioning above Logic/Ableton/other unrelated OS windows, and any planned second desktop-app phase. The MiniMeters reference governs the *strip's appearance and meters*, **not** desktop-overlay capability. Users viewing another OS program or browser tab will not see the K.O. Tool Visuals strip on top of it.

The strip's existing always-visible/auto-hide/manual-collapse decision applies **within the K.O. Tool viewport while the Visuals app is open**. Preserve the ability to interact with SpeedUpperCut and My EP inside K.O. Tool without accidentally obscuring critical controls. Auto-hide and manual collapse remain approved optional behaviors; separate in-browser full-screen performance presentation **has not been approved** and is not implied by this decision.

No application code or native package creation is authorized by this documentation decision.

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
- **Resolved (placement choice A):** Visuals exists only within the K.O. Tool browser virtual desktop, using its own internal app icon and a viewport-bottom strip. No native wrapper, OS-global overlay/always-on-top, or follow-up standalone desktop phase is approved.
- **Resolved (strip height choice B):** free manual resizing of the *whole strip's height* by dragging its top edge up/down, remaining docked to the browser bottom. No mandatory Compact/Standard/Expanded height modes.
- **Resolved (custom layout storage choice A):** named Visuals layout presets persist locally for reopening in the same browser/profile/origin; no file export/import, backend accounts or cloud synchronization.
- **Still open:** initial and min/max strip heights, whether adjusted height is saved with layouts, exact left-to-right order, numeric module widths/ratios, contents of three workflow presets, breakpoint thresholds, scrolling affordances, reveal/collapse details, hidden-state audio capture policy, and any alternate **in-browser** full-screen performance mode.
- **Resolved (supersedes old themes):** exactly four **Retro/WIN, EP-133, EP-40, Minimal** themes; Visuals starts with the current K.O. Tool Win-like Retro appearance when no supported device has been identified, then selects EP-133/EP-40 styling after validated device recognition. Per-module color customization remains.
- **Resolved (owner choice B):** Auto Theme enabled by default; any manual theme choice disables auto device switching **for the current Visuals session** until the user explicitly re-enables Auto Theme. Later EP connections/swaps do not override manual selection in that session.
- **Resolved (owner choice A):** EP-1320 Medieval (`TE032AS005`) maps to existing **Retro/WIN** with Auto Theme ON, while the device identity continues to read EP-1320.
- **Resolved (owner choice A):** on real EP disconnection **with Auto Theme ON**, immediately switch the visual theme to **Retro/WIN**, invalidate stale device identity, and leave Auto Theme enabled for future reconnects. With Auto Theme OFF, keep the manually selected theme unchanged.
- **Resolved (owner choice A):** closing and reopening Visuals or reloading K.O. Tool resets **theme mode to Auto Theme ON**, without restoring last session's manual theme; select from the verified device or Retro/WIN baseline.
- **Still open:** fallback for *unknown/ambiguous* identities, exact EP-133/EP-40/Minimal palette values, separate persistence of custom colors, browser storage API/schema/failure handling, overlay controls, and performance-friendly interaction details.
- Recording/export of Visuals (not currently authorized), if desired.
- Audio capture latency and performance budget, and supported platforms.

For the broader roadmap and qualitative source research see [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md). See [TESTING.md](TESTING.md) for the team's verification rules.
