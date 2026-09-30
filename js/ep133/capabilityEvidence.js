export const CAPABILITY_EVIDENCE=Object.freeze({
  HARDWARE_VERIFIED:'hardware-verified',
  OFFICIAL_TOOL_OBSERVED:'official-tool-observed',
  CAPTURE_OBSERVED:'capture-observed',
  PRESERVE_ONLY:'preserve-only',
  UNVERIFIED:'unverified',
  UNSAFE:'unsafe'
});

const LEVELS=new Set(Object.values(CAPABILITY_EVIDENCE));
const VERSION_PATTERN=/^\d+(?:\.\d+)*$/;

const normalizeVersion=value=>{
  const version=String(value||'').trim();
  return VERSION_PATTERN.test(version)?version:'';
};
const versionParts=value=>normalizeVersion(value).split('.').map(Number);

export function compareFirmwareVersions(a,b){
  const left=normalizeVersion(a),right=normalizeVersion(b);
  if(!left||!right)return null;
  const pa=versionParts(left),pb=versionParts(right);
  const length=Math.max(pa.length,pb.length);
  for(let index=0;index<length;index++){
    const x=Number.isFinite(pa[index])?pa[index]:0;
    const y=Number.isFinite(pb[index])?pb[index]:0;
    if(x!==y)return x-y;
  }
  return 0;
}

export function normalizeFirmwareRange(range=null){
  if(range==null||range==='')return null;
  const source=typeof range==='string'?{exact:range}:range;
  if(!source||typeof source!=='object')throw new Error('Firmware evidence range must be a version string or range object.');
  const exact=normalizeVersion(source.exact);
  const min=normalizeVersion(exact||source.min);
  const max=normalizeVersion(exact||source.max);
  if(!min&&!max)throw new Error('Firmware evidence range requires a valid min, max, or exact version.');
  if(min&&max&&compareFirmwareVersions(min,max)>0)throw new Error('Firmware evidence range minimum exceeds maximum.');
  return Object.freeze({min:min||null,max:max||null});
}

export function firmwareMatchesRange(firmware,range=null){
  const normalizedRange=normalizeFirmwareRange(range);
  if(!normalizedRange)return true;
  const version=normalizeVersion(firmware);
  if(!version)return false;
  if(normalizedRange.min&&compareFirmwareVersions(version,normalizedRange.min)<0)return false;
  if(normalizedRange.max&&compareFirmwareVersions(version,normalizedRange.max)>0)return false;
  return true;
}

const rangeLabel=range=>{
  if(!range)return'';
  if(range.min&&range.max&&range.min===range.max)return range.min;
  if(range.min&&range.max)return range.min+'–'+range.max;
  if(range.min)return'>='+range.min;
  return'<='+range.max;
};

export function capabilityEvidence(level,{
  read=false,preserve=false,source='',reason='',firmwareRange=null
}={}){
  const normalized=String(level||'');
  if(!LEVELS.has(normalized))throw new Error('Unknown capability evidence level: '+normalized);
  const unsafe=normalized===CAPABILITY_EVIDENCE.UNSAFE;
  const range=normalizeFirmwareRange(firmwareRange);
  return Object.freeze({
    level:normalized,
    read:!unsafe&&read===true,
    preserve:!unsafe&&preserve===true,
    write:normalized===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,
    source:String(source||''),
    reason:String(reason||''),
    firmwareRange:range
  });
}

export function cloneCapabilityEvidence(evidence){
  if(!evidence||typeof evidence!=='object')return capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED);
  return capabilityEvidence(
    evidence.level||CAPABILITY_EVIDENCE.UNVERIFIED,
    {
      read:evidence.read===true,
      preserve:evidence.preserve===true,
      source:evidence.source,
      reason:evidence.reason,
      firmwareRange:evidence.firmwareRange
    }
  );
}

export function resolveCapabilityEvidence(evidence,firmware=''){
  const base=cloneCapabilityEvidence(evidence);
  const version=normalizeVersion(firmware);
  if(!base.firmwareRange)return Object.freeze({
    ...base,
    baseLevel:base.level,
    firmware:version,
    firmwareMatch:null
  });
  if(firmwareMatchesRange(version,base.firmwareRange))return Object.freeze({
    ...base,
    baseLevel:base.level,
    firmware:version,
    firmwareMatch:true
  });

  const expected=rangeLabel(base.firmwareRange);
  const actual=version||'unknown';
  const scopeReason='Connected firmware '+actual+' is outside the verified firmware evidence '+expected+'. Authoring is disabled until this firmware is verified.';
  return Object.freeze({
    ...base,
    baseLevel:base.level,
    level:base.level===CAPABILITY_EVIDENCE.UNSAFE?CAPABILITY_EVIDENCE.UNSAFE:CAPABILITY_EVIDENCE.UNVERIFIED,
    write:false,
    firmware:version,
    firmwareMatch:false,
    reason:scopeReason
  });
}

export function canReadCapability(evidence){return cloneCapabilityEvidence(evidence).read===true;}
export function canPreserveCapability(evidence){return cloneCapabilityEvidence(evidence).preserve===true;}
export function canWriteCapability(evidence){
  const normalized=cloneCapabilityEvidence(evidence);
  return normalized.level===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED&&normalized.write===true;
}

export function assertCapabilityReadable(evidence,label='capability'){
  const normalized=evidence?.firmwareMatch===false?evidence:cloneCapabilityEvidence(evidence);
  if(!normalized.read)throw new Error((normalized.reason||String(label)+' is not verified for reading.')+' ['+normalized.level+']');
  return normalized;
}

export function assertCapabilityWritable(evidence,label='capability'){
  const normalized=evidence?.firmwareMatch===false?evidence:cloneCapabilityEvidence(evidence);
  if(!canWriteCapability(normalized))
    throw new Error((normalized.reason||String(label)+' authoring is not hardware-verified.')+' ['+normalized.level+']');
  return normalized;
}
