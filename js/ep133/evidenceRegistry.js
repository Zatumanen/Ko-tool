import{
  CAPABILITY_EVIDENCE,capabilityEvidence,firmwareMatchesRange,resolveCapabilityEvidence
}from './capabilityEvidence.js?v=20261001-1';
import{CAPABILITY_KEYS,SUPPORTED_EP_SKUS}from './deviceCompatibilityMatrix.js?v=20261008-1';
export{CAPABILITY_KEYS};


const RECORDED_AT='2026-09-30';
const KNOWN_SKUS=new Set(SUPPORTED_EP_SKUS);
const KNOWN_CAPABILITIES=new Set(Object.values(CAPABILITY_KEYS));
const SOURCE_TYPES=new Set(['hil','capture','device-observation','shared-protocol','unverified']);

const entry=(id,sku,capability,level,{
  read=false,preserve=false,source='',reason='',firmwareRange=null,
  sourceType='unverified',artifactId=null,recordedAt=RECORDED_AT
}={})=>Object.freeze({
  id:String(id||''),
  sku:String(sku||'').toUpperCase(),
  capability:String(capability||''),
  level,
  read:read===true,
  write:level===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,
  preserve:preserve===true,
  source:String(source||''),
  reason:String(reason||''),
  firmwareRange,
  sourceType:String(sourceType||''),
  artifactId:artifactId==null?null:String(artifactId),
  recordedAt:String(recordedAt||'')
});

const sampleBars=(sku)=>entry(
  sku.toLowerCase()+'-sample-bars-preserve',
  sku,CAPABILITY_KEYS.SAMPLE_BARS,CAPABILITY_EVIDENCE.PRESERVE_ONLY,{
    read:true,preserve:true,sourceType:'device-observation',
    source:'hardware-observed power-of-2 clamp; exact slot authoring values unverified',
    reason:'Sample bar authoring values are preserve-only until dedicated HIL verification.'
  }
);

