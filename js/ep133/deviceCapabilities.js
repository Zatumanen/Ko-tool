import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK
}from './constants.js?v=20261001-1';
import{
  CAPABILITY_KEYS,resolveRegisteredCapabilityEvidence
}from './evidenceRegistry.js?v=20261001-1';

const evidenceKeys=Object.freeze({
  sampleMetadata:CAPABILITY_KEYS.SAMPLE_METADATA,
  sampleTransfers:CAPABILITY_KEYS.SAMPLE_TRANSFERS,
  sampleBars:CAPABILITY_KEYS.SAMPLE_BARS,
  projectTransport:CAPABILITY_KEYS.PROJECT_TRANSPORT,
  projectAuthoring:CAPABILITY_KEYS.PROJECT_AUTHORING,
  projectReload:CAPABILITY_KEYS.PROJECT_RELOAD,
  sceneTimeSignature:CAPABILITY_KEYS.SCENE_TIME_SIGNATURE,
  liveWithPatterns:CAPABILITY_KEYS.LIVE_WITH_PATTERNS,
  liveWithFx:CAPABILITY_KEYS.LIVE_WITH_FX
});

export function decodeFileRights(mask=0){
  const value=Number(mask)||0;
  return Object.freeze({
    read:(value&TE_SYSEX_FILE_CAPABILITY_READ)!==0,
    write:(value&TE_SYSEX_FILE_CAPABILITY_WRITE)!==0,
    delete:(value&TE_SYSEX_FILE_CAPABILITY_DELETE)!==0,
    move:(value&TE_SYSEX_FILE_CAPABILITY_MOVE)!==0,
    playback:(value&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)!==0
  });
}

export function resolveDeviceCapabilities({sku='',firmware='',fileCapabilities=0}={}){
  const normalizedSku=String(sku||'').toUpperCase();
  const normalizedFirmware=String(firmware||'');
  const evidence={};
  for(const[name,capability]of Object.entries(evidenceKeys)){
    evidence[name]=resolveRegisteredCapabilityEvidence(normalizedSku,capability,normalizedFirmware);
  }
  return Object.freeze({
    sku:normalizedSku,
    firmware:normalizedFirmware,
    fileRights:decodeFileRights(fileCapabilities),
    evidence:Object.freeze(evidence)
  });
}
