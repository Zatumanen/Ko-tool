import{
  canReadCapability,canPreserveCapability,canWriteCapability,
  assertCapabilityReadable,assertCapabilityWritable
}from './capabilityEvidence.js?v=20260930-5';
import{
  CAPABILITY_KEYS,resolveRegisteredCapabilityEvidence
}from './evidenceRegistry.js?v=20260930-5';

const SHARED_SETTINGS_SIZES=Object.freeze([222,224]);
const SHARED_FX_SIZES=Object.freeze([144,152,160]);

const PROFILES=Object.freeze({
  TE032AS001:Object.freeze({
    sku:'TE032AS001',id:'ep133',
    padRecordSize:26,acceptedPadRecordSizes:Object.freeze([26]),
    patternDialect:'ep133',patternHeaderSize:4,
    settingsSizes:SHARED_SETTINGS_SIZES,fxSettingsSizes:SHARED_FX_SIZES,scenesSize:712,
    supportsLoop:false,supportsSupertone:false,supportsLive:false,
    requiresFullSceneRefs:true,crossFirmwareScenes:false
  }),
  TE032AS005:Object.freeze({
    sku:'TE032AS005',id:'ep1320',
    padRecordSize:null,acceptedPadRecordSizes:Object.freeze([]),
    patternDialect:'unverified',patternHeaderSize:null,
    settingsSizes:Object.freeze([]),fxSettingsSizes:Object.freeze([]),scenesSize:null,
    supportsLoop:false,supportsSupertone:false,supportsLive:false,
    requiresFullSceneRefs:true,crossFirmwareScenes:false,
    reason:'EP-1320 project authoring has not been hardware-verified.'
  }),
  TE032AS006:Object.freeze({
    sku:'TE032AS006',id:'ep40',
    padRecordSize:29,acceptedPadRecordSizes:Object.freeze([29]),
    patternDialect:'ep40',patternHeaderSize:6,
    settingsSizes:SHARED_SETTINGS_SIZES,fxSettingsSizes:SHARED_FX_SIZES,scenesSize:712,
    supportsLoop:true,supportsSupertone:true,supportsLive:true,
    requiresFullSceneRefs:true,crossFirmwareScenes:false
  })
});

const GENERIC=Object.freeze({
  sku:'',id:'ep',
  padRecordSize:null,acceptedPadRecordSizes:Object.freeze([]),
  patternDialect:'unverified',patternHeaderSize:null,
  settingsSizes:Object.freeze([]),fxSettingsSizes:Object.freeze([]),scenesSize:null,
  supportsLoop:false,supportsSupertone:false,supportsLive:false,
  requiresFullSceneRefs:true,crossFirmwareScenes:false,
  reason:'The connected EP project format has not been hardware-verified.'
});

const evidenceFor=(sku,firmware)=>({
  projectTransport:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.PROJECT_TRANSPORT,firmware),
  projectAuthoring:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.PROJECT_AUTHORING,firmware),
  projectReload:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.PROJECT_RELOAD,firmware),
  sceneTimeSignature:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.SCENE_TIME_SIGNATURE,firmware),
  liveWithPatterns:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.LIVE_WITH_PATTERNS,firmware),
  liveWithFx:resolveRegisteredCapabilityEvidence(sku,CAPABILITY_KEYS.LIVE_WITH_FX,firmware)
});

const clone=(profile,firmware='')=>{
  const evidence=evidenceFor(profile.sku,firmware);
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
  const version=String(firmware||'');
  return{...clone(profile,version),sku:key||profile.sku,firmware:version};
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
