# Official PAK/PPAK: read-only offline staging (ZAT-92)

Baseline: `main@99db06597847e6001c84dbcaa71426876206a0b5`.
Source: `js/ep133/officialPakReader.js`, `officialPakPreviewPlan.js`, `officialPakRestoreStaging.js`, `ui/backupRestoreController.js`.
The official TE EP Sample Tool bundle is a behavioral reference only. No reference source code was copied.

## Behavior

In My EP → Backup / Restore, select an official `.pak` or `.ppak` for inspection. The browser validates the ZIP, WAV and project TAR manifest, then independently re-reads archive members and checks sample PCM length/CRC32 and project TAR length/CRC32. The visible report exposes aggregate byte counts and all remaining blockers. Detached PCM/TAR staging data are **not** promoted to a restore plan, retained for UI actions, exported to a device, or passed through FILE PUT/DELETE/SET.

The report distinguishes archive integrity from restore eligibility:
- Identity match is archival metadata only, never device permission.
- Slots shown free/occupied in the UI are not authoritative FILE inventory/readback.
- Missing sample pad references, unknown WAV chunks, free-space limits, active projects, collisions, remapping, SKU/firmware rights and recovery are potential blockers.
- `canRestore:false`, `writeAuthorized:false` and `requiresHardwareReadback:true` remain mandatory for every staged archive, even when all archive CRCs match.
- Official Restore stays disabled. No physical device write, project mutation, firmware update, USB interruption or HIL was performed in this change.

## Evidence and follow-up

Unit: `tests/official-pak-restore-staging.test.mjs`, `tests/official-pak-restore-staging-integration.test.mjs`, `tests/official-pak-preview-plan.test.mjs`.
Browser fake EP: `tests/e2e/backup-dialog-progress.spec.mjs` asserts that the staging report is visible and all FILE write commands remain absent.

This only completes a safe offline UI integration step toward ZAT-92. Any future device Restore requires model/firmware-scoped physical test permissions, authoritative FILE inventory and readback, full backup/checkpoint, protected inactive target, collision/remap planning, strict transaction/journal and explicit hardware-write activation authorization. All physical acceptance is deferred by the owner.
