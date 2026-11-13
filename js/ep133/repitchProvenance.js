/**
 * K.O. Tool private RIFF chunk. This records content integrity and conversion
 * provenance for our own exports; it is not a cryptographic proof of origin.
 * Unknown RIFF chunks must be tolerated by standards-compliant WAV readers.
 */
const CHUNK_ID = 'KORP';
const MARKER_VERSION = 1;
const MAX_MARKER_BYTES = 512;
const textDecoder = new TextDecoder('utf-8', {fatal: true});
const textEncoder = new TextEncoder();

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
function setAscii(bytes, offset, string) {
  for (let i = 0; i < string.length; i++) bytes[offset + i] = string.charCodeAt(i);
}
function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError('A WAV Uint8Array or ArrayBuffer is required.');
}
function strictJson(bytes, kind) {
  try {
    const value = JSON.parse(textDecoder.decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected JSON object');
    return value;
  } catch (error) {
    throw new Error('Invalid ' + kind + ': ' + String(error?.message || error));
  }
}
function scanWav(value, {required = true} = {}) {
  const bytes = asBytes(value);
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    if (required) throw new Error('Expected a valid RIFF/WAVE file.');
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffLength = view.getUint32(4, true) + 8;
  if (riffLength !== bytes.length) throw new Error('Malformed RIFF/WAVE length.');
  let fmt = null, data = null, metadata = null, marker = null;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error('Truncated RIFF chunk header.');
    const id = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8, end = start + length, next = end + (length & 1);
    if (end > bytes.length || next > bytes.length || next <= offset)
      throw new Error('Malformed or truncated RIFF chunk.');
    if (id === 'fmt ') {
      if (fmt || length < 16) throw new Error('Invalid duplicate or short WAV format chunk.');
      fmt = {format: view.getUint16(start, true), channels: view.getUint16(start + 2, true),
        sampleRate: view.getUint32(start + 4, true),
        byteRate: view.getUint32(start + 8, true), blockAlign: view.getUint16(start + 12, true),
        bits: view.getUint16(start + 14, true)};
    } else if (id === 'data') {
      if (data || length === 0) throw new Error('Invalid duplicate or empty WAV data chunk.');
      data = {start, length};
    } else if (id === 'LIST') {
      // A damaged INFO/TNGE header must not silently become 'raw' and trigger
      // a second x2 conversion. Only non-INFO LIST types are unrelated.
      if (length < 4) throw new Error('Malformed WAV LIST chunk.');
      if (ascii(bytes, start, 4) === 'INFO') {
        if (length < 12) throw new Error('Malformed Teenage Engineering metadata length.');
        if (ascii(bytes, start + 4, 4) === 'TNGE') {
          if (metadata) throw new Error('Duplicate Teenage Engineering metadata.');
          const jsonLength = view.getUint32(start + 8, true);
          if (jsonLength === 0 || jsonLength > end - (start + 12))
            throw new Error('Malformed Teenage Engineering metadata length.');
          const jsonBytes = bytes.subarray(start + 12, start + 12 + jsonLength);
          const terminator = jsonBytes.indexOf(0);
          if (terminator >= 0 && jsonBytes.subarray(terminator).some(byte => byte !== 0))
            throw new Error('Malformed Teenage Engineering metadata padding.');
          metadata = strictJson(terminator >= 0 ? jsonBytes.subarray(0, terminator) : jsonBytes,
            'Teenage Engineering metadata JSON');
        }
      }
    } else if (id === CHUNK_ID) {
      if (marker || length > MAX_MARKER_BYTES || length === 0)
        throw new Error('Invalid or duplicate K.O. Tool REPITCH provenance.');
      marker = strictJson(bytes.subarray(start, end), 'K.O. Tool REPITCH provenance');
    }
    offset = next;
  }
  if (!fmt || !data || !fmt.channels || !fmt.sampleRate)
    throw new Error('WAV has no usable format or audio chunk.');
  if (fmt.format === 1 && fmt.bits === 16 && [1, 2].includes(fmt.channels)) {
    const frameSize = fmt.channels * 2;
    if (fmt.blockAlign !== frameSize || fmt.byteRate !== fmt.sampleRate * frameSize ||
        data.length % frameSize !== 0)
      throw new Error('Malformed WAV PCM size, block alignment or byte rate.');
  }
  return {bytes, fmt, data, metadata, marker};
}
async function sha256(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Secure SHA-256 is unavailable; REPITCH provenance cannot be verified.');
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return Array.from(digest, v => v.toString(16).padStart(2, '0')).join('');
}

