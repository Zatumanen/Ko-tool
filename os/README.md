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
- `OPEN MY EP` uses the explicit `/index.html#my-ep` deep link; this
  triggers the *existing* device preflight with all permissions and safety
  gates intact. It does not auto-connect on normal legacy startup.

## ZAT-17: live runtime status (passive, cross-tab)

When opening My EP in a **second, same-origin tab**, the original
`js/ep133/deviceRuntime.js` publishes a *read-only projection* through
`BroadcastChannel('speeduppercut-os-device-status-v1')`.

- The OS never acquires the EP device lock, requests MIDI or sends FILE/SysEx.
  Hardware actions remain solely inside the original My EP tab.
- The OS header and Device diagnostics are always accessible and display
  the current model and firmware **only after verified connection**. They
  also reflect connecting, ready, reading, mutating, verifying, blocked,
  recovery-required and unsafe. Project/bank/group are left unknown.
- No device key, serial number, recovery transaction ID or raw MIDI bytes
  are transmitted or persisted. The payload is deliberately limited to
  product status fields, operation label and safety reason.
- Each publisher periodically refreshes; after 6.5 seconds without a
  heartbeat, stale status is discarded. An explicit tab close removes
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
- Persistent read-only live device runtime header and diagnostics from the trusted My EP tab (unknown until actively verified),
  contextual inspector, assistant information and visualizer dock.
- Real links to existing converter / My EP and transparent coming-soon UI.
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
   integrated across same-origin tabs. Future work can integrate hardware
   UI in one runtime without duplicating ownership; unknown/recovery/
   disconnected remain fail-closed.
3. **Started:** Samples now uses the existing x2 reference processing pipeline
   for local WAV conversion. Next integrate the device file browser and safe
   guarded transfer; no surprise overwrite or pitch change.
4. Expose validated sequence and project read data; only enable writes
   where contract + firmware evidence and user confirmation permit.
5. Add opt-in audio capture and performance visualization, then
   community sharing, permissions/licensing, and opt-in donation link.

## Local checks

`npm test`, `npm run test:e2e`, `npm run build:pages`

The protected baseline remains available at
`https://github.com/Zatumanen/Ko-tool/tree/archive/pre-os-redesign-v1`.
