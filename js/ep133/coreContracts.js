/**
 * Shared boundary types. Keep this layer dependency-free: protocol and recovery
 * modules can import it without introducing a device/runtime import cycle.
 *
 * @typedef {{sku:string, firmware:string, midiId?:number, identityHash?:string}} DeviceIdentity
 * @typedef {{read:boolean,write:boolean,delete:boolean,move:boolean,playback:boolean}} FileRights
 * @typedef {'hardware-verified'|'official-tool-observed'|'capture-observed'|'preserve-only'|'unverified'|'unsafe'} CapabilityLevel
 * @typedef {{level:CapabilityLevel,read:boolean,preserve:boolean,write:boolean,reason:string}} CapabilityEvidence
 * @typedef {number} WireFid  Unsigned 16-bit FILE node identifier (0 only where allowed).
 * @typedef {number} SampleSlot  Sample node 1..999.
 * @typedef {Record<string,unknown>} FileMetadata
 * @typedef {'pending'|'running'|'succeeded'|'failed'|'rolled-back'|'rollback-failed'|'requires-recovery'|'aborted'} ProjectTransactionStatus
 * @typedef {'pending'|'running'|'succeeded'|'failed'|'rolled-back'|'requires-recovery'|'acknowledged'} SampleTransactionStatus
 * @typedef {'pending'|'candidate-written'|'verified'|'rolled-back'|'rollback-failed'|'requires-recovery'|'aborted'|'restored'} ProjectRecoveryStatus
 */

export const PROJECT_TRANSACTION_STATUSES=Object.freeze([
  'pending','running','succeeded','failed','rolled-back','rollback-failed','requires-recovery','aborted'
]);
export const SAMPLE_TRANSACTION_STATUSES=Object.freeze([
  'pending','running','succeeded','failed','rolled-back','requires-recovery','acknowledged'
]);
export const PROJECT_RECOVERY_STATUSES=Object.freeze([
  'pending','candidate-written','verified','rolled-back','rollback-failed','requires-recovery','aborted','restored'
]);

/** @template T @param {T} value @param {readonly T[]} allowed @param {string} label @returns {T} */
export function assertEnum(value,allowed,label='state'){
  if(!allowed.includes(value))throw new TypeError('Unknown '+label+': '+String(value));
  return value;
}

/** @param {unknown} value @param {string} [label] @returns {Uint8Array} */
export function assertBinaryBytes(value,label='binary data'){
  if(!(value instanceof Uint8Array))throw new TypeError(label+' must be Uint8Array.');
  return value;
}

/** @param {unknown} value @param {string} [label] @param {number} [maximum] */
export function assertUnsigned(value,label='integer',maximum=0xffffffff){
  if(!Number.isInteger(value)||value<0||value>maximum)
    throw new RangeError(label+' must be an unsigned integer in 0..'+maximum+'.');
  return value;
}

/** @param {unknown} fid @param {{allowRoot?:boolean,label?:string}} [options] */
export function assertWireFid(fid,{allowRoot=false,label='FILE id'}={}){
  assertUnsigned(fid,label,0xffff);
  if(fid===0&&!allowRoot)throw new RangeError(label+' must be a positive 16-bit FILE id.');
  return fid;
}

/** @param {unknown} slot @param {string} [label] */
export function assertSampleSlot(slot,label='sample slot'){
  if(!Number.isInteger(slot)||slot<1||slot>999)
    throw new RangeError(label+' must be an integer in 1..999.');
  return slot;
}

/** @param {unknown} value @returns {DeviceIdentity} */
export function assertDeviceIdentity(value){
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new TypeError('Device identity must be an object.');
  const sku=String(value.sku||'').toUpperCase();
  if(sku&&!/^TE\d{3}AS\d{3}$/.test(sku))
    throw new TypeError('Device identity SKU has an invalid shape.');
  const firmware=String(value.firmware||value.metadata?.os_version||value.metadata?.sw_version||'');
  if(value.midiId!=null)assertUnsigned(value.midiId,'identity MIDI id',0x7f);
  return Object.freeze({sku,firmware,...(value.midiId==null?{}:{midiId:value.midiId})});
}

/**
 * Reject executable/prototype-bearing or unbounded nested values before
 * metadata reaches FILE serialization or becomes trusted state.
 * @param {unknown} value
 * @param {string} [label]
 * @returns {FileMetadata}
 */
export function assertFileMetadata(value,label='FILE metadata'){
  const ancestors=new Set();
  const visit=(item,depth)=>{
    if(depth>12)throw new TypeError(label+' nesting exceeds 12 levels.');
    if(item===null||typeof item==='string'||typeof item==='boolean')return;
    if(typeof item==='number'&&Number.isFinite(item))return;
    if(typeof item!=='object')throw new TypeError(label+' contains an unsupported value.');
    if(ancestors.has(item))throw new TypeError(label+' contains a cycle.');
    if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)
      throw new TypeError(label+' must contain plain objects.');
    ancestors.add(item);
    for(const [key,child]of Object.entries(item)){
      if(key==='__proto__'||key==='prototype'||key==='constructor')
        throw new TypeError(label+' contains a forbidden key.');
      visit(child,depth+1);
    }
    ancestors.delete(item);
  };
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
    throw new TypeError(label+' must be a plain object.');
  visit(value,0);
  return value;
}

/** @param {unknown} status */
export const assertProjectTransactionStatus=status=>assertEnum(status,PROJECT_TRANSACTION_STATUSES,'project transaction status');
/** @param {unknown} status */
export const assertSampleTransactionStatus=status=>assertEnum(status,SAMPLE_TRANSACTION_STATUSES,'sample transaction status');
/** @param {unknown} status */
export const assertProjectRecoveryStatus=status=>assertEnum(status,PROJECT_RECOVERY_STATUSES,'project recovery status');

/**
 * Validate complete MIDI SysEx framing before 7-bit unpacking. Malformed
 * inbound frames must never be forwarded as trusted FILE payloads.
 * @param {unknown} value
 * @param {number} payloadOffset  First packed byte (past response status).
 */
export function isValidTeWireFrame(value,payloadOffset){
  if(!(value instanceof Uint8Array)||value.length<10||value[0]!==0xf0||value.at(-1)!==0xf7)
    return false;
  for(let index=1;index<value.length-1;index++)if(value[index]>0x7f)return false;
  if(payloadOffset>value.length-1)return false;
  const length=value.length-1-payloadOffset;
  return length===0||(length>=2&&length%8!==1);
}
