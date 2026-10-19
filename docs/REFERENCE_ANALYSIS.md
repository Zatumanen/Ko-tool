# Reference artifact intake and evidence protocol

Goal: understand reference application behavior and file/protocol contracts well enough to implement **independent** Ko-tool compatibility. This is not a license to copy proprietary source, icons, binaries or trademarks.

Current owner-supplied materials and comparison: [Reference sources](REFERENCE_SOURCES.md). The official EP Sample Tool is the owner's primary technical reference; raw artifacts are retained outside Git with SHA-256 manifests.

## Input inventory

For each user-supplied input record:
- Identifier, origin, usage permission, platform and version/date.
- Exact type: extracted JS directory, Electron ASAR, web bundle/sourcemap, WAV/project archive, WASM, Mach-O/PE, Android APK, firmware dump, HAR/SAZ or packet/USB capture.
- SHA-256 and byte size, capture conditions, device SKU/firmware where relevant.
- Whether personal/device/private data is present, and where the unmodified original is held.

Do not publish raw originals in the public GitHub repository. Use a read-only copy in isolated scratch storage. Redact serials, identifiers, tokens, private audio and user information from all reports. Do not execute untrusted programs or alter connected hardware.

## Workflow

1. Define one behavior question, e.g. how a WAV metadata marker is interpreted, how project references are resolved, or how FILE responses are validated.
2. Inventory the target, then run the least invasive static analysis. Only invoke REA if the artifact type warrants it. For JS, inspect modules/imports and source-map provenance; for binary/native analysis, note missing Ghidra/Hopper/IDA or other prerequisites instead of inventing pseudocode.
3. Separate observations from hypotheses, unknown data and claims about physical behavior. Keep exact file path, offset or anonymized packet reference for every relevant observation.
4. Write a sanitized matrix contrasting reference evidence with Ko-tool implementation and existing tests.
5. Propose the smallest independent change and appropriate regression fixtures. Use synthetic fixtures only as synthetic; require explicit owner permission and backed-up expendable hardware for EP writes/HIL.
6. Retain raw evidence privately. Publish only a short sanitized technical summary after permission; never auto-open an issue or commit third-party material.

## Report form

- Target / version / integrity hash:
- Research question:
- Evidence (path/offset/trace and observation):
- Confidence, gaps and alternative explanations:
- Ko-tool modules / existing contract:
- Safe verification plan:
- Requires physical EP HIL? Approved separately:
- Provenance and publication restrictions:
