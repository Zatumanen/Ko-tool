import { assertConfig } from './config.js';
import { resolveLiveProfile } from './profile.js';

// All operations own an epoch. Ambiguous failures invalidate the entire queue.
// No retry, automatic restoration or structural write is available here.
export function createLiveSession({ transport, resolveProfile = resolveLiveProfile, timeoutMs = 1500, verifyBeforeWrite = false, onChange = () => {} }) {
  let epoch = 0, state = 'disconnected', identity = null, profile = null, current = null;
  let queue = Promise.resolve(), cancel = null;
  const snapshot = () => structuredClone({ state, identity, current });
  const check = token => { if (token !== epoch) throw Error('Live session lost'); };
  const release = () => Promise.resolve().then(() => transport.disconnect()).catch(() => {});
  function invalidate(next, reason = Error('Live session lost')) {
    epoch++; state = next; current = null; profile = null;
    cancel?.(reason); cancel = null;
  }
  transport.onDisconnect?.(reason => { invalidate('disconnected', reason ?? Error('Serial disconnected')); void release(); onChange(); });
  function validateState(value) {
    if (value?.source === 'stored-config') {
      // Diagnostic data is untrusted firmware JSON, never a write authority.
      // It may contain unknown effects/parameters or no selected FX slot.
      if (!Number.isInteger(value.slot) || value.slot < -1 || value.slot > 3 ||
          !Array.isArray(value.list) || value.list.length > 16 ||
          !Array.isArray(value.presets) || value.presets.length !== 4)
        throw Error('Invalid read-only device config summary');
      return structuredClone(value);
    }
    if (!value || !Number.isInteger(value.slot) || value.slot < 0 || value.slot > 3) throw Error('Invalid active preset');
    if (!Array.isArray(value.list) || value.list.length < 1 || value.list.length > 16) throw Error('Invalid active effect rows');
    for (const item of value.list) {
      if (item?.effect === 'NONE' && Object.keys(item).some(key => key !== 'effect')) throw Error('Invalid NONE effect row');
    }
    // Firmware may pad live chains with NONE rows not present in editable configs.
    const effects = value.list.filter(item => item?.effect !== 'NONE');
    if (effects.length) assertConfig({ presets: [{ list: effects }] });
    return structuredClone(value);
  }
  async function bounded(token, action) {
    let timer;
    try {
      const cancelled = new Promise((_, reject) => {
        cancel = reject;
        timer = setTimeout(() => reject(Error('Live operation timeout')), timeoutMs);
      });
      const result = await Promise.race([Promise.resolve().then(action), cancelled]);
      check(token);
      return result;
    } catch (error) {
      if (token === epoch) { invalidate('unsafe'); void release(); }
      throw error;
    } finally { clearTimeout(timer); if (token === epoch) cancel = null; }
  }
  return {
    snapshot,
    async connect() {
      if (state !== 'disconnected') throw Error('Disconnect before starting a new Live session');
      const token = ++epoch; state = 'connecting';
      return bounded(token, async () => {
        const found = await transport.connect(); check(token);
        const selected = resolveProfile(found);
        if (!selected?.evidenceId || selected.model !== found.model || selected.firmware !== found.firmware) throw Error('No exact-firmware Live evidence');
        identity = structuredClone(found); profile = structuredClone(selected);
        const loaded = await transport.readState(); check(token);
        current = validateState(loaded); state = 'ready'; return snapshot();
      });
    },
    setParameter(update, { beforeSend } = {}) {
      const token = epoch, requested = structuredClone(update);
      const operation = queue.then(async () => {
        check(token);
        if (!['ready', 'verified'].includes(state)) throw Error('Live session is not writable');
        const { row, param, value } = requested, effect = current.list[row]?.effect;
        const rule = profile.parameters?.[effect]?.[param];
        if (!Number.isInteger(row) || row < 0 || !rule || param === 'BUS' || !Object.hasOwn(current.list[row], param)
          || !Number.isFinite(value) || value < rule.min || value > rule.max || !(rule.step > 0)
          || Math.abs((value - rule.min) / rule.step - Math.round((value - rule.min) / rule.step)) > 1e-7) throw Error('Parameter is outside the evidenced Live allowlist');
        const before = structuredClone(current); state = 'writing';
        return bounded(token, async () => {
          if (verifyBeforeWrite) {
            const live = validateState(await transport.readState()); check(token);
            if (JSON.stringify(live) !== JSON.stringify(before)) throw Error('Active preset changed; no parameter was sent');
          }
          beforeSend?.();
          const ack = await transport.writeParameter({ slot: before.slot, row, param, value, effect }); check(token);
          if (ack !== true) throw Error('Live write not acknowledged');
          const loaded = await transport.readState(); check(token);
          const after = validateState(loaded);
          if (after.slot !== before.slot || after.list.length !== before.list.length
            || after.list.some((item, i) => item.effect !== before.list[i].effect)
            || typeof after.list[row][param] !== 'number' || Math.abs(after.list[row][param] - value) > 1e-7) throw Error('Live readback mismatch');
          current = after; state = 'verified'; return structuredClone(after);
        });
      });
      queue = operation.catch(() => {});
      return operation;
    },
    async disconnect() { invalidate('disconnected'); identity = null; await release(); }
  };
}