/** Attach a versioned marker without touching PCM, TE metadata or other chunks. */
export async function markSpeedUppercutWav(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') throw new TypeError('WAV Blob required.');
  const parsed = scanWav(new Uint8Array(await blob.arrayBuffer()));
  const {bytes, fmt, data, metadata, marker} = parsed;
  if (marker) throw new Error('The WAV already contains REPITCH provenance.');
  if (fmt.format !== 1 || fmt.bits !== 16 || ![1, 2].includes(fmt.channels) ||
      metadata?.['sound.pitch'] !== -12)
    throw new Error('Only actual SpeedUpperCut ×2/−12 PCM WAV exports can be marked.');
  const record = {
    version: MARKER_VERSION, processor: 'speeduppercut-x2-reference', speed: 2, pitch: -12,
    channels: fmt.channels, sampleRate: fmt.sampleRate, dataBytes: data.length,
    dataSha256: await sha256(bytes.subarray(data.start, data.start + data.length))
  };
  const encoded = textEncoder.encode(JSON.stringify(record));
  if (encoded.length > MAX_MARKER_BYTES) throw new Error('REPITCH marker is unexpectedly large.');
  const padding = encoded.length & 1;
  const size = bytes.length + 8 + encoded.length + padding;
  if (size > 0xffffffff) throw new Error('WAV exceeds the RIFF size limit.');
  const result = new Uint8Array(size);
  result.set(bytes);
  const v = new DataView(result.buffer);
  v.setUint32(4, size - 8, true);
  setAscii(result, bytes.length, CHUNK_ID);
  v.setUint32(bytes.length + 4, encoded.length, true);
  result.set(encoded, bytes.length + 8);
  return new Blob([result], {type: 'audio/wav'});
}

/**
 * trusted: matched conversion marker+SHA256+TE metadata.
 * ambiguous: legacy -12 metadata without content-bound provenance.
 * raw: ordinary unprepared audio, including non-WAV.
 * Invalid/mismatched provenance and corrupt TNGE cause a hard error.
 */
export async function classifyRepitchInput(value, {filename = ''} = {}) {
  const bytes = asBytes(value);
  const isWavHeader = bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF';
  if (!isWavHeader && !/\.wav$/i.test(filename)) return {kind: 'raw'};
  const parsed = scanWav(bytes);
  const {fmt, data, metadata, marker} = parsed;
  // Invalid pitch values must not turn a previously modified WAV into an
  // apparently unprepared input and trigger a second x2 operation.
  if(metadata && Object.hasOwn(metadata,'sound.pitch') &&
     (typeof metadata['sound.pitch']!=='number' ||
      !Number.isFinite(metadata['sound.pitch']) ||
      metadata['sound.pitch'] < -12 || metadata['sound.pitch'] > 12))
    throw new Error('Invalid Teenage Engineering sound.pitch metadata.');
  const bytesPerFrame = fmt.channels * fmt.bits / 8;
  const sourceFrames = Number.isInteger(bytesPerFrame) && bytesPerFrame > 0 &&
    data.length % bytesPerFrame === 0 ? data.length / bytesPerFrame : null;
  if (marker) {
    if (fmt.format !== 1 || fmt.bits !== 16 || ![1, 2].includes(fmt.channels) ||
      metadata?.['sound.pitch'] !== -12 || marker.version !== MARKER_VERSION ||
      marker.processor !== 'speeduppercut-x2-reference' || marker.speed !== 2 ||
      marker.pitch !== -12 || marker.channels !== fmt.channels ||
      marker.sampleRate !== fmt.sampleRate || marker.dataBytes !== data.length ||
      !/^[a-f0-9]{64}$/.test(marker.dataSha256 || ''))
      throw new Error('K.O. Tool REPITCH provenance does not match the WAV.');
    const currentHash = await sha256(parsed.bytes.subarray(data.start, data.start + data.length));
    if (currentHash !== marker.dataSha256)
      throw new Error('WAV PCM changed after REPITCH preparation; automatic upload denied.');
    return {kind: 'trusted', metadata, sourceFrames};
  }
  return metadata?.['sound.pitch'] === -12
    ? {kind: 'ambiguous', metadata, sourceFrames}
    : {kind: 'raw', metadata, sourceFrames};
}
