/**
 * Declarative EP-series compatibility data.
 *
 * This is the single source for supported SKU identities, minimum handshake
 * firmware, visible UI defaults and native project structure. A recognized
 * SKU/firmware does NOT authorize writes: capability authoring is separately
 * gated by firmware-scoped evidence in evidenceRegistry.js.
 */
import{compareFirmwareVersions}from './capabilityEvidence.js?v=20261001-1';

export const CAPABILITY_KEYS=Object.freeze({
  SAMPLE_METADATA:'sample.metadata',
  SAMPLE_TRANSFERS:'sample.transfers',
  SAMPLE_BARS:'sample.bars',
  PROJECT_TRANSPORT:'project.transport',
  PROJECT_AUTHORING:'project.authoring',
  PROJECT_RELOAD:'project.reload',
  SCENE_TIME_SIGNATURE:'project.scene-time-signature',
  LIVE_WITH_PATTERNS:'project.live-with-patterns',
  LIVE_WITH_FX:'project.live-with-fx'
});

export const CAPABILITY_NAMES=Object.freeze({
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

const COMMON_MODES=Object.freeze(['oneshot','key','legato']);
const SETTINGS_SIZES=Object.freeze([222,224]);
const FX_SIZES=Object.freeze([144,152,160]);
const GENERIC_TABS=Object.freeze([{name:'SAMPLES',range:Object.freeze([1,999]),color:1}]);
const EP133_TABS=Object.freeze([
  {name:'KICK',range:[1,99],color:1},
  {name:'SNARE',range:[100,199],color:1},
  {name:'CYMB',range:[200,299],color:1},
  {name:'PERC',range:[300,399],color:1},
  {name:'BASS',range:[400,499],color:1},
  {name:'MELOD',range:[500,599],color:1},
  {name:'LOOP',range:[600,699],color:1},
  {name:'USER 1',range:[700,799],color:2},
  {name:'USER 2',range:[800,899],color:2},
  {name:'SFX',range:[900,999],color:3}
]);
const EP1320_TABS=Object.freeze([
  {name:'DRUMS',range:[1,69],color:1},
  {name:'PHRASES',range:[70,114],color:1},
  {name:'INSTR',range:[115,127],color:1},
  {name:'ONE SHOT',range:[128,155],color:1},
  {name:'SFX',range:[156,220],color:1},
  {name:'USER',range:[221,999],color:2}
]);
const freezeTabs=tabs=>Object.freeze(tabs.map(tab=>Object.freeze({...tab,range:Object.freeze([...tab.range])})));
const ui=(id,title,name,modes,tabs)=>Object.freeze({
  id,title,name,playModes:Object.freeze([...modes]),fallbackTabs:freezeTabs(tabs),
  sampleBarWriteValues:Object.freeze([])
});
const project=(id,{
  padRecordSize=null,acceptedPadRecordSizes=[],patternDialect='unverified',
  patternHeaderSize=null,settingsSizes=[],fxSettingsSizes=[],scenesSize=null,
  supportsLoop=false,supportsSupertone=false,supportsLive=false,reason=''
}={})=>Object.freeze({
  id,padRecordSize,acceptedPadRecordSizes:Object.freeze([...acceptedPadRecordSizes]),
  patternDialect,patternHeaderSize,settingsSizes:Object.freeze([...settingsSizes]),
  fxSettingsSizes:Object.freeze([...fxSettingsSizes]),scenesSize,
  supportsLoop,supportsSupertone,supportsLive,
  requiresFullSceneRefs:true,crossFirmwareScenes:false,...(reason?{reason}:{})
});

const record=(sku,model,firmware,interfaceProfile,projectProfile)=>Object.freeze({
  sku,model,
  minimumFirmware:Object.freeze({...firmware}),
  ui:interfaceProfile,project:Object.freeze({sku,...projectProfile})
});
export const DEVICE_COMPATIBILITY_MATRIX=Object.freeze({
  TE032AS001:record('TE032AS001','EP-133',{
    beta:'0.100.38',production:'2.0.5'
  },ui('ep133','MY EP-133','K.O. II',COMMON_MODES,EP133_TABS),
  project('ep133',{
    padRecordSize:26,acceptedPadRecordSizes:[26],patternDialect:'ep133',patternHeaderSize:4,
    settingsSizes:SETTINGS_SIZES,fxSettingsSizes:FX_SIZES,scenesSize:712
  })),
  TE032AS005:record('TE032AS005','EP-1320',{
    beta:'0.2.13',production:'1.0.2'
  },ui('ep1320','MY EP-1320','MEDIEVAL',COMMON_MODES,EP1320_TABS),
  project('ep1320',{reason:'EP-1320 project authoring has not been hardware-verified.'})),
  TE032AS006:record('TE032AS006','EP-40',{
    beta:'0.4.7',production:'1.0.5'
  },ui('ep40','MY EP-40','RIDDIM',[...COMMON_MODES,'loop'],GENERIC_TABS),
  project('ep40',{
    padRecordSize:29,acceptedPadRecordSizes:[29],patternDialect:'ep40',patternHeaderSize:6,
    settingsSizes:SETTINGS_SIZES,fxSettingsSizes:FX_SIZES,scenesSize:712,
    supportsLoop:true,supportsSupertone:true,supportsLive:true
  }))
});

export const SUPPORTED_EP_SKUS=Object.freeze(Object.keys(DEVICE_COMPATIBILITY_MATRIX));
export const GENERIC_EP_UI=ui('ep','MY EP','',COMMON_MODES,GENERIC_TABS);
export const GENERIC_EP_PROJECT=Object.freeze({
  sku:'',...project('ep',{
    reason:'The connected EP project format has not been hardware-verified.'
  })
});

export const normalizeEpSku=sku=>String(sku||'').toUpperCase();
export const getEpCompatibility=sku=>DEVICE_COMPATIBILITY_MATRIX[normalizeEpSku(sku)]||null;
export const isKnownEpSku=sku=>getEpCompatibility(sku)!==null;

/**
 * The handshake minimum only validates a known model's firmware baseline;
 * independent evidence must still authorize FILE writes / project authoring.
 * Unknown or malformed versions fail closed.
 */
export function assessEpFirmwareCompatibility(sku,firmware=''){
  const entry=getEpCompatibility(sku);
  const version=String(firmware||'').trim();
  if(!entry)return Object.freeze({
    sku:normalizeEpSku(sku),firmware:version,supported:false,channel:null,
    minimum:null,reason:'Unknown EP-series SKU.'
  });
  const channel=version.startsWith('0.')?'beta':'production';
  const minimum=entry.minimumFirmware[channel];
  const comparison=compareFirmwareVersions(version,minimum);
  const supported=comparison!==null&&comparison>=0;
  return Object.freeze({
    sku:entry.sku,firmware:version,supported,channel,minimum,
    reason:supported?'':comparison===null?'Unrecognized EP-series firmware version.':
      'EP-series firmware '+version+' is too old for '+entry.sku+'. Minimum supported version is '+minimum+'.'
  });
}

/** Ensure new SKUs do not silently create inconsistent profile data. */
export function validateEpCompatibilityMatrix(matrix=DEVICE_COMPATIBILITY_MATRIX){
  for(const[sku,entry]of Object.entries(matrix)){
    if(!/^TE\d{3}AS\d{3}$/.test(sku)||entry.sku!==sku)throw new Error('Invalid EP compatibility SKU: '+sku);
    if(!entry.ui?.id||!entry.project?.id||!entry.minimumFirmware?.beta||!entry.minimumFirmware?.production)
      throw new Error('Incomplete EP compatibility profile: '+sku);
    for(const version of Object.values(entry.minimumFirmware))
      if(compareFirmwareVersions(version,version)!==0)throw new Error('Invalid minimum firmware for '+sku);
    for(const tab of entry.ui.fallbackTabs)
      if(!Array.isArray(tab.range)||tab.range.length!==2||tab.range[0]<1||tab.range[0]>tab.range[1]||tab.range[1]>999)
        throw new Error('Invalid sample bank tab for '+sku);
  }
  return true;
}
validateEpCompatibilityMatrix();
