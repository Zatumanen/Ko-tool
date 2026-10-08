import{assertBinaryBytes,assertUnsigned,isValidTeWireFrame}from './coreContracts.js?v=20261008-1';
import{MIDI_SYSEX_START,MIDI_SYSEX_END,TE_MIDI_ID,MIDI_SYSEX_TE,BIT_IS_REQUEST,BIT_REQUEST_ID_AVAILABLE,STATUS_OK}from './constants.js';
import{packToBuffer,packedLength,unpackInPlace}from './packing.js';
import{isKnownEpSku}from './deviceCompatibilityMatrix.js?v=20261008-1';

const requestIds=new Map();

function requestId(outputId){
  if(!requestIds.has(outputId))requestIds.set(outputId,Math.floor(Math.random()*4095));
  let id=((requestIds.get(outputId)??0)+1)%4096;
  if(id===0)id=1;
  requestIds.set(outputId,id);
  return id;
}

export function isSupportedEpSku(sku){return isKnownEpSku(sku);}

export function parseIdentityResponse(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length!==17||bytes[0]!==0xF0||bytes[1]!==0x7E||bytes[3]!==0x06||bytes[4]!==0x02||bytes[5]!==TE_MIDI_ID[0]||bytes[6]!==TE_MIDI_ID[1]||bytes[7]!==TE_MIDI_ID[2]||bytes[16]!==0xF7)return null;
  for(let i=2;i<16;i++)if(bytes[i]>0x7f)return null;
  const productCode=bytes[8]^(bytes[9]<<7);
  const assemblyCode=bytes[10]^(bytes[11]<<7);
  return{midiId:bytes[2],sku:`TE${String(productCode).padStart(3,'0')}AS${String(assemblyCode).padStart(3,'0')}`};
}

export function encodeTeSysex(command,payload=new Uint8Array(),identityCode=0,id=1){
  if(!Number.isInteger(id)||id<1||id>0xfff)throw new Error('TE request id must be 1..4095.');
  assertUnsigned(command,'TE SysEx command',0x7f);
  assertUnsigned(identityCode,'TE SysEx identity code',0x7f);
  const data=assertBinaryBytes(payload,'TE SysEx payload');
  const plen=packedLength(data.length);
  const msg=new Uint8Array(10+plen);
  msg.set([MIDI_SYSEX_START,...TE_MIDI_ID,identityCode,MIDI_SYSEX_TE,BIT_IS_REQUEST|BIT_REQUEST_ID_AVAILABLE|((id>>7)&0x1f),id&0x7f,command],0);
  if(plen)packToBuffer(data,msg.subarray(9,9+plen));
  msg[msg.length-1]=MIDI_SYSEX_END;
  return{id,bytes:msg};
}

export function buildTeSysex(command,payload=new Uint8Array(),identityCode=0,outputId='default'){
  return encodeTeSysex(command,payload,identityCode,requestId(outputId));
}

export function parseTeSysex(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<10||bytes[0]!==MIDI_SYSEX_START||bytes[1]!==TE_MIDI_ID[0]||bytes[2]!==TE_MIDI_ID[1]||bytes[3]!==TE_MIDI_ID[2]||bytes[5]!==MIDI_SYSEX_TE||bytes.at(-1)!==MIDI_SYSEX_END)return null;
  const flags=bytes[6],isRequest=!!(flags&BIT_IS_REQUEST),hasId=!!(flags&BIT_REQUEST_ID_AVAILABLE);
  if(!isValidTeWireFrame(bytes,isRequest?9:10))return null;
  const id=hasId?((flags&0x1f)<<7)|(bytes[7]&0x7f):0;
  let index=9,status=-1;
  if(!isRequest)status=bytes[index++];
  const raw=unpackInPlace(bytes.slice(index,-1));
  return{identityCode:bytes[4],isRequest,hasRequestId:hasId,requestId:id,command:bytes[8],status,rawData:raw};
}

export function isOk(response){return !!response&&!response.isRequest&&response.status===STATUS_OK;}
