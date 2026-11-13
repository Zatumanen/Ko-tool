import {prepareEp133Sample, prepareTeenageMetadata} from './audio.js?v=20261001-1';
import {processAudio} from '../audio/processor.js?v=20261001-1';
import {classifyRepitchInput} from './repitchProvenance.js?v=20261113-1';

// Fields whose meaning is unchanged after ×2 PCM + −12 playback compensation.
// All other nontrivial source sample settings must be explicitly handled or
// rejected; silently dropping them is not an acceptable import conversion.
const SAFE_AUDIO_FIELDS = Object.freeze({
  'sound.rootnote': value => Number.isInteger(value) && value >= 1 && value <= 127,
  'sound.pan': value => typeof value === 'number' && Number.isFinite(value) && value >= -16 && value <= 16,
  'sound.amplitude': value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 200,
  'sound.bpm': value => typeof value === 'number' && Number.isFinite(value) && (value === 0 || value >= 60 && value <= 180),
  'envelope.attack': value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255,
  'envelope.release': value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255
});
const ALLOWED_SOURCE_FIELDS = new Set([
  'sound.pitch','sound.playmode','time.mode','sound.loopstart','sound.loopend',
  'sample.start','sample.end','sample.mode','regions',
  ...Object.keys(SAFE_AUDIO_FIELDS)
]);
const PLAYMODES = new Set(['oneshot','loop','key','legato']);

/** Reject unremappable metadata on every raw WAV *before any batch upload*.
 * TE sample.end describes full source frames; loop and region offsets cannot
 * be preserved without a separately proven time-domain remapping contract.
 */
export function assertRawRepitchMetadataSafe(verdict) {
  if (verdict?.kind !== 'raw' || !verdict.metadata) return;
  const metadata = verdict.metadata;
  for (const [key,value] of Object.entries(metadata)) {
    if (!ALLOWED_SOURCE_FIELDS.has(key))
      throw new Error('REPITCH cannot safely preserve unknown sample metadata: ' + key);
    if (Object.hasOwn(SAFE_AUDIO_FIELDS,key) && !SAFE_AUDIO_FIELDS[key](value))
      throw new Error('REPITCH cannot safely preserve invalid sample metadata: ' + key);
  }
  if (metadata['sound.playmode'] != null && !PLAYMODES.has(metadata['sound.playmode']))
    throw new Error('REPITCH cannot safely preserve unknown sample playmode.');
  const sourceFrames = verdict.sourceFrames;
  const originalEnd = metadata['sample.end'];
  const hasTrimmedEnd = originalEnd != null &&
    (!Number.isInteger(originalEnd) || sourceFrames == null || originalEnd !== sourceFrames);
  const hasUnsafeLoop = key => Object.hasOwn(metadata,key) && metadata[key] !== -1;
  if (hasUnsafeLoop('sound.loopstart') || hasUnsafeLoop('sound.loopend') ||
      (metadata['sample.start'] != null && metadata['sample.start'] !== 0) ||
      hasTrimmedEnd ||
      (metadata.regions != null && (!Array.isArray(metadata.regions) || metadata.regions.length > 0)) ||
      metadata['sample.mode'] != null ||
      (metadata['time.mode'] != null && metadata['time.mode'] !== 'off'))
    throw new Error('REPITCH cannot safely preserve sample regions, loop boundaries or time mode. Disable REPITCH for this file.');
}

/** Read and classify a complete batch before entering the first FILE lease.
 * Return null on explicit cancel; any structural error fails the entire batch. */
export async function preflightRepitchBatch(files,{
  classify=classifyRepitchInput, confirmAmbiguous=async()=>false, assertSession=()=>{}
}={}) {
  const entries=Array.from(files||[]);
  const ambiguous=new Set();
  for(const file of entries){
    assertSession();
    if(!file||typeof file.arrayBuffer!=='function')throw new TypeError('Audio File required.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    assertSession();
    const verdict=await classify(bytes,{filename:file.name});
    assertSession();
    assertRawRepitchMetadataSafe(verdict);
    if(verdict.kind==='ambiguous')ambiguous.add(file);
  }
  if(ambiguous.size){
    const accepted=await confirmAmbiguous({count:ambiguous.size,total:entries.length});
    assertSession();
    if(accepted!==true)return null;
  }
  return ambiguous;
}


/** Keep decisions and conversion before the first FILE PUT. The caller owns
 * session, slot, firmware, capacity, rollback and transport validation. */
export async function prepareMyEpRepitchSample(file, {
  formats = [], targetSampleRate = null, onProgress,
  confirmAmbiguous = async () => false,
  prepareDirect = prepareEp133Sample,
  convert = processAudio
} = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new TypeError('Audio File required.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = await classifyRepitchInput(bytes, {filename: file.name});
  if (verdict.kind === 'trusted') {
    onProgress?.(5, {status: 'already repitched'});
    return prepareDirect(file, {formats, targetSampleRate, onProgress});
  }
  if (verdict.kind === 'ambiguous') {
    const approved = await confirmAmbiguous(file);
    if (approved !== true)
      throw new Error('REPITCH import cancelled: legacy pitch -12 WAV origin is unverified.');
    // Explicit choice: keep existing audio and -12 rather than risk double x2.
    onProgress?.(5, {status: 'explicit legacy bypass'});
    return prepareDirect(file, {formats, targetSampleRate, onProgress});
  }
  // Repeat the preflight rule at preparation time: the file may have been
  // replaced between user confirmation and the guarded device transaction.
  assertRawRepitchMetadataSafe(verdict);
  onProgress?.(5, {status: 'repitch x2'});
  const transformed = await convert(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    fidelity: 'hi', channels: 'original', playmode: 'original', autoTrim: false
  }, {
    progress: (progress, label) => onProgress?.(Math.min(75, progress * 75), {
      status: 'repitch x2', label
    })
  });
  if (!transformed?.blob || typeof transformed.blob.arrayBuffer !== 'function')
    throw new Error('REPITCH processor did not produce a valid WAV.');
  const transformedBytes = new Uint8Array(await transformed.blob.arrayBuffer());
  const verified = await classifyRepitchInput(transformedBytes, {filename: 'repitched.wav'});
  if (verified.kind !== 'trusted')
    throw new Error('REPITCH output has no matching content-bound provenance; upload denied.');
  const derived = new File([transformed.blob], file.name.replace(/\.[^.]+$/, '') + '.wav', {
    type: 'audio/wav'
  });
  const prepared = await prepareDirect(derived, {
    formats, targetSampleRate,
    onProgress: (percent, info) => onProgress?.(75 + Math.max(0, Math.min(25, percent * .25)), info)
  });
  if (prepared.metadata?.['sound.pitch'] !== -12)
    throw new Error('REPITCH compensation was lost during direct sample preparation.');
  // Preserve supported non-timing TE properties that would otherwise be lost
  // when the converter writes its canonical playback defaults.
  if(verdict.metadata){
    const validated=prepareTeenageMetadata({extra:{json:JSON.stringify(verdict.metadata)}},prepared.samplerate);
    const safeKeys=Object.keys(SAFE_AUDIO_FIELDS);
    const metadata={...prepared.metadata};
    for(const key of safeKeys)
      if(Object.hasOwn(validated,key))metadata[key]=validated[key];
    return{...prepared,metadata};
  }
  return prepared;
}
