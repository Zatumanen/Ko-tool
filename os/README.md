# Speeduppercut OS — experimental UI shell

The first **ZAT-16** slice is isolated under `/os/` in branch
`feature/speeduppercut-os-v1`. The existing Win95 converter and My EP
remain available without functional changes to hardware operations.

## Open the two interfaces

- Legacy app: `/index.html` — existing conversion, audio preview, waveform,
  sample/device tools, project editor, backups, safe transactions and
  authorized firmware support.
- New UI: `/os/index.html` — redesigned navigation, Studio and Classic
  themes and clearly labeled **synthetic** visualizer demo.
- Use the `OS Preview` desktop icon in the existing UI to switch.
- Use `ORIGINAL APP` at the top of the new shell to return.
- The OS Device Workspace **embeds** the original My EP under
  `/index.html?os-embed=1` within a **persistent same-origin iframe**.
  No second browser tab is required. It is not a new transfer implementation.
  The iframe is created on first opening Device and retained across views.
  Press **OPEN MY EP / CONNECT** inside the iframe to initiate the normal,
  explicit legacy connection flow; iframe loading does not request WebMIDI.
- Embedded My EP retains its real sample browser, project tools, confirmed
  write authorizations and backup/recovery UI. OS navigation is blocked
  during reading/mutating/verifying operations to avoid hiding critical work.
  Device recovery and unsafe states remain visible in the top status bar.
- `index.html` without `?os-embed=1` preserves its normal Win95 UI.
  A standalone legacy deep link remains possible, but it is no longer
  required for the OS interface.

## Design system slice: My EP in Studio / Classic

The embedded My EP now uses the OS visual language while **keeping every
existing DOM ID, handler, project-format validation, transaction journal and
write confirmation**:

- `css/os-my-ep-skin.css` is scoped under `html.os-embedded` and cannot
  restyle the default Win95 desktop. It skins the verified device header,
  storage meter, MIDI activity, group selectors, search, sample rows, the
  projects sidebar/inspector, operation progress and existing dialogs.
- `Studio` is graphite with muted industrial typography and a restrained
  orange highlight. `Classic` uses an off-white device surface with
  stronger Win95-inspired blue titlebars. Both share responsive geometry.
- `os/deviceDock.js` synchronizes **only** the `data-os-theme` presentation
  attribute on the same-origin iframe; never sends commands or alters its
  runtime. In a different-origin context it fails closed without DOM access.
- The embedded `index.html` also reads the saved local appearance
  preference on its own initial load to avoid a flash of the wrong theme.
- Data-dependent UI (selected rows, disabled commands, read-only project
  flags, real progress, unsafe state and recovery dialogs) continues to
  come from the original My EP controller. No generated fake slot names or
  substitute hardware status appear.
- A real user activation remains mandatory for MIDI. Changing theme does
  not reload the frame, reopen a MIDI connection or abandon a transaction.
- Browser E2E covers device connection, tab/row selection, project and
  backup dialogs, Studio/Classic toggles, session continuity and unchanged
  legacy appearance. Physical WebMIDI permission UX on actual KO II
  still requires device-in-the-loop review before merging.

This is a **visual-system integration**, not a rewrite of the original
project browser, sample transfer or sequencer workflows.

## ZAT-17: live runtime status (passive, same-origin)

When activating My EP **inside the embedded iframe** (or in a separate tab), the original
`js/ep133/deviceRuntime.js` publishes a *read-only projection* through
`BroadcastChannel('speeduppercut-os-device-status-v1')`.

- The outer OS shell never acquires the EP device lock, requests MIDI or sends FILE/SysEx.
  Hardware actions remain solely inside the original My EP runtime, whether embedded or standalone.
- The OS header and Device diagnostics are always accessible and display
  the current model and firmware **only after verified connection**. They
  also reflect connecting, ready, reading, mutating, verifying, blocked,
  recovery-required and unsafe. Project/bank/group are left unknown.
- No device key, serial number, recovery transaction ID or raw MIDI bytes
  are transmitted or persisted. The payload is deliberately limited to
  product status fields, operation label and safety reason.
- Each publisher periodically refreshes; after 6.5 seconds without a
  heartbeat, stale status is discarded. An explicit source page close removes
  the publisher immediately.
- A second disconnected publisher must not override a valid owned session;
  a recovery-required/unsafe publisher remains prominent.
- Clicking the status opens in-app read-only diagnostics with a link to My EP.
  If cross-tab channels are unsupported, the display stays **unavailable**.
- A live status does not prove that the device is safe to mutate from the
  OS shell. File-writing and recovery confirmations remain in My EP.
- Browser automation exercises the existing fake-EP session in one tab
  and the OS receiver in another. Physical USB + firmware verification is
  a separate HIL requirement.

## Scope of this PR

Included:
- Navigation for Samples, Projects, Device, Sequencer, Community, Visualizers
  and Settings with accessible current-page state.
- A real local Sample Laboratory: import files, prepare EP-ready WAV using
  production `processAudioInputs` and its reference x2 engine, inspect actual
  decoded waveform/format/storage estimates, preview and download WAV.
  Output includes the pipeline's −12 pitch metadata. No direct hardware write
  is made; device playback settings must still be verified.
- Browser-local Web Audio playback feeds actual analyzer data into the
  visualizer dock while playing. Demo mode is otherwise explicitly labeled.
