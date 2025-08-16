// worker.js
self.importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js');

class Mp3Encoder {
  constructor(channels, sampleRate, bitrate) {
    this.channels = channels;
    this.sampleRate = sampleRate;
    this.bitrate = bitrate;
    this.lame = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
  }

  encode(audioBuffer) {
    const [left, right] = this.getAudioData(audioBuffer);
    const sampleBlockSize = 1152;
    const leftSamples = new Int16Array(sampleBlockSize);
    const rightSamples = new Int16Array(sampleBlockSize);
    const mp3Data = [];

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = this.channels > 1 ? right.subarray(i, i + sampleBlockSize) : leftChunk;

      for (let j = 0; j < leftChunk.length; j++) {
        const sampleLeft = Math.max(-1, Math.min(1, leftChunk[j]));
        leftSamples[j] = sampleLeft < 0 ? Math.round(sampleLeft * 32768) : Math.round(sampleLeft * 32767);

        if (this.channels > 1) {
          const sampleRight = Math.max(-1, Math.min(1, rightChunk[j]));
          rightSamples[j] = sampleRight < 0 ? Math.round(sampleRight * 32768) : Math.round(sampleRight * 32767);
        }
      }

      const mp3buf = this.lame.encodeBuffer(
        leftSamples.subarray(0, leftChunk.length),
        this.channels > 1 ? rightSamples.subarray(0, leftChunk.length) : undefined
      );

      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
    }

    const lastChunk = this.lame.flush();
    if (lastChunk.length > 0) {
      mp3Data.push(new Int8Array(lastChunk));
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  getAudioData(audioBuffer) {
    const left = audioBuffer.getChannelData(0);
    let right = new Float32Array(audioBuffer.length);
    if (audioBuffer.numberOfChannels > 1) {
      right = audioBuffer.getChannelData(1);
    }
    return [left, right];
  }
}

function getFidelitySettings(fidelity) {
  switch (fidelity) {
    case 'sp8': return { sampleRate: 22050, bitDepth: 8 };
    case 'sp16': return { sampleRate: 22050, bitDepth: 16 };
    case 'sk': return { sampleRate: 9000, bitDepth: 8 };
    default: return { sampleRate: 44100, bitDepth: 16 };
  }
}

async function convertChannels(buffer, targetChannels) {
  if (buffer.numberOfChannels === targetChannels) return buffer;
  
  const OfflineContext = self.OfflineAudioContext || self.webkitOfflineAudioContext;
  const ctx = new OfflineContext(targetChannels, buffer.length, buffer.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  if (targetChannels === 1 && buffer.numberOfChannels > 1) {
    const merger = ctx.createChannelMerger(1);
    const splitter = ctx.createChannelSplitter(buffer.numberOfChannels);
    const gain = ctx.createGain();
    
    source.connect(splitter);
    gain.gain.value = 1 / buffer.numberOfChannels;
    
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      splitter.connect(gain, i);
    }
    
    gain.connect(merger, 0, 0);
    merger.connect(ctx.destination);
  } 
  else if (targetChannels === 2 && buffer.numberOfChannels === 1) {
    const merger = ctx.createChannelMerger(2);
    source.connect(merger, 0, 0);
    source.connect(merger, 0, 1);
    merger.connect(ctx.destination);
  } 
  else {
    source.connect(ctx.destination);
  }
  
  source.start();
  return await ctx.startRendering();
}

async function applySpeedAndFidelity(buffer, speed, sampleRate) {
  const duration = buffer.duration / speed;
  const OfflineContext = self.OfflineAudioContext || self.webkitOfflineAudioContext;
  const ctx = new OfflineContext(buffer.numberOfChannels, Math.ceil(duration * sampleRate), sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speed;
  source.connect(ctx.destination);
  source.start();
  return await ctx.startRendering();
}

function writeString(dv, offset, str) {
  for (let i = 0; i < str.length; i++) {
    dv.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWav(audioBuffer, bitDepth) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = bitDepth === 8 ? 1 : 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const fmtChunkSize = 16;
  const fmtBuf = new ArrayBuffer(8 + fmtChunkSize);
  const fmtDv = new DataView(fmtBuf);
  
  writeString(fmtDv, 0, 'fmt ');
  fmtDv.setUint32(4, fmtChunkSize, true);
  fmtDv.setUint16(8, 1, true);
  fmtDv.setUint16(10, numChannels, true);
  fmtDv.setUint32(12, sampleRate, true);
  fmtDv.setUint32(16, sampleRate * blockAlign, true);
  fmtDv.setUint16(20, blockAlign, true);
  fmtDv.setUint16(22, bitDepth, true);
  
  const dataHeader = new ArrayBuffer(8);
  const dataDv = new DataView(dataHeader);
  writeString(dataDv, 0, 'data');
  dataDv.setUint32(4, dataLength, true);
  
  const riffSize = 4 + fmtBuf.byteLength + dataHeader.byteLength + dataLength;
  const riffHeader = new ArrayBuffer(12);
  const riffDv = new DataView(riffHeader);
  writeString(riffDv, 0, 'RIFF');
  riffDv.setUint32(4, riffSize, true);
  writeString(riffDv, 8, 'WAVE');
  
  let audioData;
  if (bitDepth === 8) {
    audioData = new Uint8Array(dataLength);
    let off = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const s = audioBuffer.getChannelData(ch)[i];
        const u = Math.max(0, Math.min(255, Math.round((s + 1) * 127.5)));
        audioData[off++] = u;
      }
    }
  } else {
    const tmp = new Int16Array(audioBuffer.length * numChannels);
    let off = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
        const v = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
        tmp[off++] = v;
      }
    }
    audioData = tmp.buffer;
  }
  
  return new Blob([riffHeader, fmtBuf, dataHeader, audioData], { type: 'audio/wav' });
}

