import { EFFECTS } from './profile.js';

// Candidate codec only: no production probe profile is registered. Entry, identity,
// output grammar and orderly exit need exact-firmware HIL before UI integration.
// Fixed commands only; there is deliberately no public send/execute/REPL API.
export function parseLoadedPreset(text) {
  const list = [];
  let effect;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const header = /^(\d+) \[ \d+ ([A-Z]+) \]$/.exec(line);
    if (header) {
      if (Number(header[1]) !== list.length || !Object.hasOwn(EFFECTS, header[2]) || list.length >= 16) throw Error('Invalid loaded effect row');
      effect = { effect: header[2] }; list.push(effect); continue;
    }
    const field = /^([A-Za-z-]+)\s+(-?\d+(?:\.\d+)?)$/.exec(line);
    const range = field && effect && EFFECTS[effect.effect][field[1]];
    if (!range || Object.hasOwn(effect, field[1])) throw Error('Unrecognized loaded preset output');
    const value = Number(field[2]);
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) throw Error('Invalid loaded parameter');
    effect[field[1]] = value;
  }
  if (!list.length || list.some(item => Object.keys(item).length < 2)) throw Error('Incomplete loaded preset');
  return list;
}

export function createSerialTransport({ serial = globalThis.navigator?.serial, probeProfile = null, timeoutMs = 1000 } = {}) {
  let port = null, reader = null, writer = null, epoch = 0, pending = null, onLoss = () => {}, connected = false;
  const encoder = new TextEncoder();
  async function disconnect() {
    epoch++; connected = false;
    pending?.reject(Error('Serial disconnected')); pending = null;
    const oldReader = reader, oldWriter = writer, oldPort = port;
    reader = writer = port = null;
    try { await oldReader?.cancel(); } catch {}
    try { oldReader?.releaseLock(); } catch {}
    try { oldWriter?.releaseLock(); } catch {}
    try { await oldPort?.close(); } catch {}
  }
  function failed(error) {
    pending?.reject(error); pending = null;
    connected = false; void disconnect(); onLoss();
  }
  async function readLoop(ownedReader, token) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      while (token === epoch) {
        const { value, done } = await ownedReader.read();
        if (token !== epoch) return;
        if (done) throw Error('Serial stream ended');
        if (!pending) throw Error('Unsolicited serial output');
        pending.text += decoder.decode(value, { stream: true });
        if (pending.text.length > 16384) throw Error('Serial response too large');
        if (pending.text.endsWith('>>> ')) {
          const reply = pending.text.slice(0, -4).replace(/\r/g, '');
          pending.resolve(reply); pending = null;
        }
      }
    } catch (error) { if (token === epoch) failed(error); }
  }
  async function command(text) {
    if (!connected || pending) throw Error('Serial session unavailable or busy');
    const token = epoch;
    let timer;
    const response = new Promise((resolve, reject) => { pending = { resolve, reject, text: '' }; });
    // Attach handlers before awaiting the writer: the stream may fail immediately.
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Serial response timeout')), timeoutMs); });
    try {
      const [, reply] = await Promise.race([Promise.all([writer.write(encoder.encode(text + '\r\n')), response]), deadline]);
      const lines = reply.split('\n');
      if (lines[0] === text) lines.shift();
      const output = lines.join('\n').trim();
      if (/Traceback|Error|>>>/.test(output)) throw Error('Device rejected fixed command');
      return output;
    } catch (error) { if (token === epoch) failed(error); throw error; }
    finally { clearTimeout(timer); }
  }
  return {
    onDisconnect(fn) { onLoss = fn; },
    async connect() {
      if (!probeProfile?.evidenceId || probeProfile.model !== 'EP-2350' || !/^\d+\.\d+\.\d+$/.test(probeProfile.firmware)) throw Error('Serial probe requires exact-firmware acceptance');
      if (port) throw Error('Serial already connected');
      if (!serial?.requestPort) throw Error('Web Serial unavailable');
      const token = ++epoch;
      const selected = await serial.requestPort({ filters: [{ usbVendorId: 0x2367, usbProductId: 0x0620 }] });
      if (token !== epoch) throw Error('Serial selection cancelled');
      port = selected;
      try {
        await selected.open({ baudRate: 115200 });
        if (token !== epoch) { await selected.close(); throw Error('Serial connection cancelled'); }
        const info = selected.getInfo();
        if (info.usbVendorId !== 0x2367 || info.usbProductId !== 0x0620) throw Error('Not an EP-2350 serial port');
        reader = selected.readable.getReader(); writer = selected.writable.getWriter(); connected = true;
        void readLoop(reader, token);
        const machine = await command("print(__import__('sys').implementation._machine)");
        const match = /^EP-2350 (\d+\.\d+\.\d+)$/.exec(machine);
        if (!match || match[1] !== probeProfile.firmware) throw Error('Unverified serial identity');
        return { model: 'EP-2350', firmware: match[1] };
      } catch (error) { if (token === epoch) await disconnect(); throw error; }
    },
    async readState() {
      const output = await command('print(teenage.fx_pos); fx.list_loaded(teenage.fx_pos); print(teenage.fx_pos)');
      const lines = output.split('\n'), first = lines.shift(), last = lines.pop();
      if (!/^[0-3]$/.test(first) || first !== last) throw Error('Active preset changed or is unavailable');
      return { slot: Number(first), list: parseLoadedPreset(lines.join('\n')) };
    },
    async writeParameter({ slot, row, effect, param, value }) {
      const rule = probeProfile?.parameters?.[effect]?.[param];
      if (!Number.isInteger(slot) || slot < 0 || slot > 3 || !Number.isInteger(row) || row < 0 || row > 15
        || !Object.hasOwn(EFFECTS, effect) || !Object.hasOwn(EFFECTS[effect], param) || !rule || param === 'BUS'
        || !Number.isFinite(value) || value < rule.min || value > rule.max || !(rule.step > 0)
        || Math.abs((value - rule.min) / rule.step - Math.round((value - rule.min) / rule.step)) > 1e-7) throw Error('Serial parameter not allowlisted');
      // Slot stability is checked again in the same command before the only write.
      const output = await command(`print(fx.param(${slot}, ${row}, "${param}", ${value}) if teenage.fx_pos == ${slot} else False)`);
      if (output !== 'True') { const error = Error('Parameter write not acknowledged'); failed(error); throw error; }
      return true;
    },
    disconnect
  };
}
