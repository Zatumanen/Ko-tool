import test from 'node:test';
import assert from 'node:assert/strict';
import {markSpeedUppercutWav, classifyRepitchInput} from '../js/ep133/repitchProvenance.js';

const encoder = new TextEncoder();
function chunk(id, body) {
  const out = new Uint8Array(8 + body.length + (body.length & 1));
  const view = new DataView(out.buffer);
  out.set(encoder.encode(id), 0);
  view.setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}
function makeWav({pitch = null, samples = [100, -100, 200, -200]} = {}) {
  const fmt = new Uint8Array(16), f = new DataView(fmt.buffer);
  f.setUint16(0, 1, true); f.setUint16(2, 1, true);
  f.setUint32(4, 32000, true); f.setUint32(8, 64000, true);
  f.setUint16(12, 2, true); f.setUint16(14, 16, true);
  const pcm = new Uint8Array(samples.length * 2), d = new DataView(pcm.buffer);
  samples.forEach((n, i) => d.setInt16(i * 2, n, true));
  const chunks = [chunk('fmt ', fmt)];
  if (pitch !== null) {
    const json = encoder.encode(JSON.stringify({'sound.pitch': pitch, 'sound.playmode': 'loop'}));
    const body = new Uint8Array(12 + json.length), v = new DataView(body.buffer);
    body.set(encoder.encode('INFO'), 0);
    body.set(encoder.encode('TNGE'), 4);
    v.setUint32(8, json.length, true);
    body.set(json, 12);
    chunks.push(chunk('LIST', body));
  }
  chunks.push(chunk('data', pcm));
  const size = 12 + chunks.reduce((n, c) => n + c.length, 0);
  const wav = new Uint8Array(size), v = new DataView(wav.buffer);
  wav.set(encoder.encode('RIFF'), 0);
  v.setUint32(4, size - 8, true);
  wav.set(encoder.encode('WAVE'), 8);
  let offset = 12;
  chunks.forEach(c => {wav.set(c, offset); offset += c.length;});
  return wav;
}

test('unmarked normal WAV is raw, -12 WAV is ambiguous, not trusted', async () => {
  assert.equal((await classifyRepitchInput(makeWav(), {filename: 'raw.wav'})).kind, 'raw');
  assert.equal((await classifyRepitchInput(makeWav({pitch: -12}), {filename: 'old.wav'})).kind, 'ambiguous');
  assert.equal((await classifyRepitchInput(makeWav({pitch: -7}), {filename: 'other.wav'})).kind, 'raw');
  assert.equal((await classifyRepitchInput(Uint8Array.from([0x49, 0x44, 0x33]), {filename: 'song.mp3'})).kind, 'raw');
});

test('SpeedUpperCut WAV marker stays content-bound and PCM unchanged', async () => {
  const original = makeWav({pitch: -12});
  const marked = new Uint8Array(await (await markSpeedUppercutWav(new Blob([original]))).arrayBuffer());
  assert.deepEqual([...marked.slice(0, original.length)].map((v, i) => i >= 4 && i < 8 ? original[i] : v), [...original]);
  assert.equal((await classifyRepitchInput(marked, {filename: 'saved.wav'})).kind, 'trusted');
  const tampered = marked.slice();
  const index = Buffer.from(tampered).indexOf(Buffer.from('data')) + 8;
  tampered[index] ^= 1;
  await assert.rejects(() => classifyRepitchInput(tampered, {filename: 'edited.wav'}), /PCM changed/);
});

test('malformed or forged provenance fails closed', async () => {
  const marked = new Uint8Array(await (await markSpeedUppercutWav(new Blob([makeWav({pitch: -12})]))).arrayBuffer());
  const badRiff = marked.slice();
  new DataView(badRiff.buffer).setUint32(4, 17, true);
  await assert.rejects(() => classifyRepitchInput(badRiff, {filename: 'bad.wav'}), /Malformed RIFF/);
  const wrongPitch = makeWav({pitch: -7});
  await assert.rejects(() => markSpeedUppercutWav(new Blob([wrongPitch])), /Only actual/);
  await assert.rejects(() => classifyRepitchInput(Uint8Array.from([0x4E, 0x4F]), {filename: 'bad.wav'}), /RIFF\/WAVE/);
});

test('corrupt TNGE length and JSON do not silently become unprepared WAV', async () => {
  const source = makeWav({pitch: -12});
  const invalidLength = source.slice();
  const offset = Buffer.from(invalidLength).indexOf(Buffer.from('TNGE'));
  new DataView(invalidLength.buffer).setUint32(offset + 4, 0xffffffff, true);
  await assert.rejects(() => classifyRepitchInput(invalidLength, {filename: 'bad.wav'}), /metadata length/);
  const invalidJSON = source.slice();
  invalidJSON[offset + 8] = 0x78; // replace JSON's opening '{' with 'x'
  invalidJSON[offset + 9] = 0x20; // keep invalid JSON without injecting NUL
  await assert.rejects(() => classifyRepitchInput(invalidJSON, {filename: 'bad.wav'}), /metadata JSON/);
});


test('truncated INFO/TNGE and nonzero JSON padding fail instead of triggering x2', async () => {
  const base = makeWav({pitch: -12});
  const short = base.slice();
  const at = Buffer.from(short).indexOf(Buffer.from('LIST'));
  new DataView(short.buffer).setUint32(at + 4, 8, true);
  await assert.rejects(() => classifyRepitchInput(short, {filename:'sample.wav'}), /metadata length/);

  // The test builder emits exact JSON with no padding. Corrupt a source with an
  // explicit NUL followed by invalid trailing data while keeping RIFF valid.
  const extra = chunk('LIST', (()=>{
    const json=encoder.encode(JSON.stringify({'sound.pitch':-12}));
    const body=new Uint8Array(12+json.length+2);
    body.set(encoder.encode('INFO'));body.set(encoder.encode('TNGE'),4);
    new DataView(body.buffer).setUint32(8,json.length+2,true);
    body.set(json,12);body[12+json.length]=0;body[13+json.length]=65;
    return body;
  })());
  const fmt = chunk('fmt ', base.subarray(20,36));
  const pcm = chunk('data', base.subarray(base.length-8));
  const result=new Uint8Array(12+fmt.length+extra.length+pcm.length);
  result.set(encoder.encode('RIFF'));new DataView(result.buffer).setUint32(4,result.length-8,true);
  result.set(encoder.encode('WAVE'),8);result.set(fmt,12);result.set(extra,12+fmt.length);
  result.set(pcm,12+fmt.length+extra.length);
  await assert.rejects(() => classifyRepitchInput(result, {filename:'sample.wav'}), /metadata padding/);
});

test('inconsistent s16 byteRate and frame alignment are rejected before upload', async () => {
  const broken = makeWav({pitch:-12});
  new DataView(broken.buffer).setUint32(28,1234,true);
  await assert.rejects(() => classifyRepitchInput(broken,{filename:'sample.wav'}), /block alignment or byte rate/);
  const truncated = makeWav({pitch:-12}).slice(0,-1);
  new DataView(truncated.buffer).setUint32(4,truncated.length-8,true);
  await assert.rejects(() => classifyRepitchInput(truncated,{filename:'sample.wav'}), /RIFF chunk|PCM size|truncated/i);
});

test('invalid pitch type cannot cause accidental second x2', async () => {
  for (const pitch of ['-12', -13, 13, [], {}]) {
    const raw=makeWav({pitch});
    await assert.rejects(() => classifyRepitchInput(raw,{filename:'legacy.wav'}), /Invalid Teenage Engineering sound.pitch/);
  }
});