function calculateRMSMulti(buffer, start, end) {
  const ch = buffer.numberOfChannels;
  let sum = 0;
  const n = (end - start) * ch;
  
  for (let i = 0; i < ch; i++) {
    const data = buffer.getChannelData(i).subarray(start, end);
    for (let j = 0; j < data.length; j++) {
      sum += data[j] * data[j];
    }
  }
  
  return Math.sqrt(sum / n);
}

function trimSilence(audioBuffer, thresholdDb = -60, minSilenceDuration = 0.1) {
  const threshold = Math.pow(10, thresholdDb / 20);
  const sampleRate = audioBuffer.sampleRate;
  const minSilenceSamples = Math.floor(minSilenceDuration * sampleRate);
  const length = audioBuffer.length;
  const blockSize = 1024;
  let startIndex = 0;
  let endIndex = length - 1;
  
  // Fast peak-based trimming
  const peaks = getPeakValues(audioBuffer, 1000);
  startIndex = findStart(peaks, threshold);
  endIndex = findEnd(peaks, threshold);
  
  startIndex = Math.max(0, startIndex - Math.floor(0.05 * sampleRate));
  endIndex = Math.min(length - 1, endIndex + Math.floor(0.05 * sampleRate));
  
  if (startIndex >= endIndex) return audioBuffer;
  
  const newLength = endIndex - startIndex + 1;
  const newBuffer = new AudioBuffer({ 
    length: newLength, 
    sampleRate: audioBuffer.sampleRate, 
    numberOfChannels: audioBuffer.numberOfChannels 
  });
  
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    const targetData = newBuffer.getChannelData(ch);
    targetData.set(sourceData.subarray(startIndex, endIndex + 1));
  }
  
  return newBuffer;
}

function getPeakValues(buffer, samples) {
  const step = Math.floor(buffer.length / samples);
  const peaks = [];
  
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, buffer.length);
    
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch).subarray(start, end);
      for (let j = 0; j < data.length; j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
    }
    
    peaks.push(max);
  }
  
  return peaks;
}

function findStart(peaks, threshold) {
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > threshold) {
      return Math.floor(i * peaks.length);
    }
  }
  return 0;
}

function findEnd(peaks, threshold) {
  for (let i = peaks.length - 1; i >= 0; i--) {
    if (peaks[i] > threshold) {
      return Math.min(Math.floor(i * peaks.length), peaks.length - 1);
    }
  }
  return peaks.length - 1;
}

async function processAudio(file, settings) {
  try {
    self.postMessage({ type: 'progress', progress: 0.1 });
    
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    
    self.postMessage({ type: 'progress', progress: 0.3 });
    
    const fidelitySettings = getFidelitySettings(settings.fidelity);
    const targetChannels = settings.channels === 'mono' ? 1 : 2;
    const speedFactor = 2.0;
    
    const converted = await convertChannels(decoded, targetChannels);
    self.postMessage({ type: 'progress', progress: 0.5 });
    
    const processed = await applySpeedAndFidelity(converted, speedFactor, fidelitySettings.sampleRate);
    self.postMessage({ type: 'progress', progress: 0.7 });
    
    let finalBuffer = processed;
    if (settings.trim) {
      finalBuffer = trimSilence(processed);
    }
    self.postMessage({ type: 'progress', progress: 0.8 });
    
    const fileExtension = (file.name.split('.').pop() || 'wav').toLowerCase();
    let outputBlob;
    
    if (fileExtension === 'mp3') {
      const encoder = new Mp3Encoder(finalBuffer.numberOfChannels, finalBuffer.sampleRate, 192);
      outputBlob = encoder.encode(finalBuffer);
    } else {
      outputBlob = audioBufferToWav(finalBuffer, fidelitySettings.bitDepth);
    }
    
    self.postMessage({ type: 'progress', progress: 1.0 });
    
    return {
      processedBlob: outputBlob,
      originalSize: file.size,
      processedSize: outputBlob.size,
      channels: decoded.numberOfChannels,
      trimmedSamples: settings.trim ? decoded.length - finalBuffer.length : 0
    };
  } catch (error) {
    throw new Error(`Audio processing error: ${error.message}`);
  }
}

self.addEventListener('message', async (e) => {
  const { id, type, file, path, settings } = e.data;
  
  if (type === 'process') {
    try {
      const result = await processAudio(file, settings);
      self.postMessage({ 
        id, 
        type: 'result', 
        result 
      });
    } catch (error) {
      self.postMessage({ 
        id, 
        type: 'error', 
        error: error.message 
      });
    }
  }
});