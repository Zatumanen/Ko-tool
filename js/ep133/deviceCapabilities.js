import{assertUnsigned}from './coreContracts.js?v=20261008-1';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK
}from './constants.js?v=20261001-1';
import{resolveRegisteredCapabilityEvidence}from './evidenceRegistry.js?v=20261001-1';
import{CAPABILITY_NAMES}from './deviceCompatibilityMatrix.js?v=20261008-1';


export function decodeFileRights(mask=0){
  const value=assertUnsigned(mask,'FILE capability mask',0xff);
  return Object.freeze({
    read:(value&TE_SYSEX_FILE_CAPABILITY_READ)!==0,
    write:(value&TE_SYSEX_FILE_CAPABILITY_WRITE)!==0,
    delete:(value&TE_SYSEX_FILE_CAPABILITY_DELETE)!==0,
    move:(value&TE_SYSEX_FILE_CAPABILITY_MOVE)!==0,
    playback:(value&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)!==0
  });
}

export function encodeFileRights({read=false,write=false,delete:canDelete=false,move=false,playback=false}={}){
  return(
    (read?TE_SYSEX_FILE_CAPABILITY_READ:0)|
    (write?TE_SYSEX_FILE_CAPABILITY_WRITE:0)|
    (canDelete?TE_SYSEX_FILE_CAPABILITY_DELETE:0)|
    (move?TE_SYSEX_FILE_CAPABILITY_MOVE:0)|
    (playback?TE_SYSEX_FILE_CAPABILITY_PLAYBACK:0)
  );
}

export function resolveDeviceCapabilities({sku='',firmware='',fileCapabilities=0}={}){
  const normalizedSku=String(sku||'').toUpperCase();
  const normalizedFirmware=String(firmware||'');
  const evidence={};
  for(const[name,capability]of Object.entries(CAPABILITY_NAMES)){
    evidence[name]=resolveRegisteredCapabilityEvidence(normalizedSku,capability,normalizedFirmware);
  }
  return Object.freeze({
    sku:normalizedSku,
    firmware:normalizedFirmware,
    fileRights:decodeFileRights(fileCapabilities),
    evidence:Object.freeze(evidence)
  });
}
