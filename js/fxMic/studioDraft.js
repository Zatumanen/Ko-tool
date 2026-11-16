import { assertConfig } from './config.js';

// Builds a LOCAL, editable draft only. Never uploads, selects an FX slot or
// turns read-only device observations into physical write permissions.
export function createOfflineDraftFromSavedConfig(state) {
  if (state?.source !== 'stored-config' || !Array.isArray(state.presets) || state.presets.length !== 4)
    throw Error('A complete saved device configuration is required');
  if (state.unknownFields)
    throw Error('Some device fields are not supported by the editor; keep the original config.json as the authoritative backup');
  if (state.sampleCount || state.samples?.length)
    throw Error('Custom device WAVs are not available over this read-only import; import a complete ZIP with the WAV files instead');
  const presets = [];
  for (const [pos, slot] of state.presets.entries()) {
    if (!slot || slot.slot !== pos) throw Error('Invalid saved FX slot order');
    if (!slot.present) continue;
    if (!Array.isArray(slot.rows) || !slot.rows.length || slot.rows.length > 16)
      throw Error('Empty or invalid saved FX rows cannot be silently changed during conversion');
    const preset = {
      pos, name: slot.name || 'PRESET ' + (pos + 1),
      list: structuredClone(slot.rows)
    };
    if (slot.comment) preset.comment = slot.comment;
    for (const key of ['handle', 'shake', 'lfo', 'trigger']) {
      if (slot.modulation?.includes(key)) {
        if (!slot.modulationValues?.[key])
          throw Error('Missing saved ' + key + ' details');
        preset[key] = structuredClone(slot.modulationValues[key]);
      }
    }
    presets.push(preset);
  }
  const config = { name: state.packName || 'FX-MIC LOCAL DRAFT', presets };
  assertConfig(config);
  return { config, files: new Map() };
}
