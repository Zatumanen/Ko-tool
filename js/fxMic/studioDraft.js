import { assertConfig } from './config.js';

// A saved EP-2350 configuration can become a LOCAL draft only when the complete
// device JSON is available and valid for the offline authoring schema.
// Do not rebuild it from the diagnostic summary: that would drop unknown fields,
// optional parameters or long comments without the user's knowledge.
export function createOfflineDraftFromSavedConfig(state) {
  if (state?.source !== 'stored-config' || !Array.isArray(state.presets) || state.presets.length !== 4 ||
      typeof state.rawConfigText !== 'string' || state.rawConfigText.length < 2)
    throw Error('Complete read-only device JSON is required to create a local draft');
  if (state.unknownFields)
    throw Error('Some device fields are not supported by the editor; save the original config.json instead');
  if (state.sampleCount || state.samples?.length)
    throw Error('Custom device WAVs are not available over this read-only import; import a complete ZIP with the WAV files instead');
  let config;
  try { config = JSON.parse(state.rawConfigText); }
  catch { throw Error('Stored device config JSON is invalid'); }
  // Reject every nonempty saved slot that became empty or disappeared in the
  // authoring data, rather than silently changing the user's hardware preset.
  for (const slot of state.presets) {
    if (!slot || !Number.isInteger(slot.slot) || slot.slot < 0 || slot.slot > 3)
      throw Error('Invalid saved FX slot order');
    if (slot.present && slot.rowCount === 0)
      throw Error('Empty saved FX rows cannot be silently changed during conversion');
  }
  // Strict validation protects exact casing, extra fields, 16-row limits,
  // modulation references and singleton effects. It never mutates input.
  assertConfig(config);
  if (config.samples?.length)throw Error('Missing WAV bytes prevent an editable offline draft');
  return { config: structuredClone(config), files: new Map() };
}
