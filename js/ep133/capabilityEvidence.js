export const CAPABILITY_EVIDENCE=Object.freeze({
  HARDWARE_VERIFIED:'hardware-verified',
  OFFICIAL_TOOL_OBSERVED:'official-tool-observed',
  CAPTURE_OBSERVED:'capture-observed',
  PRESERVE_ONLY:'preserve-only',
  UNVERIFIED:'unverified',
  UNSAFE:'unsafe'
});

const LEVELS=new Set(Object.values(CAPABILITY_EVIDENCE));

export function capabilityEvidence(level,{read=false,preserve=false,source='',reason=''}={}){
  const normalized=String(level||'');
  if(!LEVELS.has(normalized))throw new Error('Unknown capability evidence level: '+normalized);
  const unsafe=normalized===CAPABILITY_EVIDENCE.UNSAFE;
  return Object.freeze({
    level:normalized,
    read:!unsafe&&read===true,
    preserve:!unsafe&&preserve===true,
    write:normalized===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,
    source:String(source||''),
    reason:String(reason||'')
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
      reason:evidence.reason
    }
  );
}

export function canReadCapability(evidence){return cloneCapabilityEvidence(evidence).read===true;}
export function canPreserveCapability(evidence){return cloneCapabilityEvidence(evidence).preserve===true;}
export function canWriteCapability(evidence){
  const normalized=cloneCapabilityEvidence(evidence);
  return normalized.level===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED&&normalized.write===true;
}

export function assertCapabilityReadable(evidence,label='capability'){
  const normalized=cloneCapabilityEvidence(evidence);
  if(!normalized.read)throw new Error((normalized.reason||String(label)+' is not verified for reading.')+' ['+normalized.level+']');
  return normalized;
}

export function assertCapabilityWritable(evidence,label='capability'){
  const normalized=cloneCapabilityEvidence(evidence);
  if(!canWriteCapability(normalized))
    throw new Error((normalized.reason||String(label)+' authoring is not hardware-verified.')+' ['+normalized.level+']');
  return normalized;
}