export const EVIDENCE_REGISTRY=Object.freeze([
  entry('ep133-sample-metadata-os-2.5.1','TE032AS001',CAPABILITY_KEYS.SAMPLE_METADATA,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'ep-series-sysex live verification on EP-133 OS 2.5.1'
  }),
  entry('ep133-sample-transfers-os-2.5.1','TE032AS001',CAPABILITY_KEYS.SAMPLE_TRANSFERS,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'live-verified FILE sample library operations on EP-133 OS 2.5.1'
  }),
  sampleBars('TE032AS001'),

  entry('ep1320-sample-metadata-unverified','TE032AS005',CAPABILITY_KEYS.SAMPLE_METADATA,CAPABILITY_EVIDENCE.UNVERIFIED,{
    read:true,preserve:true,sourceType:'shared-protocol',
    source:'shared EP-series FILE shape; no EP-1320 HIL campaign',
    reason:'Advanced sample metadata authoring is not hardware-verified for this EP.'
  }),
  entry('ep1320-sample-transfers-unverified','TE032AS005',CAPABILITY_KEYS.SAMPLE_TRANSFERS,CAPABILITY_EVIDENCE.UNVERIFIED,{
    read:true,preserve:true,sourceType:'shared-protocol',
    source:'shared EP-series FILE shape; no EP-1320 HIL campaign',
    reason:'Sample transfer authoring is not hardware-verified for this EP.'
  }),
  sampleBars('TE032AS005'),

  entry('ep40-sample-metadata-os-2.5.1','TE032AS006',CAPABILITY_KEYS.SAMPLE_METADATA,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'ep-series-sysex live verification on EP-40 OS 2.5.1'
  }),
  entry('ep40-sample-transfers-os-2.5.1','TE032AS006',CAPABILITY_KEYS.SAMPLE_TRANSFERS,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'live-verified FILE sample library operations on EP-40 OS 2.5.1'
  }),
  sampleBars('TE032AS006'),

  entry('ep133-project-transport-os-2.5.1','TE032AS001',CAPABILITY_KEYS.PROJECT_TRANSPORT,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'whole-project FILE read/write HIL on EP-133, including OS 2.5.1'
  }),
  entry('ep133-project-authoring-os-2.5.1','TE032AS001',CAPABILITY_KEYS.PROJECT_AUTHORING,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'write → reload → readback → activate → play HIL on EP-133'
  }),
  entry('ep133-project-reload-os-2.5.1','TE032AS001',CAPABILITY_KEYS.PROJECT_RELOAD,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'active project/group/pad metadata cycle live-verified on EP-133'
  }),
  entry('ep133-scene-time-signature-os-2.5.1','TE032AS001',CAPABILITY_KEYS.SCENE_TIME_SIGNATURE,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'EP-133 scene time-signature authoring HIL'
  }),
  entry('ep133-live-patterns-unverified','TE032AS001',CAPABILITY_KEYS.LIVE_WITH_PATTERNS,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-133 live member authoring is not verified.'
  }),
  entry('ep133-live-fx-unverified','TE032AS001',CAPABILITY_KEYS.LIVE_WITH_FX,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-133 live + fx structure is not verified.'
  }),

  entry('ep1320-project-transport-unverified','TE032AS005',CAPABILITY_KEYS.PROJECT_TRANSPORT,CAPABILITY_EVIDENCE.UNVERIFIED,{
    read:true,preserve:true,sourceType:'shared-protocol',
    source:'shared EP-series FILE shape; EP-1320 project format assumption is experimental',
    reason:'EP-1320 project transport has not been hardware-probed; read-only preservation remains enabled.'
  }),
  entry('ep1320-project-authoring-unverified','TE032AS005',CAPABILITY_KEYS.PROJECT_AUTHORING,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-1320 project authoring has not been hardware-verified.'
  }),
  entry('ep1320-project-reload-unverified','TE032AS005',CAPABILITY_KEYS.PROJECT_RELOAD,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-1320 project reload/activation is not hardware-verified.'
  }),
  entry('ep1320-scene-time-signature-unverified','TE032AS005',CAPABILITY_KEYS.SCENE_TIME_SIGNATURE,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-1320 scene time-signature authoring has not been hardware-verified.'
  }),
  entry('ep1320-live-patterns-unverified','TE032AS005',CAPABILITY_KEYS.LIVE_WITH_PATTERNS,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-1320 live member structure is unverified.'
  }),
  entry('ep1320-live-fx-unverified','TE032AS005',CAPABILITY_KEYS.LIVE_WITH_FX,CAPABILITY_EVIDENCE.UNVERIFIED,{
    sourceType:'unverified',reason:'EP-1320 live + fx structure is unverified.'
  }),

  entry('ep40-project-transport-os-2.5.1','TE032AS006',CAPABILITY_KEYS.PROJECT_TRANSPORT,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'whole-project FILE read/write HIL on EP-40 OS 2.5.1'
  }),
  entry('ep40-project-authoring-os-2.5.1','TE032AS006',CAPABILITY_KEYS.PROJECT_AUTHORING,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'write → reload → readback → activate → play HIL on EP-40'
  }),
  entry('ep40-project-reload-os-2.5.1','TE032AS006',CAPABILITY_KEYS.PROJECT_RELOAD,CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'hil',
    source:'active project/group/pad metadata cycle live-verified on EP-40'
  }),
  entry('ep40-scene-time-signature-unverified','TE032AS006',CAPABILITY_KEYS.SCENE_TIME_SIGNATURE,CAPABILITY_EVIDENCE.UNVERIFIED,{
    read:true,preserve:true,sourceType:'unverified',
    reason:'EP-40 scene time-signature authoring is not hardware-verified.'
  }),
  entry('ep40-live-patterns-os-2.5.1','TE032AS006',CAPABILITY_KEYS.LIVE_WITH_PATTERNS,CAPABILITY_EVIDENCE.CAPTURE_OBSERVED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'capture',
    source:'native EP-40 live + populated patterns observed in captured projects'
  }),
  entry('ep40-live-fx-os-2.5.1','TE032AS006',CAPABILITY_KEYS.LIVE_WITH_FX,CAPABILITY_EVIDENCE.CAPTURE_OBSERVED,{
    read:true,preserve:true,firmwareRange:'2.5.1',sourceType:'capture',
    source:'native EP-40 live + fx_settings observed in captured projects'
  })
]);