- Self-hosted vector skyline illustration and detailed responsive sample
  editor. No CDN image dependency.
- Theme tokens and responsive Studio / Classic presentations;
  only an appearance preference is persisted locally.
- Persistent read-only live device runtime header and diagnostics from the trusted My EP iframe/tab (unknown until actively verified),
  contextual inspector, assistant information and visualizer dock.
- Real links to the existing converter and an embedded, persistent original My EP runtime, plus transparent coming-soon UI.
- Synthetic waveform and spectrum visualization labeled as **demo signal**;
  not calibrated measurement or device audio.
- Build-pages includes `os/`; unit and browser E2E verify main app
  survives, theme switch, navigation and device truthfulness.

Not included:
- Direct device runtime mutation, WebMIDI access from OS, SysEx commands,
  direct OS transfers, sequencer device read/write.
- Audio input/system capture, accurate loudness or
  performance-mode visualization. The meter responds to local WAV playback
  but not to the EP hardware output.
- Hosted community, registration, paid memberships or donations.
- Changing any firmware/device capability or transaction authority.

**Never promote UI placeholders to confirmed device data.** In particular,
the project, bank, group, storage and MIDI connection text stay unknown
unless a future integration supplies live authoritative evidence.

## Rollback / checkpoints

Before work, both GitHub branches were created from the exact stable
`main` commit `6d370fcfba82ef4ebd6bb4ccd184b42eb8b54c56`:

- `archive/pre-os-redesign-v1`: manually retained baseline checkpoint.
- `feature/speeduppercut-os-v1`: isolated experimental changes.

The backup is a **branch checkpoint**, not a Git tag (tag creation was
not available through the connected GitHub actions in this session).

No force-push or main-branch history rewrite is required for a rollback.
Until this branch is merged, production stays exactly as before.
If a future merge causes regressions, prefer reverting the merge PR
after checking dependencies rather than resetting shared branch history.

## Next integration PRs (after review)

1. Refine layout and real Design System v1 tokens/components against the
   standalone visual prototype. Add responsive screenshots and accessibility
   audits; do not yet move sample or project state.
2. **ZAT-17 underway:** Header and Device read-only runtime telemetry is
   integrated through the persistent same-origin My EP iframe.
   It reuses the original runtime without duplicating device ownership; unknown/recovery/
   disconnected remain fail-closed.
3. **Started:** Samples now uses the existing x2 reference processing pipeline
   for local WAV conversion. Original My EP device browser and guarded transfer are now embedded under Device;
   next is native component integration, no surprise overwrite or pitch change.
4. Expose validated sequence and project read data; only enable writes
   where contract + firmware evidence and user confirmation permit.
5. Add opt-in audio capture and performance visualization, then
   community sharing, permissions/licensing, and opt-in donation link.

## Local checks

`npm test`, `npm run test:e2e`, `npm run build:pages`

The protected baseline remains available at
`https://github.com/Zatumanen/Ko-tool/tree/archive/pre-os-redesign-v1`.


## Offline Sample Shelf (ZAT-26; browser-local first slice)

The Samples workspace now provides an original-file library, distinct from
the temporary *processed WAV queue* and from the physical EP sample memory:

- **ADD FILES** or **ADD FOLDER** (Chromium directory picker) imports actual
  original audio bytes into local IndexedDB. Nested directory paths are
  descriptive metadata; they are not written to the user's filesystem.
- Supported import extensions: WAV/WAVE, MP3, AIF/AIFF, FLAC, OGG/OGA,
  M4A, AAC. Empty files and files larger than **96 MiB each** are rejected.
  A recognized extension does not guarantee that the current browser can
  decode it; an unsupported codec is reported at preview or conversion.
- A SHA-256 digest identifies duplicate **audio contents** even when names
  differ. The first imported name/path is retained. Imported records include
  source identity, path, size and import date. Verified duration is saved
  only when the browser actually reads media metadata.
- Search matches filename or folder; **PLAY** auditions the original
  audio without a device; **PREPARE** hands its stored Blob back to the
  existing canonical x2 conversion engine with the current quality/channel
  controls. It does not upload to the EP.
- **REMOVE** deletes one local source; **CLEAR LIBRARY** asks for explicit
  confirmation before deleting all local sources. Files remain available
  between page reloads so long as the browser retains this site's IndexedDB.
  Clearing site data, private browsing eviction, or storage pressure can
  delete them. **This is not a cloud backup.**
- The display differentiates total original sample bytes from the
  *whole site's* browser storage usage/quota when the browser reports it.
  Storage quota is advisory; quota errors leave already committed imports
  untouched. **CANCEL IMPORT** stops between file operations, retaining
  only fully stored entries; no partial IndexedDB record is committed.
- Unsupported browsers without IndexedDB or a secure-context SubtleCrypto
  SHA-256 show an actionable shelf-storage error while the original
  converter continues to work. No new WebMIDI, SysEx, FILE or project
  write APIs have been introduced.
- E2E with a real Chromium IndexedDB tests persistence after reload,
  SHA-256 deduplication, nested folder metadata, unsafe filenames, deletion,
  cancellation, browser quota display and reprocessing through Space Saver.
  Browser automation still does not certify hardware behavior.

Remaining ZAT-26 follow-ups: improve quota-pressure recovery/large-library
performance and integration contract with the future 12-pad Kit Builder.
