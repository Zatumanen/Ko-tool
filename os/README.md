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

## Scope of this PR

Included:
- Navigation for Samples, Projects, Device, Sequencer, Community, Visualizers
  and Settings with accessible current-page state.
- Theme tokens and responsive Studio / Classic presentations;
  only an appearance preference is persisted locally.
- Stable header (device disconnected / unknown, no fabricated project ID),
  contextual inspector, assistant information and visualizer dock.
- Real links to existing converter / My EP and transparent coming-soon UI.
- Synthetic waveform and spectrum visualization labeled as **demo signal**;
  not calibrated measurement or device audio.
- Build-pages includes `os/`; unit and browser E2E verify main app
  survives, theme switch, navigation and device truthfulness.

Not included:
- Device runtime integration, WebMIDI access from OS, SysEx commands,
  transfers, sample import/conversion into OS, sequencer device read/write.
- Audio capture, system audio streaming, accurate loudness or
  performance-mode visualization.
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
2. Bind the header and Device workspace to authoritative device runtime
   (ZAT-17); unknown/recovery/disconnected remain fail-closed.
3. Bind Samples to the existing x2 audio pipeline, file browser and safe
   guarded transfer; no surprise overwrite or pitch change.
4. Expose validated sequence and project read data; only enable writes
   where contract + firmware evidence and user confirmation permit.
5. Add opt-in audio capture and performance visualization, then
   community sharing, permissions/licensing, and opt-in donation link.

## Local checks

`npm test`, `npm run test:e2e`, `npm run build:pages`

The protected baseline remains available at
`https://github.com/Zatumanen/Ko-tool/tree/archive/pre-os-redesign-v1`.
