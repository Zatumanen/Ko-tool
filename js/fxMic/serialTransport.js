import { EFFECTS } from './profile.js';

// Manual trial codec. Production profiles require exact-firmware evidence.
// Fixed commands only; there is deliberately no public send/execute/REPL API.
export function parseLoadedPreset(text) {
  const list = [];
  let effect, modulationSection = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (/^(HANDLE|SHAKE|LFO|TRIGGER):$/.test(line)) { modulationSection = true; continue; }
    const header = /^(\d+)\s*\[\s*\d+\s+([A-Z]+)\s*\](?:\s*->\s*([12]))?$/.exec(line);
    if (header) {
      if (Number(header[1]) !== list.length || (header[2] !== 'NONE' && !Object.hasOwn(EFFECTS, header[2])) || list.length >= 16) throw Error('Invalid loaded effect row');
      effect = { effect: header[2], ...(header[3] ? { BUS: Number(header[3]) } : {}) }; modulationSection = false; list.push(effect); continue;
    }
    const field = /^([A-Za-z-]+)\s+(-?\d+(?:\.\d+)?)$/.exec(line);
    if (modulationSection && /^(row|param|depth|shape|speed|phase|target)\s+[A-Za-z0-9._+-]+$/.test(line)) continue;
    const range = field && effect && Object.hasOwn(EFFECTS[effect.effect] || {},field[1]) && EFFECTS[effect.effect][field[1]];
    if (!range || Object.hasOwn(effect, field[1])) throw Error('Unrecognized loaded preset output');
    const value = Number(field[2]);
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) throw Error('Invalid loaded parameter');
    effect[field[1]] = value;
  }
  if (!list.length || list.some(item => item.effect !== 'NONE' && !Object.keys(item).some(key => key !== 'effect' && key !== 'BUS'))) throw Error('Incomplete loaded preset');
  return list;
}

export function createSerialTransport({ serial = globalThis.navigator?.serial, probeProfile = null, timeoutMs = 1000, allowReplInterrupt = false } = {}) {
  let port = null, reader = null, writer = null, epoch = 0, pending = null, onLoss = () => {}, connected = false, initializing = false;
  const encoder = new TextEncoder();
  async function disconnect() {
    epoch++; connected = false; initializing = false;
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
    connected = false; void disconnect(); onLoss(error);
  }
  async function readLoop(ownedReader, token) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      while (token === epoch) {
        const { value, done } = await ownedReader.read();
        if (token !== epoch) return;
        if (done) throw Error('Serial stream ended');
        if (!pending) {
          // Startup messages and control echoes are expected while entering REPL.
          if (initializing) continue;
          throw Error('Unsolicited serial output');
        }
        pending.text += decoder.decode(value, { stream: true });
        if (pending.text.length > 16384) throw Error('Serial response too large');
        if (/>>>[ \t]*(?:\r?\n)?$/.test(pending.text)) {
          const reply = pending.text.replace(/>>>[ \t]*(?:\r?\n)?$/, '').replace(/\r/g, '');
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
        reader = selected.readable.getReader(); writer = selected.writable.getWriter(); connected = true; initializing = true;
        void readLoop(reader, token);
        if (allowReplInterrupt) {
          // Explicit user opt-in: Ctrl+C interrupts the device's running program.
          const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
          await sleep(100);
          await writer.write(encoder.encode('\x03'));
          await sleep(300);
          await writer.write(encoder.encode('\x03'));
          await sleep(200);
          await writer.write(encoder.encode('\r\n'));
          await sleep(300);
        }
        const greeting = probeProfile.manualTrial ? await command('') : '';
        if (!allowReplInterrupt && greeting !== '') throw Error('REPL is not clean; enable explicit REPL preparation or disconnect');
        const runtime = await command("print(__import__('sys').implementation.name)");
        if (runtime !== 'micropython') throw Error('Stock MicroPython required; CircuitPython is a different firmware');
        const machine = await command("print(getattr(__import__('sys').implementation, '_machine', 'unknown'))");
        // USB ID and stock-only imports establish the device family. The selected
        // firmware is not verified unless an exact version is reported by REPL.
        const match = /^EP-2350\s+(\d+\.\d+\.\d+)$/.exec(machine);
        if (match && match[1] !== probeProfile.firmware) throw Error('Firmware mismatch: device '+match[1]+', selected '+probeProfile.firmware);
        const imported = await command('import fx, teenage');
        if (imported !== '') throw Error('Cannot access stock FX-MIC modules');
        return { model: 'EP-2350', firmware: probeProfile.firmware,
          firmwareVerified: Boolean(match), board: machine.replace(/[^\x20-\x7e]/g,' ').slice(0,120) };
      } catch (error) { if (token === epoch) await disconnect(); throw error; }
    },
    async readState() {
      const output = await command('print(teenage.fx_pos); fx.list_loaded(teenage.fx_pos); print(teenage.fx_pos)');
      const lines = output.split('\n'), first = lines.shift(), last = lines.pop();
      if (!/^[0-3]$/.test(first) || first !== last) throw Error('Active preset changed or is unavailable');
      const rawChain = lines.join('\n');
      const loaded = { slot: Number(first), list: parseLoadedPreset(rawChain),
        hasModulation: /^(HANDLE|SHAKE|LFO|TRIGGER):$/m.test(rawChain) };
      initializing = false;
      return loaded;
    },
    async writeParameter({ slot, row, effect, param, value }) {
      const rule = probeProfile?.parameters?.[effect]?.[param];
      if (!Number.isInteger(slot) || slot < 0 || slot > 3 || !Number.isInteger(row) || row < 0 || row > 15
        || !Object.hasOwn(EFFECTS, effect) || !Object.hasOwn(EFFECTS[effect], param) || !rule || param === 'BUS'
        || !Number.isFinite(value) || value < rule.min || value > rule.max || !(rule.step > 0)
        || Math.abs((value - rule.min) / rule.step - Math.round((value - rule.min) / rule.step)) > 1e-7) throw Error('Serial parameter not allowlisted');
      // Slot stability is checked again in the same command before the only write.
      const output = await command(`print(fx.param(${slot}, ${row}, "${param}", ${value}) if teenage.fx_pos == ${slot} else False)`);
      if (output !== 'True' && !(probeProfile.manualTrial && output === 'None')) { const error = Error('Parameter write not acknowledged'); failed(error); throw error; }
      return true;
    },
    disconnect
  };
}
