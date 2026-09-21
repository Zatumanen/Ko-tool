import{TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INIT_SUBSCRIBE,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_GET}from './constants.js';
import{requestRead}from './device.js';
import{parseNullTerminatedString}from './packing.js';

function u16(a,i){return(a[i]<<8)|a[i+1]}
function u32(a,i){return((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0}

function initRead(maxResponseLength=4*1024*1024){
  const p=new Uint8Array(6),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_INIT;
  p[1]=TE_SYSEX_FILE_INIT_SUBSCRIBE;
  view.setUint32(2,maxResponseLength);
  return requestRead(TE_SYSEX_FILE,p);
}

function listPayload(page,nodeId){
  const p=new Uint8Array(5),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_LIST;
  view.setUint16(1,page);
  view.setUint16(3,nodeId);
  return p;
}

export function parseMetadataResponse(raw,page){
  if(raw.length<=2)return null;
  const responsePage=u16(raw,0);
  if(responsePage!==page)throw new Error('Unexpected metadata page '+responsePage+', expected '+page);
  return {text:parseNullTerminatedString(raw,2),done:raw[raw.length-1]===0};
}

function parseList(data){
  const out=[];
  let offset=0;
  while(offset+7<=data.length){
    const nodeId=u16(data,offset);
    const flags=data[offset+2];
    const fileSize=u32(data,offset+3);
    const fileName=parseNullTerminatedString(data,offset+7);
    out.push({nodeId,flags,fileSize,fileName,fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ)});
    offset+=7+fileName.length+1;
  }
  return out;
}

async function getMetadataByNodeId(nodeId){
  let page=0;
  let text='';
  for(;;){
    const p=new Uint8Array(6),view=new DataView(p.buffer);
    p[0]=TE_SYSEX_FILE_METADATA;
    p[1]=TE_SYSEX_FILE_METADATA_GET;
    view.setUint16(2,nodeId);
    view.setUint16(4,page);
    const response=await requestRead(TE_SYSEX_FILE,p);
    const raw=response.rawData;
    if(raw.length<=2)break;
    const responsePage=u16(raw,0);
    if(responsePage!==page)throw new Error('Unexpected metadata page '+responsePage+', expected '+page);
    text+=parseNullTerminatedString(raw,2);
    page+=1;
    if(raw[raw.length-1]===0)break;
  }
  try{return JSON.parse(text);}catch(e){throw new Error('Invalid EP-series metadata response.');}
}

export async function getFileMetadata(nodeId){
  return getMetadataByNodeId(nodeId);
}

export async function listDeviceFiles(onProgress){
  await initRead();
  const result=[];
  async function walk(nodeId=0,path='/'){
    for(let page=0;;page++){
      const response=await requestRead(TE_SYSEX_FILE,listPayload(page,nodeId));
      const raw=response.rawData;
      if(raw.length<=2)break;
      const pageNo=u16(raw,0);
      if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);
      for(const entry of parseList(raw.slice(2))){
        const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;
        const item={...entry,fileName:full};
        result.push(item);
        onProgress?.(item,result.length);
        if(entry.fileType==='folder')await walk(entry.nodeId,full);
      }
    }
  }
  await walk();
  return result;
}

export async function getFile(nodeId,onProgress){
  await initRead();
  const init=new Uint8Array(8),view=new DataView(init.buffer);
  init[0]=TE_SYSEX_FILE_GET;
  init[1]=TE_SYSEX_FILE_GET_TYPE_INIT;
  view.setUint16(2,nodeId);
  view.setUint32(4,0);
  const start=await requestRead(TE_SYSEX_FILE,init);
  if(start.rawData.length<7)throw new Error('Invalid EP-series FILE_GET init response.');
  const fileSize=u32(start.rawData,3);
  const fileName=parseNullTerminatedString(start.rawData,7);
  const chunks=[];
  let done=0,page=0;
  while(done<fileSize){
    const requestPayload=new Uint8Array(4),requestView=new DataView(requestPayload.buffer);
    requestPayload[0]=TE_SYSEX_FILE_GET;
    requestPayload[1]=TE_SYSEX_FILE_GET_TYPE_DATA;
    requestView.setUint16(2,page);
    const response=await requestRead(TE_SYSEX_FILE,requestPayload);
    const raw=response.rawData;
    if(raw.length<2)break;
    const gotPage=u16(raw,0);
    if(gotPage!==page)throw new Error(`Unexpected page ${gotPage}, expected ${page}`);
    const chunk=raw.slice(2);
    if(!chunk.length)break;
    chunks.push(chunk);
    done+=chunk.length;
    onProgress?.(done,fileSize);
    page=(gotPage+1)&0xffff;
  }
  const data=new Uint8Array(chunks.reduce((total,chunk)=>total+chunk.length,0));
  let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return{name:fileName,size:fileSize,data};
}
