import{
  CAPABILITY_EVIDENCE,capabilityEvidence,cloneCapabilityEvidence,
  canReadCapability,canPreserveCapability,canWriteCapability,
  assertCapabilityReadable,assertCapabilityWritable
}from './capabilityEvidence.js?v=20260930-2';

const SHARED_SETTINGS_SIZES=Object.freeze([222,224]);
const SHARED_FX_SIZES=Object.freeze([144,152,160]);

const hw=(source,extra={})=>capabilityEvidence(CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{read:true,preserve:true,source,...extra});
const unverified=(reason,{read=false,preserve=false,source=''}={})=>capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED,{read,preserve,source,reason});
const observed=(source)=>capabilityEvidence(CAPABILITY_EVIDENCE.CAPTURE_OBSERVED,{read:true,preserve:true,source});

const EP133_EVIDENCE=Object.freeze({
  projectTransport:hw('whole-project FILE read/write HIL on EP-133, including OS 2.5.1'),
  projectAuthoring:hw('write → reload → readback → activate → play HIL on EP-133'),
  projectReload:hw('active project/group/pad metadata cycle live-verified on EP-133'),
  sceneTimeSignature:hw('EP-133 scene time-signature authoring HIL'),
  liveWithPatterns:unverified('EP-133 live member authoring is not verified.'),
  liveWithFx:unverified('EP-133 live + fx structure is not verified.')
});
const EP1320_EVIDENCE=Object.freeze({
  projectTransport:unverified(
    'EP-1320 project transport has not been hardware-probed; read-only preservation remains enabled.',
    {read:true,preserve:true,source:'shared EP-series FILE shape; EP-1320 project format assumption is experimental'}
  ),
  projectAuthoring:unverified('EP-1320 project authoring has not been hardware-verified.'),
  projectReload:unverified('EP-1320 project reload/activation is not hardware-verified.'),
  sceneTimeSignature:unverified('EP-1320 scene time-signature authoring has not been hardware-verified.'),
  liveWithPatterns:unverified('EP-1320 live member structure is unverified.'),
  liveWithFx:unverified('EP-1320 live + fx structure is unverified.')
});
const EP40_EVIDENCE=Object.freeze({
  projectTransport:hw('whole-project FILE read/write HIL on EP-40 OS 2.5.1'),
  projectAuthoring:hw('write → reload → readback → activate → play HIL on EP-40'),
  projectReload:hw('active project/group/pad metadata cycle live-verified on EP-40'),
  sceneTimeSignature:unverified('EP-40 scene time-signature authoring is not hardware-verified.',{read:true,preserve:true}),
  liveWithPatterns:observed('native EP-40 live + populated patterns observed in captured projects'),
  liveWithFx:observed('native EP-40 live + fx_settings observed in captured projects')
});

const PROFILES=Object.freeze({
  TE032AS001:Object.freeze({
    sku:'TE032AS001',id:'ep133',evidence:EP133_EVIDENCE,
    padRecordSize:26,acceptedPadRecordSizes:Object.freeze([26]),
    patternDialect:'ep133',patternHeaderSize:4,
    settingsSizes:SHARED_SETTINGS_SIZES,fxSettingsSizes:SHARED_FX_SIZES,scenesSize:712,
    supportsLoop:false,supportsSupertone:false,supportsLive:false,
    requiresFullSceneRefs:true,crossFirmwareScenes:false
  }),
  TE032AS005:Object.freeze({
    sku:'TE032AS005',id:'ep1320',evidence:EP1320_EVIDENCE,
    padRecordSize:null,acceptedPadRecordSizes:Object.freeze([]),
    patternDialect:'unverified',patternHeaderSize:null,
    settingsSizes:Object.freeze([]),fxSettingsSizes:Object.freeze([]),scenesSize:null,
    supportsLoop:false,supportsSupertone:false,supportsLive:false,
    requiresFullSceneRefs:true,crossFirmwareScenes:false,
    reason:'EP-1320 project authoring has not been hardware-verified.'
  }),
  TE032AS006:Object.freeze({
    sku:'TE032AS006',id:'ep40',evidence:EP40_EVIDENCE,
    padRecordSize:29,acceptedPadRecordSizes:Object.freeze([29]),
    patternDialect:'ep40',patternHeaderSize:6,
    settingsSizes:SHARED_SETTINGS_SIZES,fxSettingsSizes:SHARED_FX_SIZES,scenesSize:712,
    supportsLoop:true,supportsSupertone:true,supportsLive:true,
    requiresFullSceneRefs:true,crossFirmwareScenes:false
  })
});

const UNKNOWN=unverified('The connected EP project format has not been hardware-verified.');
const GENERIC=Object.freeze({
  sku:'',id:'ep',
  evidence:Object.freeze({
    projectTransport:UNKNOWN,projectAuthoring:UNKNOWN,projectReload:UNKNOWN,
    sceneTimeSignature:UNKNOWN,liveWithPatterns:UNKNOWN,liveWithFx:UNKNOWN
  }),
  padRecordSize:null,acceptedPadRecordSizes:Object.freeze([]),
  patternDialect:'unverified',patternHeaderSize:null,
  settingsSizes:Object.freeze([]),fxSettingsSizes:Object.freeze([]),scenesSize:null,
  supportsLoop:false,supportsSupertone:false,supportsLive:false,
  requiresFullSceneRefs:true,crossFirmwareScenes:false,
  reason:'The connected EP project format has not been hardware-verified.'
});

const clone=profile=>{
  const evidence=Object.fromEntries(
    Object.entries(profile.evidence||{}).map(([key,value])=>[key,cloneCapabilityEvidence(value)])
  );
  return{
    ...profile,
    evidence,
    acceptedPadRecordSizes:[...profile.acceptedPadRecordSizes],
    settingsSizes:[...profile.settingsSizes],
    fxSettingsSizes:[...profile.fxSettingsSizes],
    projectTransport:canReadCapability(evidence.projectTransport),
    projectAuthoring:canWriteCapability(evidence.projectAuthoring),
    projectReloadVerified:canWriteCapability(evidence.projectReload),
    sceneTimeSignatureAuthoring:canWriteCapability(evidence.sceneTimeSignature),
    nativeLiveWithPatternsObserved:canPreserveCapability(evidence.liveWithPatterns),
    nativeLiveWithFxObserved:canPreserveCapability(evidence.liveWithFx)
  };
};

export function getEpProjectProfile(sku='',firmware=''){
  const key=String(sku||'').toUpperCase();
  const profile=PROFILES[key]||GENERIC;
  return{...clone(profile),sku:key||profile.sku,firmware:String(firmware||'')};
}

export function assertProjectTransportSupported(sku='',firmware=''){
  const profile=getEpProjectProfile(sku,firmware);
  assertCapabilityReadable(profile.evidence.projectTransport,'Project FILE transport');
  return profile;
}

export function assertProjectAuthoringSupported(sku='',firmware=''){
  const profile=assertProjectTransportSupported(sku,firmware);
  assertCapabilityWritable(profile.evidence.projectAuthoring,'Project');
  return profile;
}

export function assertProjectReloadSupported(sku='',firmware=''){
  const profile=assertProjectTransportSupported(sku,firmware);
  assertCapabilityWritable(profile.evidence.projectReload,'Project reload/activation');
  return profile;
}
