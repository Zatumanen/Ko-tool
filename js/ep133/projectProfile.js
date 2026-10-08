import{
  canReadCapability,canPreserveCapability,canWriteCapability,
  assertCapabilityReadable,assertCapabilityWritable
}from './capabilityEvidence.js?v=20261001-1';
import{resolveDeviceCapabilities}from './deviceCapabilities.js?v=20261001-1';
import{getEpCompatibility,GENERIC_EP_PROJECT,normalizeEpSku}from './deviceCompatibilityMatrix.js?v=20261008-1';

const clone=(profile,firmware='')=>{
  const all=resolveDeviceCapabilities({sku:profile.sku,firmware});
  const{
    projectTransport,projectAuthoring,projectReload,sceneTimeSignature,
    liveWithPatterns,liveWithFx
  }=all.evidence;
  const evidence={projectTransport,projectAuthoring,projectReload,sceneTimeSignature,liveWithPatterns,liveWithFx};
  return{
    ...profile,evidence,
    acceptedPadRecordSizes:[...profile.acceptedPadRecordSizes],
    settingsSizes:[...profile.settingsSizes],
    fxSettingsSizes:[...profile.fxSettingsSizes],
    projectTransport:canReadCapability(projectTransport),
    projectAuthoring:canWriteCapability(projectAuthoring),
    projectReloadVerified:canWriteCapability(projectReload),
    sceneTimeSignatureAuthoring:canWriteCapability(sceneTimeSignature),
    nativeLiveWithPatternsObserved:canPreserveCapability(liveWithPatterns),
    nativeLiveWithFxObserved:canPreserveCapability(liveWithFx)
  };
};

export function getEpProjectProfile(sku='',firmware=''){
  const key=normalizeEpSku(sku),version=String(firmware||'');
  const profile=getEpCompatibility(key)?.project||GENERIC_EP_PROJECT;
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
