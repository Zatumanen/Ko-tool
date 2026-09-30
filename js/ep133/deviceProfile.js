import{CAPABILITY_EVIDENCE,capabilityEvidence,resolveCapabilityEvidence,canWriteCapability}from './capabilityEvidence.js?v=20260930-5';

const COMMON_PLAY_MODES=Object.freeze(['oneshot','key','legato']);
const VERIFIED_SAMPLE_METADATA=capabilityEvidence(CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
  read:true,preserve:true,
  source:'ep-series-sysex live verification on EP-133/EP-40 OS 2.5.1',
  firmwareRange:'2.5.1'
});
const VERIFIED_SAMPLE_TRANSFERS=capabilityEvidence(CAPABILITY_EVIDENCE.HARDWARE_VERIFIED,{
  read:true,preserve:true,
  source:'live-verified FILE sample library operations on EP-133/EP-40 OS 2.5.1',
  firmwareRange:'2.5.1'
});
const UNVERIFIED_SAMPLE_METADATA=capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED,{
  read:true,preserve:true,
  source:'shared EP-series FILE shape; no EP-1320 HIL campaign',
  reason:'Advanced sample metadata authoring is not hardware-verified for this EP.'
});
const UNVERIFIED_SAMPLE_TRANSFERS=capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED,{
  read:true,preserve:true,
  source:'shared EP-series FILE shape; no EP-1320 HIL campaign',
  reason:'Sample transfer authoring is not hardware-verified for this EP.'
});
const PRESERVE_ONLY_SAMPLE_BARS=Object.freeze({
  writeValues:Object.freeze([]),
  evidence:capabilityEvidence(CAPABILITY_EVIDENCE.PRESERVE_ONLY,{
    read:true,preserve:true,
    source:'hardware-observed power-of-2 clamp; exact slot authoring values unverified',
    reason:'Sample bar authoring values are preserve-only until dedicated HIL verification.'
  })
});

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

const PROFILES=Object.freeze({
  TE032AS001:Object.freeze({
    id:'ep133',title:'MY EP-133',name:'K.O. II',
    playModes:COMMON_PLAY_MODES,fallbackTabs:EP133_FALLBACK_TABS,
    evidence:Object.freeze({sampleMetadata:VERIFIED_SAMPLE_METADATA,sampleTransfers:VERIFIED_SAMPLE_TRANSFERS}),
    sampleBars:PRESERVE_ONLY_SAMPLE_BARS
  }),
  TE032AS005:Object.freeze({
    id:'ep1320',title:'MY EP-1320',name:'MEDIEVAL',
    playModes:COMMON_PLAY_MODES,fallbackTabs:EP1320_FALLBACK_TABS,
    evidence:Object.freeze({sampleMetadata:UNVERIFIED_SAMPLE_METADATA,sampleTransfers:UNVERIFIED_SAMPLE_TRANSFERS}),
    sampleBars:PRESERVE_ONLY_SAMPLE_BARS
  }),
  TE032AS006:Object.freeze({
    id:'ep40',title:'MY EP-40',name:'RIDDIM',
    playModes:Object.freeze([...COMMON_PLAY_MODES,'loop']),fallbackTabs:GENERIC_FALLBACK_TABS,
    evidence:Object.freeze({sampleMetadata:VERIFIED_SAMPLE_METADATA,sampleTransfers:VERIFIED_SAMPLE_TRANSFERS}),
    sampleBars:PRESERVE_ONLY_SAMPLE_BARS
  })
});

const GENERIC=capabilityEvidence(CAPABILITY_EVIDENCE.UNVERIFIED,{
  read:false,preserve:false,
  reason:'The connected EP capability has not been verified.'
});
const GENERIC_PROFILE=Object.freeze({
  id:'ep',title:'MY EP',name:'',playModes:COMMON_PLAY_MODES,fallbackTabs:GENERIC_FALLBACK_TABS,
  evidence:Object.freeze({sampleMetadata:GENERIC,sampleTransfers:GENERIC}),
  sampleBars:PRESERVE_ONLY_SAMPLE_BARS
});
const cloneTabs=tabs=>tabs.map(tab=>({name:tab.name,range:[...tab.range],color:tab.color}));

export function getEpDeviceProfile(sku='',firmware=''){
  const key=String(sku||'').toUpperCase();
  const profile=PROFILES[key]||GENERIC_PROFILE;
  const version=String(firmware||'');
  const sampleMetadataEvidence=resolveCapabilityEvidence(profile.evidence.sampleMetadata,version);
  const sampleTransferEvidence=resolveCapabilityEvidence(profile.evidence.sampleTransfers,version);
  const sampleBarsEvidence=resolveCapabilityEvidence(profile.sampleBars.evidence,version);
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
      authoring:canWriteCapability(sampleBarsEvidence)&&profile.sampleBars.writeValues.length>0,
      writeValues:[...profile.sampleBars.writeValues],
      evidence:sampleBarsEvidence
    }
  };
}
