import{canWriteCapability}from './capabilityEvidence.js?v=20261001-1';
import{resolveDeviceCapabilities}from './deviceCapabilities.js?v=20261001-1';
import{getEpCompatibility,GENERIC_EP_UI,normalizeEpSku}from './deviceCompatibilityMatrix.js?v=20261008-1';

const cloneTabs=tabs=>tabs.map(tab=>({name:tab.name,range:[...tab.range],color:tab.color}));

export function getEpDeviceProfile(sku='',firmware=''){
  const key=normalizeEpSku(sku);
  const profile=getEpCompatibility(key)?.ui||GENERIC_EP_UI;
  const version=String(firmware||'');
  const capabilities=resolveDeviceCapabilities({sku:key,firmware:version});
  const sampleMetadataEvidence=capabilities.evidence.sampleMetadata;
  const sampleTransferEvidence=capabilities.evidence.sampleTransfers;
  const sampleBarsEvidence=capabilities.evidence.sampleBars;
  return{
    sku:key,firmware:version,
    id:profile.id,title:profile.title,name:profile.name,
    playModes:[...profile.playModes],fallbackTabs:cloneTabs(profile.fallbackTabs),
    evidence:{
      sampleMetadata:sampleMetadataEvidence,
      sampleTransfers:sampleTransferEvidence,
      sampleBars:sampleBarsEvidence
    },
    advancedSampleMetadataWrites:canWriteCapability(sampleMetadataEvidence),
    sampleTransfers:canWriteCapability(sampleTransferEvidence),
    sampleBars:{
      authoring:canWriteCapability(sampleBarsEvidence)&&profile.sampleBarWriteValues.length>0,
      writeValues:[...profile.sampleBarWriteValues],evidence:sampleBarsEvidence
    }
  };
}
