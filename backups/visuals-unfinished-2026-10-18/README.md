# Visuals unfinished changes — recovery backup

This branch stores an exact, verified **compressed patch** from an unfinished Codex Cloud worktree. The changes are **not applied to production files in this branch**.

- Original local WIP commit (not pushed by Codex): `e6e7807871932c4d619cd3834cfd86891efa024b`
- Patch source parent: `ac8da82d73a201e6c57a46cfad1fb7bdb93e5b27` (`codex/token-efficient-workflow`)
- Patch: `visuals-unfinished.patch.gz` (6,728 bytes)
- SHA-256 of compressed file: `31f8745a27e06531b8bde79676bc8a1dfa0982775f6e112c16592d9708902935`
- SHA-256 of **decompressed** patch: `9ae3f3c019f42cb7c56c3120fefd0974825d449c4860c9e5ea89b469b8176390` (19,641 bytes)
- Source: owner-provided three-part base64/gzip data, successfully decoded and checked byte-for-byte.

The patch contains these six paths only:
```
docs/superpowers/plans/2026-10-18-visuals-regressions.md
js/visuals/app.js
js/visuals/audio.js
tests/e2e/my-ep-navigation-delete-upload-name.spec.mjs
tests/e2e/visuals.spec.mjs
tests/visuals-audio.test.mjs
```

## Recover safely

Use a **separate clean working directory** (do not overwrite the original Cloud worktree). From an appropriate checkout of Ko-tool, download this .gz file, then:

```bash
gzip -dc visuals-unfinished.patch.gz > visuals-unfinished.patch
sha256sum visuals-unfinished.patch
git apply --check visuals-unfinished.patch
git apply visuals-unfinished.patch
```

Check for current-main compatibility and review the resulting diff before tests. If `git apply --check` fails because the target code has changed, stop and reconcile manually on a dedicated feature branch; do not force, reset or overwrite.

This is a preservation artifact, **not** a verified PR, a new hardware test or proof that the patch applies unchanged to current `main`. It does not contain `node_modules`, `dist` or private EP captures.
