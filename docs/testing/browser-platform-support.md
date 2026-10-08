# SpeedUppercut browser and platform support policy (ZAT-15)

## Product areas and testing status

| Feature | Supported / tested policy | Other browsers and devices |
| --- | --- | --- |
| Audio conversion: files, x2 resample, WAV | Desktop Chromium is the CI-tested baseline. Requires Web Audio, File input, and the bundled WebAssembly reference encoder/resampler. | Best effort on other modern browsers. No guarantee of codec parity or working WASM on every device. A missing Web Audio API produces an explicit warning. |
| MY EP: live USB sample and project management | Desktop Chromium-based Chrome or Edge, secure page, Web MIDI with SysEx permission and a compatible EP on USB. CI simulates MIDI in desktop Chromium; **real USB verification is separate**. | Not a supported hardware-management workflow on mobile. Browsers without the Web MIDI/SysEx API, or pages where MIDI is blocked, are rejected before device access. |
| Select files | Standard browser file input. | Normal file selection remains available when advanced file and directory APIs are absent. |
| Select folder | Requires the HTMLInputElement.webkitdirectory property. Feature-detected at startup. | Button disabled with a message; users can use **Select Files** instead. |
| Save/download | showSaveFilePicker when available in secure contexts. | Fallback to a user-initiated browser download via an anchor download link. Browser settings determine where the file goes. |

The automated browser E2E matrix currently uses **Chromium on the CI host**.
This policy does not assert that real EP USB hardware has been tested on
every Windows, macOS or Linux version. Chrome/Edge is the recommended desktop
browser family, not a promise about every host's MIDI drivers, USB adapters
or permissions.

## My EP preflight (before requesting MIDI permissions)

The shared module js/platformSupport.js detects runtime browser features:

1. Mobile / iPadOS (including iPad desktop-user-agent mode): MY EP is
   disabled with a desktop recommendation, while the audio converter remains
   usable when its required features exist.
2. Insecure origin: MY EP requires HTTPS or a trustworthy localhost page.
   Never bypass this through a desktop-only user-agent check.
3. No navigator.requestMIDIAccess: explain that Web MIDI **with SysEx**
   is required and recommend desktop Chrome/Edge.
4. Explicit browser Permissions Policy denial of MIDI: explain that the
   page policy prevents access, and recommend opening the secure site
   directly rather than embedded in a restricted frame.
5. Supported preflight: MY EP can open; connection requests
   requestMIDIAccess({sysex:true}). SysEx permission is not assumed:
   NotAllowedError / SecurityError receives a specific **allow MIDI and
   SysEx, then reload** message. Missing USB device ports, incompatible SKU,
   disconnected devices and permission rejection remain distinct conditions.

Preflight **does not request** MIDI permissions and **does not** treat a
supported browser as proof a device exists. No FILE mutation is available
without a connected device and the existing hardware/firmware evidence guards.

## Converter and file-system fallbacks

- A page lacking showSaveFilePicker still exports an ordinary browser
  download (the existing saveBlob path); the UI explains this on startup.
- If folder selection is unsupported, the user receives a non-blocking
  notice and a **Select Files** alternative; regular multi-file conversion
  still runs through processAudioInputs.
- Without Web Audio the converter is not supported: communicate the missing
  capability before processing. Browsers may decode compressed formats
  differently even when they implement decodeAudioData.
- Missing Web MIDI never disables the standalone converter.
- A Web MIDI/SysEx permission error is a platform/permission problem, not a
  sample protocol fault; do not reset or mark the EP unsafe merely for this.
- On mobile, MY EP remains disabled. File conversion is best effort, subject
  to available memory, WebAssembly, codec support, file picking and downloads.

## Automated coverage and its limits

- tests/platform-support.test.mjs tests capability detection and error
  messaging for secure/insecure, mobile/desktop/iPadOS, Web MIDI, Web Audio,
  Permissions Policy, optional save picker and directory selection.
- tests/e2e/platform-support.spec.mjs exercises browser UX: early
  missing-WebMIDI rejection, insecure origin guard, denied SysEx permission,
  mobile guidance and real WAV download without showSaveFilePicker.
- Existing My EP E2E uses a **fake** SysEx device in Chromium to cover the
  supported product flow; it does **not** prove device/OS/driver compatibility.
- Test command: npm test, npm run test:e2e, npm run build:pages.
- The supported CI browser policy is in playwright.config.mjs
  (browserName: chromium). Cross-browser validation is a separate
  investigation before expanding official support claims.

## External browser capability references

- MDN [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API):
  limited availability, secure-context restrictions and MIDI security.
- MDN [showSaveFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker):
  limited availability and user activation requirements.
- MDN [webkitdirectory](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory):
  directory input feature and relative file paths.

Browser-compatibility tables can evolve independently of application code.
Always check runtime capabilities rather than relying only on a claimed
browser name or a hardcoded minimum browser version.
