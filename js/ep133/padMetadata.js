import{resolveDeviceCapabilities}from './deviceCapabilities.js?v=20261001-1';
import{assessEpFirmwareCompatibility}from './deviceCompatibilityMatrix.js?v=20261008-1';

/**
 * Pure pad-node contracts, separate from /sounds defaults and native TAR records.
 * Field names/string enums/release pairing come from the public protocol document
 * pinned in evidenceRegistry.PAD_METADATA_PROTOCOL_SOURCE. This documents a shape;
 * it does not establish a safe physical write payload on any model/firmware.
 * The runtime must independently require getPadMetadataAvailability(...).write.
 */
export const PAD_METADATA_FIELDS=Object.freeze([
  'sym','sound.playmode','sample.start','sample.end','envelope.attack',
  'envelope.release','sound.pitch','sound.amplitude','sound.pan','sound.mutegroup',
  'time.mode','midi.channel'
]);
const FIELDS=new Set(PAD_METADATA_FIELDS);
const EDITABLE=new Set(['sound.pitch','sound.playmode','time.mode']);
const PLAY_MODES=Object.freeze(['oneshot','key','legato']);
const TIME_MODES=Object.freeze(['off','bar','bpm']);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=(value,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be a metadata object.');
  return value;
};

/** deviceInfo: {sku, firmware} or the connected {sku, metadata:{os_version,sw_version}}. */
export function getPadMetadataAvailability(deviceInfo={}){
  const sku=String(deviceInfo?.sku||'');
  const firmware=String(deviceInfo?.metadata?.os_version||deviceInfo?.metadata?.sw_version||deviceInfo?.firmware||'');
  const compatibility=assessEpFirmwareCompatibility(sku,firmware);
  const evidence=resolveDeviceCapabilities({sku,firmware}).evidence.padMetadata;
  return Object.freeze({
    read:compatibility.supported&&evidence.read===true,
    write:compatibility.supported&&evidence.write===true,
    reason:compatibility.supported?(evidence.reason||''):compatibility.reason,
    evidence
  });
}

/**
 * Optional profile: {playModes: string[]} (e.g. getEpDeviceProfile's result).
 * It can restrict documented modes; it cannot introduce new wire enums/mappings.
 * Numeric enums are refused: this source contains no pad numeric-to-string map.
 * Partial read snapshots can normalize; preparation below requires all 12 fields.
 */
export function normalizePadMetadata(metadata,{profile}={}){
  object(metadata,'Pad metadata');
  const result={};
  for(const[key,value]of Object.entries(metadata)){
    if(!FIELDS.has(key))throw new Error('Unsupported pad metadata field: '+key);
    if(key==='sound.playmode'||key==='time.mode'){
      const modes=key==='sound.playmode'?PLAY_MODES:TIME_MODES;
      if(typeof value!=='string'||!modes.includes(value))throw new Error('Unsupported pad enum for '+key+'. Source-backed string mode required.');
      if(key==='sound.playmode'&&Array.isArray(profile?.playModes)&&!profile.playModes.includes(value))
        throw new Error('Pad play mode is not allowed by the connected profile.');
    }else if(key==='sym'){
      // Keep the authoritative assignment identifier's type/value unchanged.
      if(!((typeof value==='string'&&value.trim().length>0)||
        (typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)))
        throw new Error('Invalid pad assignment sym.');
    }else{
      if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Pad '+key+' requires a finite number.');
      if(key==='sound.pitch'&&(value<-12||value>12))throw new Error('Pad pitch is outside -12..12.');
      if((key==='envelope.attack'||key==='envelope.release')&&(!Number.isInteger(value)||value<0||value>255))
        throw new Error('Invalid pad '+key+' byte.');
    }
    result[key]=value;
  }
  return result;
}

function completeSnapshot(metadata,options){
  const result=normalizePadMetadata(metadata,options);
  for(const field of PAD_METADATA_FIELDS)
    if(!own(result,field))throw new Error('Complete pad snapshot required; missing '+field+'.');
  return result;
}

function assertChanges(changes){
  object(changes,'Pad changes');
  for(const key of Object.keys(changes)){
    if(EDITABLE.has(key))continue;
    if(key==='envelope.release'&&own(changes,'sound.playmode'))continue;
    throw new Error('Unsupported pad change: '+key+'. Release is only a playmode companion.');
  }
}

/** Build a complete candidate; never supply defaults or authorize a physical SET. */
export function preparePadMetadataPayload(before,changes,{profile}={}){
  const snapshot=completeSnapshot(before,{profile});
  assertChanges(changes);
  const normalizedChanges=normalizePadMetadata(changes,{profile});
  return{...snapshot,...normalizedChanges};
}

/**
 * Report: {ok,intendedFields,preservedFields,mismatches:[{field,kind,expected,actual}]}.
 * kind is intended/preserved for readback differences, or payload for invalid
 * candidates. Compare every supported field, including unchanged pad overrides.
 */
export function verifyPadMetadata(before,payload,readback){
  const mismatches=[];
  const intendedFields=[];
  const preservedFields=[];
  let snapshot,candidate;
  try{
    snapshot=completeSnapshot(before);
    candidate=completeSnapshot(payload);
    const changes={};
    for(const key of PAD_METADATA_FIELDS){
      if(Object.is(snapshot[key],candidate[key]))preservedFields.push(key);
      else{intendedFields.push(key);changes[key]=candidate[key];}
    }
    // A release-only difference is still valid when a complete payload carries
    // the unchanged playmode explicitly as its documented companion.
    if(own(changes,'envelope.release'))changes['sound.playmode']=candidate['sound.playmode'];
    for(const key of Object.keys(changes))
      if(!EDITABLE.has(key)&&key!=='envelope.release')
        mismatches.push({field:key,kind:'payload',expected:snapshot[key],actual:candidate[key]});
    assertChanges(changes);
  }catch(error){
    mismatches.push({field:null,kind:'payload',reason:error.message});
    return{ok:false,intendedFields,preservedFields,mismatches};
  }
  const actual=readback&&typeof readback==='object'&&!Array.isArray(readback)?readback:{};
  for(const key of PAD_METADATA_FIELDS){
    if(!own(actual,key)||!Object.is(candidate[key],actual[key]))
      mismatches.push({field:key,kind:intendedFields.includes(key)?'intended':'preserved',expected:candidate[key],actual:actual[key]});
  }
  for(const key of Object.keys(actual))
    if(!FIELDS.has(key))mismatches.push({field:key,kind:'preserved',reason:'Unsupported readback field.'});
  return{ok:mismatches.length===0,intendedFields,preservedFields,mismatches};
}
