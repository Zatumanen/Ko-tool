importScripts(
  "https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
);

let audioCtx;
function initCtx() {
  if (!audioCtx && (self.AudioContext || self.webkitAudioContext))
    audioCtx = new (self.AudioContext || self.webkitAudioContext)();
  return audioCtx;
}

function wavBlob(buffer) {
  const { length, sampleRate, numberOfChannels } = buffer;
  const dataLen = length * numberOfChannels * 2;
  const size = 36 + dataLen;
  const buf = new ArrayBuffer(44 + 12 + dataLen);
  const view = new DataView(buf);

  const writeStr = (offset, str) =>
    [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  writeStr(0, "RIFF");
  view.setUint32(4, size, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  const ko2 = new Uint8Array([0x6b, 0x6f, 0x32, 0x20, 4, 0, 0, 0, 0, 255, 0, 1]);
  new Uint8Array(buf, 44, 12).set(ko2);

  const samples = new Int16Array(buf, 44 + 12);
  let idx = 0;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const s = buffer.getChannelData(ch)[i];
      samples[idx++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

async function processFile({ file }) {
  const ctx = initCtx();
  if (!ctx) throw new Error("Web Audio не поддерживается");
  const ab = await file.arrayBuffer();
  const decoded = await ctx.decodeAudioData(ab);

  const Offline = self.OfflineAudioContext || self.webkitOfflineAudioContext;
  const off = new Offline(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.playbackRate.value = 2;
  src.connect(off.destination);
  src.start();
  const processed = await off.startRendering();
  return { blob: wavBlob(processed), name: file.name.replace(/\.\w+$/, "_ko2.wav") };
}

self.onmessage = async ({ data }) => {
  try {
    const { id, payload } = data;
    const res = await processFile(payload);
    self.postMessage({ id, res });
  } catch (err) {
    self.postMessage({ id, err: err.message });
  }
};