const toEvidence=record=>capabilityEvidence(record.level,{
  read:record.read,
  preserve:record.preserve,
  source:record.source,
  reason:record.reason,
  firmwareRange:record.firmwareRange,
  evidenceId:record.id,
  sourceType:record.sourceType,
  artifactId:record.artifactId,
  recordedAt:record.recordedAt
});

export function validateEvidenceRegistry(registry=EVIDENCE_REGISTRY){
  const ids=new Set();
  const identities=new Set();
  for(const record of registry){
    if(!record?.id)throw new Error('Evidence registry entry requires a stable id.');
    if(ids.has(record.id))throw new Error('Duplicate evidence registry id: '+record.id);
    ids.add(record.id);
    if(!KNOWN_SKUS.has(record.sku))throw new Error('Unknown evidence registry SKU: '+record.sku);
    if(!KNOWN_CAPABILITIES.has(record.capability))throw new Error('Unknown evidence registry capability: '+record.capability);
    if(!SOURCE_TYPES.has(record.sourceType))throw new Error('Unknown evidence source type: '+record.sourceType);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(record.recordedAt))throw new Error('Evidence registry entry '+record.id+' requires YYYY-MM-DD recordedAt.');
    const evidence=toEvidence(record);
    if(record.write!==canWriteCapabilityForRegistry(evidence))
      throw new Error('Evidence registry write right is inconsistent for '+record.id+'.');
    if(evidence.level===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED){
      if(!evidence.source)throw new Error('Hardware-verified evidence '+record.id+' requires a source description.');
      if(!evidence.firmwareRange)throw new Error('Hardware-verified evidence '+record.id+' requires a firmware range.');
      if(record.sourceType!=='hil')throw new Error('Hardware-verified evidence '+record.id+' must be backed by HIL.');
    }
    const range=JSON.stringify(evidence.firmwareRange);
    const identity=[record.sku,record.capability,range].join('|');
    if(identities.has(identity))throw new Error('Duplicate evidence scope: '+identity);
    identities.add(identity);
  }
  for(const sku of KNOWN_SKUS){
    for(const capability of KNOWN_CAPABILITIES){
      if(!registry.some(record=>record.sku===sku&&record.capability===capability))
        throw new Error('Evidence registry is missing '+sku+' '+capability+'.');
    }
  }
  return true;
}

const canWriteCapabilityForRegistry=evidence=>
  evidence.level===CAPABILITY_EVIDENCE.HARDWARE_VERIFIED&&evidence.write===true;

validateEvidenceRegistry();

const byCapability=(sku,capability)=>EVIDENCE_REGISTRY.filter(record=>
  record.sku===String(sku||'').toUpperCase()&&record.capability===String(capability||'')
);

export function listCapabilityEvidence({sku='',capability=''}={}){
  return EVIDENCE_REGISTRY.filter(record=>
    (!sku||record.sku===String(sku).toUpperCase())&&
    (!capability||record.capability===String(capability))
  ).map(record=>{
    const evidence=toEvidence(record);
    return{
      ...record,
      firmwareRange:evidence.firmwareRange&&{...evidence.firmwareRange},
      rights:Object.freeze({read:evidence.read,write:evidence.write,preserve:evidence.preserve})
    };
  });
}

export function resolveRegisteredCapabilityEvidence(sku,capability,firmware=''){
  const candidates=byCapability(sku,capability);
  if(!candidates.length)return capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED,{
    reason:'No evidence registry entry exists for '+String(capability||'this capability')+' on '+String(sku||'this EP')+'.'
  });

  const version=String(firmware||'');
  const matching=candidates.find(record=>record.firmwareRange&&firmwareMatchesRange(version,record.firmwareRange));
  const unscoped=candidates.find(record=>!record.firmwareRange);
  const selected=matching||unscoped||candidates[0];
  return resolveCapabilityEvidence(toEvidence(selected),version);
}
