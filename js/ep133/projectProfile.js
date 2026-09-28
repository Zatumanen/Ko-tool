const SHARED_SETTINGS_SIZES=Object.freeze([222,224]);
const SHARED_FX_SIZES=Object.freeze([144,152,160]);

const PROFILES=Object.freeze({
  TE032AS001:Object.freeze({
    sku:'TE032AS001',
    id:'ep133',
    projectTransport:true,
    projectAuthoring:true,
    projectReloadVerified:true,
    padRecordSize:26,
    acceptedPadRecordSizes:Object.freeze([26]),
    patternDialect:'ep133',
    patternHeaderSize:4,
    settingsSizes:SHARED_SETTINGS_SIZES,
    fxSettingsSizes:SHARED_FX_SIZES,
    scenesSize:712,
    supportsLoop:false,
    supportsSupertone:false,
    supportsLive:false,
    requiresFullSceneRefs:true,
    crossFirmwareScenes:false
  }),
  TE032AS005:Object.freeze({
    sku:'TE032AS005',
    id:'ep1320',
    projectTransport:true,
    projectAuthoring:false,
    projectReloadVerified:false,
    padRecordSize:null,
    acceptedPadRecordSizes:Object.freeze([]),
    patternDialect:'unverified',
    patternHeaderSize:null,
    settingsSizes:Object.freeze([]),
    fxSettingsSizes:Object.freeze([]),
    scenesSize:null,
    supportsLoop:false,
    supportsSupertone:false,
    supportsLive:false,
    requiresFullSceneRefs:true,
    crossFirmwareScenes:false,
    reason:'EP-1320 project authoring has not been hardware-verified.'
  }),
  TE032AS006:Object.freeze({
    sku:'TE032AS006',
    id:'ep40',
    projectTransport:true,
    projectAuthoring:true,
    projectReloadVerified:true,
    padRecordSize:29,
    acceptedPadRecordSizes:Object.freeze([29]),
    patternDialect:'ep40',
    patternHeaderSize:6,
    settingsSizes:SHARED_SETTINGS_SIZES,
    fxSettingsSizes:SHARED_FX_SIZES,
    scenesSize:712,
    supportsLoop:true,
    supportsSupertone:true,
    supportsLive:true,
    requiresFullSceneRefs:true,
    crossFirmwareScenes:false
  })
});

const GENERIC=Object.freeze({
  sku:'',
  id:'ep',
  projectTransport:false,
  projectAuthoring:false,
  projectReloadVerified:false,
  padRecordSize:null,
  acceptedPadRecordSizes:Object.freeze([]),
  patternDialect:'unverified',
  patternHeaderSize:null,
  settingsSizes:Object.freeze([]),
  fxSettingsSizes:Object.freeze([]),
  scenesSize:null,
  supportsLoop:false,
  supportsSupertone:false,
  supportsLive:false,
  requiresFullSceneRefs:true,
  crossFirmwareScenes:false,
  reason:'The connected EP project format has not been hardware-verified.'
});

const clone=profile=>({
  ...profile,
  acceptedPadRecordSizes:[...profile.acceptedPadRecordSizes],
  settingsSizes:[...profile.settingsSizes],
  fxSettingsSizes:[...profile.fxSettingsSizes]
});

export function getEpProjectProfile(sku='',firmware=''){
  const key=String(sku||'').toUpperCase();
  const profile=PROFILES[key]||GENERIC;
  return{...clone(profile),sku:key||profile.sku,firmware:String(firmware||'')};
}

export function assertProjectTransportSupported(sku='',firmware=''){
  const profile=getEpProjectProfile(sku,firmware);
  if(!profile.projectTransport)
    throw new Error('Project FILE transport is not supported for '+(profile.sku||'this EP')+'.');
  return profile;
}

export function assertProjectAuthoringSupported(sku='',firmware=''){
  const profile=assertProjectTransportSupported(sku,firmware);
  if(!profile.projectAuthoring)
    throw new Error(profile.reason||('Project authoring is not verified for '+(profile.sku||'this EP')+'.'));
  return profile;
}

export function assertProjectReloadSupported(sku='',firmware=''){
  const profile=assertProjectTransportSupported(sku,firmware);
  if(!profile.projectReloadVerified)
    throw new Error('Project reload/activation is not hardware-verified for '+(profile.sku||'this EP')+'.');
  return profile;
}
