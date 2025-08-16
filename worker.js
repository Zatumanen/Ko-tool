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

self.addEventListener('message', async (e) => {
  const { id, type, audioData } = e.data;
  
  if (type === 'encode') {
    try {
      const { channels, sampleRate } = audioData;
      const encoder = new Mp3Encoder(channels.length, sampleRate, 192);
      
      const left = new Float32Array(audioData.left);
      const right = channels.length > 1 ? new Float32Array(audioData.right) : left;
      
      const audioBuffer = {
        getChannelData: (index) => index === 0 ? left : right,
        numberOfChannels: channels.length,
        sampleRate: sampleRate,
        length: left.length
      };
      
      const mp3Blob = encoder.encode(audioBuffer);
      const arrayBuffer = await mp3Blob.arrayBuffer();
      
      self.postMessage({ 
        id, 
        type: 'result', 
        result: arrayBuffer 
      });
    } catch (error) {
      self.postMessage({ 
        id, 
        type: 'error', 
        error: `MP3 encoding error: ${error.message}` 
      });
    }
  }
});