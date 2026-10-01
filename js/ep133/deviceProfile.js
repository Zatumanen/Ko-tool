import{canWriteCapability}from './capabilityEvidence.js?v=20261001-1';
import{
  CAPABILITY_KEYS,resolveRegisteredCapabilityEvidence
}from './evidenceRegistry.js?v=20261001-1';

const COMMON_PLAY_MODES=Object.freeze(['oneshot','key','legato']);

const EP133_FALLBACK_TABS=Object.freeze([
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

const EP1320_FALLBACK_TABS=Object.freeze([
  {name:'DRUMS',range:[1,69],color:1},
  {name:'PHRASES',range:[70,114],color:1},
  {name:'INSTR',range:[115,127],color:1},
  {name:'ONE SHOT',range:[128,155],color:1},
  {name:'SFX',range:[156,220],color:1},
  {name:'USER',range:[221,999],color:2}
]);

const GENERIC_FALLBACK_TABS=Object.freeze([{name:'SAMPLES',range:[1,999],color:1}]);
const NO_SAMPLE_BAR_AUTHORING=Object.freeze([]);

const PROFILES=Object.freeze({
  TE032AS001:Object.freeze({
    id:'ep133',title:'MY EP-133',name:'K.O. II',
    playModes:COMMON_PLAY_MODES,fallbackTabs:EP133_FALLBACK_TABS,
    sampleBarWriteValues:NO_SAMPLE_BAR_AUTHORING
  }),
  TE032AS005:Object.freeze({
    id:'ep1320',title:'MY EP-1320',name:'MEDIEVAL',
    playModes:COMMON_PLAY_MODES,fallbackTabs:EP1320_FALLBACK_TABS,
    sampleBarWriteValues:NO_SAMPLE_BAR_AUTHORING
  }),
  TE032AS006:Object.freeze({
    id:'ep40',title:'MY EP-40',name:'RIDDIM',
    playModes:Object.freeze([...COMMON_PLAY_MODES,'loop']),fallbackTabs:GENERIC_FALLBACK_TABS,
    sampleBarWriteValues:NO_SAMPLE_BAR_AUTHORING
  })
});

const GENERIC_PROFILE=Object.freeze({
  id:'ep',title:'MY EP',name:'',playModes:COMMON_PLAY_MODES,fallbackTabs:GENERIC_FALLBACK_TABS,
  sampleBarWriteValues:NO_SAMPLE_BAR_AUTHORING
});
const cloneTabs=tabs=>tabs.map(tab=>({name:tab.name,range:[...tab.range],color:tab.color}));

export function getEpDeviceProfile(sku='',firmware=''){
  const key=String(sku||'').toUpperCase();
  const profile=PROFILES[key]||GENERIC_PROFILE;
  const version=String(firmware||'');
  const sampleMetadataEvidence=resolveRegisteredCapabilityEvidence(key,CAPABILITY_KEYS.SAMPLE_METADATA,version);
  const sampleTransferEvidence=resolveRegisteredCapabilityEvidence(key,CAPABILITY_KEYS.SAMPLE_TRANSFERS,version);
  const sampleBarsEvidence=resolveRegisteredCapabilityEvidence(key,CAPABILITY_KEYS.SAMPLE_BARS,version);
  return{
    sku:key,
    firmware:version,
    id:profile.id,
    title:profile.title,
    name:profile.name,
    playModes:[...profile.playModes],
    fallbackTabs:cloneTabs(profile.fallbackTabs),
    evidence:{
      sampleMetadata:sampleMetadataEvidence,
      sampleTransfers:sampleTransferEvidence,
      sampleBars:sampleBarsEvidence
    },
    advancedSampleMetadataWrites:canWriteCapability(sampleMetadataEvidence),
    sampleTransfers:canWriteCapability(sampleTransferEvidence),
    sampleBars:{
      authoring:canWriteCapability(sampleBarsEvidence)&&profile.sampleBarWriteValues.length>0,
      writeValues:[...profile.sampleBarWriteValues],
      evidence:sampleBarsEvidence
    }
  };
}
