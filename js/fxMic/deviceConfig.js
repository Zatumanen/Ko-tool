// Read-only device diagnostics. Do not pass firmware JSON through the strict
// offline authoring validator: saved presets can contain valid unknown fields.
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const MAX_CONFIG_BYTES = 65536;
const enc = new TextEncoder();
const nameOf = (v, max = 128) => typeof v === 'string' ? v.slice(0,max) : '';
const validKey = key => /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key);

export function summarizeDeviceConfig(text, activeSlot) {
  if (typeof text !== 'string' || text.length < 2 || enc.encode(text).byteLength > MAX_CONFIG_BYTES)
    throw Error('Device config is empty or exceeds the read-only size limit');
  if (!Number.isInteger(activeSlot) || activeSlot < -1 || activeSlot > 3)
    throw Error('Invalid device FX slot');
  let config;
  try { config = JSON.parse(text); }
  catch { throw Error('Device config contains invalid JSON'); }
  if (!record(config) || !Array.isArray(config.presets) || config.presets.length > 4)
    throw Error('Device config has no valid presets array');
  const saved = Array(4).fill(null);
  let unknownFields = 0;
  for (let index = 0; index < config.presets.length; index++) {
    const preset = config.presets[index];
    if (!record(preset)) throw Error('Invalid stored FX preset object');
    const pos = preset.pos ?? index;
    if (!Number.isInteger(pos) || pos < 0 || pos > 3 || saved[pos])
      throw Error('Invalid or duplicate stored FX preset slot');
    if (!Array.isArray(preset.list) || preset.list.length > 16)
      throw Error('Stored FX preset has invalid row count');
    const rows = preset.list.map((item, row) => {
      if (!record(item)) throw Error('Invalid stored FX effect row');
      const name = typeof item.effect === 'string' && /^[A-Z][A-Z0-9_-]{0,39}$/.test(item.effect)
        ? item.effect : 'UNKNOWN';
      if (name === 'UNKNOWN') unknownFields++;
      const effect = { effect: name };
      for (const [key, value] of Object.entries(item)) {
        if (key === 'effect') continue;
        if (validKey(key) && typeof value === 'number' && Number.isFinite(value)) {
          if (Object.keys(effect).length < 26) effect[key] = value;
          else unknownFields++;
        } else unknownFields++;
      }
      return { row, effect };
    });
    const modulation = ['handle', 'shake', 'lfo', 'trigger'].filter(key => preset[key] != null);
    const modulationValues = {};
    for (const key of modulation) {
      const entry = preset[key];
      if (!record(entry)) { unknownFields++; continue; }
      const values = {};
      for (const [field, value] of Object.entries(entry)) {
        if (!validKey(field) || Object.keys(values).length >= 24) { unknownFields++; continue; }
        if (typeof value === 'number' && Number.isFinite(value)) values[field] = value;
        else if (typeof value === 'string') values[field] = value.slice(0,128);
        else unknownFields++;
      }
      modulationValues[key] = values;
    }
    saved[pos] = {
      slot: pos,
      name: nameOf(preset.name),
      rows: rows.map(item => item.effect),
      modulation, modulationValues,
      effects: rows.map(item => item.effect.effect)
    };
  }
  const presets = saved.map((item, slot) => item
    ? { slot, name: item.name, rowCount: item.rows.length, effects: item.effects,
        rows: item.rows, modulation: item.modulation, modulationValues: item.modulationValues, present: true }
    : { slot, name: '', rowCount: 0, effects: [], rows: [], modulation: [], modulationValues: {}, present: false });
  const samples = [];
  if (Array.isArray(config.samples)) {
    for (let i = 0; i < Math.min(4, config.samples.length); i++) {
      const item = config.samples[i];
      if (!record(item)) { unknownFields++; continue; }
      const pos = item.pos ?? i;
      if (!Number.isInteger(pos) || pos < 0 || pos > 3) { unknownFields++; continue; }
      samples.push({slot:pos, file:nameOf(item.file), playmode:nameOf(item.playmode,40)});
    }
  }
  const active = activeSlot < 0 ? null : saved[activeSlot];
  return {
    source: 'stored-config',
    slot: activeSlot,
    list: active?.rows ?? [],
    presets,
    packName: nameOf(config.name),
    sampleCount: Array.isArray(config.samples) ? config.samples.length : 0,
    samples,
    hasModulation: Boolean(active?.modulation.length),
    unknownFields
  };
}
