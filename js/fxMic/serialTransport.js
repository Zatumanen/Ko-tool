import { EFFECTS } from './profile.js';
import { summarizeDeviceConfig } from './deviceConfig.js';

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
  let port = null, reader = null, writer = null, epoch = 0, pending = null, onLoss = () => {}, connected = false, initializing = false, lastCommandAt = 0;
  const encoder = new TextEncoder();
  async function disconnect() {
    epoch++; connected = false; initializing = false; lastCommandAt = 0;
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
  async function command(text, stage = 'serial command', deadlineMs = timeoutMs) {
    if (!connected || pending) throw Error('Serial session unavailable or busy');
    const token = epoch;
    // The working stock reference spaces REPL commands to avoid flooding.
    const wait = 50 - (Date.now() - lastCommandAt);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    if (token !== epoch || !connected || pending) throw Error('Serial session changed before command');
    lastCommandAt = Date.now();
    let timer;
    const response = new Promise((resolve, reject) => { pending = { resolve, reject, text: '' }; });
    // Attach handlers before awaiting the writer: the stream may fail immediately.
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Serial response timeout')), deadlineMs); });
    try {
      const [, reply] = await Promise.race([Promise.all([writer.write(encoder.encode(text + '\r\n')), response]), deadline]);
      const lines = reply.split('\n');
      if (lines[0] === text) lines.shift();
      const output = lines.join('\n').trim();
      // A JSON string or preset name may legitimately contain "Error" or ">>>".
      // Only an actual Python exception line is a command failure.
      const exception = /(?:^|\n)([A-Za-z_]\w*(?:Error|Exception))\s*:/.exec(output)?.[1];
      if (/^Traceback \(most recent call last\):/.test(output) || exception) {
        // Report a fixed diagnostic stage and Python exception type, never raw
        // device output (which could contain private files or user data).
        throw Error('FX-MIC '+stage+': '+(exception||'Python exception'));
      }
      return output;
    } catch (error) { if (token === epoch) failed(error); throw error; }
    finally { clearTimeout(timer); }
  }
  async function readStoredConfig() {
    // Read only /fat/config.json. These fixed REPL assignments are volatile
    // variables, not filesystem writes. Chunks bound serial output and preserve
    // whitespace and Unicode via JSON-encoded string fragments.
    await command('import json', 'JSON module import');
    await command('_ko_file = open("/fat/config.json", "r")', 'open stored config');
    await command('_ko_data = json.load(_ko_file)', 'parse stored config', 5000);
    await command('_ko_file.close()', 'close stored config');
    await command('_ko_json = json.dumps(_ko_data)', 'encode stored config', 5000);
    await command('del _ko_data, _ko_file', 'release config variables');
    const count = Number(await command('print(len(_ko_json))', 'stored config length'));
    if (!Number.isSafeInteger(count) || count < 2 || count > 65536)
      throw Error('Device config size is outside the read-only 64 KiB limit');
    let text = '';
    for (let start = 0; start < count; start += 512) {
      const reply = await command(
        'print(json.dumps(_ko_json[' + start + ':' + Math.min(count, start + 512) + ']).replace(\">\", chr(92)+\"u003e\"))',
        'stored config chunk ' + (Math.floor(start / 512) + 1), 2000);
      let chunk;
      try { chunk = JSON.parse(reply); }
      catch { throw Error('Invalid JSON-encoded device config chunk'); }
      if (typeof chunk !== 'string' || [...chunk].length !== Math.min(512, count - start))
        throw Error('Truncated or invalid device config chunk');
      text += chunk;
    }
    await command('del _ko_json', 'release stored config buffer');
    return text;
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
        const greeting = probeProfile.manualTrial ? await command('', 'REPL readiness') : '';
        if (!allowReplInterrupt && greeting !== '') throw Error('REPL is not clean; enable explicit REPL preparation or disconnect');
        const runtime = await command("print(__import__('sys').implementation.name)", 'MicroPython runtime check');
        if (runtime !== 'micropython') throw Error('Stock MicroPython required; CircuitPython is a different firmware');
        const machine = await command("print(getattr(__import__('sys').implementation, '_machine', 'unknown'))", 'device identity check');
        // USB ID and stock-only imports establish the device family. The selected
        // firmware is not verified unless an exact version is reported by REPL.
        const match = /^EP-2350\s+(\d+\.\d+\.\d+)$/.exec(machine);
        if (match && match[1] !== probeProfile.firmware) throw Error('Firmware mismatch: device '+match[1]+', selected '+probeProfile.firmware);
        const imported = await command('import fx, teenage', 'stock module import');
        if (imported !== '') throw Error('Cannot access stock FX-MIC modules');
        return { model: 'EP-2350', firmware: probeProfile.firmware,
          firmwareVerified: Boolean(match), board: machine.replace(/[^\x20-\x7e]/g,' ').slice(0,120) };
      } catch (error) { if (token === epoch) await disconnect(); throw error; }
    },
    async readState() {
      // The working stock reference reads the slot and effect chain in separate
      // REPL calls. A combined Python statement is not a stable response format
      // across stock firmware versions.
      const before = await command('print(teenage.fx_pos)', 'active FX slot before read');
      // Stock 1.1.2 follows the reference's config.json import instead of
      // treating fx.list_preset() text as a validated active DSP chain.
      if (probeProfile.firmware === '1.1.2') {
        if (!/^(?:-1|[0-3])$/.test(before)) throw Error('Unexpected active FX slot response');
        const stored = await readStoredConfig();
        const after = await command('print(teenage.fx_pos)', 'active FX slot after read');
        if (after !== before) throw Error('FX slot changed while reading saved config');
        const diagnostic = summarizeDeviceConfig(stored, Number(before));
        initializing = false;
        return diagnostic;
      }
      if (before === '-1') throw Error('No FX preset is active on the device; choose a preset on the mic and reconnect');
      if (!/^[0-3]$/.test(before)) throw Error('Unexpected active FX preset number (expected 0–3)');
      const rawChain = await command('fx.list_loaded(' + Number(before) + ')', 'active FX chain read');
      const after = await command('print(teenage.fx_pos)', 'active FX slot after read');
      if (after !== before) throw Error('FX preset changed during readback; keep the hardware buttons idle and reconnect');
      const loaded = { slot: Number(before), list: parseLoadedPreset(rawChain),
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
      const output = await command(`print(fx.param(${slot}, ${row}, "${param}", ${value}) if teenage.fx_pos == ${slot} else False)`, 'parameter write');
      if (output !== 'True' && !(probeProfile.manualTrial && output === 'None')) { const error = Error('Parameter write not acknowledged'); failed(error); throw error; }
      return true;
    },
    disconnect
  };
}
