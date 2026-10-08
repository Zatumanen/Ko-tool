import{
  TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INIT_SUBSCRIBE,
  TE_SYSEX_FILE_LIST,
  TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET,
  TE_SYSEX_FILE_METADATA_SET_PAGED,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA,
  TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_FILE_TYPE_DIR,
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,TE_SYSEX_FILE_CAPABILITY_DELETE,
  TE_SYSEX_FILE_CAPABILITY_MOVE,TE_SYSEX_FILE_CAPABILITY_PLAYBACK,
  TE_SYSEX_FILE_INFO,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_MOVED,
  TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_PUT_TYPE_INIT,TE_SYSEX_FILE_PUT_TYPE_DATA,
  TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA
}from './constants.js';
import{parseNullTerminatedString}from './packing.js';
import{assertBinaryBytes,assertUnsigned,assertWireFid,assertFileMetadata}from './coreContracts.js?v=20261008-1';

export const readU16=(a,i)=>(a[i]<<8)|a[i+1];
export const readU32=(a,i)=>((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0;

const writeString=(view,offset,text,terminate=false)=>{
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
  if(terminate)view.setUint8(offset+text.length,0);
};

const TE_SYSEX_HEADER_OVERHEAD=8,TE_SYSEX_FOOTER_OVERHEAD=1;

export function calculateMaxPayloadLength(maxPacketLength){
  const overhead=TE_SYSEX_HEADER_OVERHEAD+2+TE_SYSEX_FOOTER_OVERHEAD;
  if(maxPacketLength<=overhead)return 0;
  const available=maxPacketLength-1-overhead;
  return available-Math.floor(available/8);
}

export function buildFileInitPayload(maxResponseLength=4*1024*1024){
  assertUnsigned(maxResponseLength,'FILE_INIT response length');
  const p=new Uint8Array(6),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_INIT;
  p[1]=TE_SYSEX_FILE_INIT_SUBSCRIBE;
  view.setUint32(2,maxResponseLength);
  return p;
}

export function buildFileListPayload(page,nodeId){
  assertUnsigned(page,'FILE_LIST page',0xffff);
  assertWireFid(nodeId,{allowRoot:true,label:'FILE_LIST parent id'});
  const p=new Uint8Array(5),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_LIST;
  view.setUint16(1,page);
  view.setUint16(3,nodeId);
  return p;
}

export function parseMetadataResponse(raw,page){
  if(raw.length<=2)return null;
  const responsePage=readU16(raw,0);
  if(responsePage!==page)throw new Error('Unexpected metadata page '+responsePage+', expected '+page);
  return{text:parseNullTerminatedString(raw,2),done:raw[raw.length-1]===0};
}

export function buildMetadataGetPayload(nodeId,page=0,key=null){
  assertWireFid(nodeId,{allowRoot:true,label:'FILE_METADATA id'});
  assertUnsigned(page,'FILE_METADATA page',0xffff);
  const keyBytes=key?new TextEncoder().encode(String(key)):null;
  const p=new Uint8Array(6+(keyBytes?.length||0)+(keyBytes?1:0)),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_METADATA;
  p[1]=TE_SYSEX_FILE_METADATA_GET;
  view.setUint16(2,nodeId);
  view.setUint16(4,page);
  if(keyBytes){p.set(keyBytes,6);p[6+keyBytes.length]=0;}
  return p;
}

export function parseFileListEntries(data){
  assertBinaryBytes(data,'FILE_LIST entries');
  const out=[];
  let offset=0;
  while(offset<data.length){
    if(data.length-offset<8)throw new Error('Truncated EP-series FILE_LIST entry.');
    const nodeId=readU16(data,offset);
    const flags=data[offset+2];
    const fileSize=readU32(data,offset+3);
    const nameStart=offset+7;
    const nameEnd=data.indexOf(0,nameStart);
    if(nameEnd<0)throw new Error('Unterminated EP-series FILE_LIST name.');
    const fileName=parseNullTerminatedString(data,nameStart);
    out.push({
      nodeId,flags,fileSize,fileName,
      fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',
      isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ),
      isWritable:!!(flags&TE_SYSEX_FILE_CAPABILITY_WRITE),
      isDeletable:!!(flags&TE_SYSEX_FILE_CAPABILITY_DELETE),
      isMovable:!!(flags&TE_SYSEX_FILE_CAPABILITY_MOVE),
      isPlayable:!!(flags&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)
    });
    offset=nameEnd+1;
  }
  return out;
}

export function buildFileInfoPayload(fileId){
  assertWireFid(fileId);
  const p=new Uint8Array(3),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_INFO;
  view.setUint16(1,fileId);
  return p;
}

export function parseFileInfoResponse(raw){
  assertBinaryBytes(raw,'FILE_INFO response');
  if(raw.length<10||raw.indexOf(0,9)<0)throw new Error('Invalid EP-series FILE_INFO response.');
  return{
    nodeId:readU16(raw,0),
    parentId:readU16(raw,2),
    flags:raw[4],
    fileSize:readU32(raw,5),
    fileName:parseNullTerminatedString(raw,9)
  };
}

export function buildFileDeletePayload(fileId){
  assertWireFid(fileId);
  const p=new Uint8Array(3),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_DELETE;
  view.setUint16(1,fileId);
  return p;
}

export function buildFileMovePayload(fileId,parentId,newFileId){
  assertWireFid(fileId,{label:'FILE_MOVE source id'});
  assertWireFid(parentId,{allowRoot:true,label:'FILE_MOVE parent id'});
  assertWireFid(newFileId,{label:'FILE_MOVE destination id'});
  const p=new Uint8Array(7),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_MOVED;
  view.setUint16(1,fileId);
  view.setUint16(3,parentId);
  view.setUint16(5,newFileId);
  return p;
}

export function parseFileMoveResponse(raw){
  assertBinaryBytes(raw,'FILE_MOVE response');
  if(raw.length<6)throw new Error('Invalid EP-series FILE_MOVE response.');
  return{oldFileId:readU16(raw,0),parentId:readU16(raw,2),newFileId:readU16(raw,4)};
}

export function buildFilePutInitPayload(
  fileId,parentId,fileSize,filename,metadata=null,
  {isDirectory=false,capabilities=[TE_SYSEX_FILE_CAPABILITY_READ]}={}
){
  assertWireFid(fileId,{label:'FILE_PUT destination id'});
  assertWireFid(parentId,{allowRoot:true,label:'FILE_PUT parent id'});
  assertUnsigned(fileSize,'FILE_PUT file size');
  if(metadata!=null)assertFileMetadata(metadata);
  const safe=String(filename||'').slice(0,54);
  const meta=metadata==null?'':JSON.stringify(metadata);
  const p=new Uint8Array(11+safe.length+1+meta.length),view=new DataView(p.buffer);
  let flags=isDirectory?TE_SYSEX_FILE_FILE_TYPE_DIR:TE_SYSEX_FILE_FILE_TYPE_FILE;
  for(const capability of capabilities)flags|=capability;
  p[0]=TE_SYSEX_FILE_PUT;
  p[1]=TE_SYSEX_FILE_PUT_TYPE_INIT;
  p[2]=flags;
  view.setUint16(3,fileId);
  view.setUint16(5,parentId);
  view.setUint32(7,fileSize);
  writeString(view,11,safe,true);
  if(meta.length)writeString(view,12+safe.length,meta,false);
  return p;
}

export function validateFilePutPage(page){
  if(!Number.isInteger(page)||page<0||page>0xffff)
    throw new Error('EP-series FILE_PUT page limit exceeded.');
  return page;
}

export function buildFilePutDataPayload(page,data){
  validateFilePutPage(page);
  assertBinaryBytes(data,'FILE_PUT page data');
  const p=new Uint8Array(4+data.byteLength),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_PUT;
  p[1]=TE_SYSEX_FILE_PUT_TYPE_DATA;
  view.setUint16(2,page);
  p.set(data,4);
  return p;
}

export function buildMetadataSetPayload(fileId,metadata){
  assertWireFid(fileId);
  assertFileMetadata(metadata);
  const json=JSON.stringify(metadata);
  const p=new Uint8Array(5+json.length),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_METADATA;
  p[1]=TE_SYSEX_FILE_METADATA_SET;
  view.setUint16(2,fileId);
  writeString(view,4,json,true);
  return p;
}

export function buildMetadataPagedInitPayload(fileId,size){
  assertWireFid(fileId);
  assertUnsigned(size,'METADATA_SET payload size');
  const p=new Uint8Array(9),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_METADATA;
  p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;
  p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT;
  view.setUint16(3,fileId);
  view.setUint32(5,size);
  return p;
}

export function buildMetadataPagedDataPayload(page,data){
  assertUnsigned(page,'METADATA_SET page',0xffff);
  assertBinaryBytes(data,'METADATA_SET page data');
  const p=new Uint8Array(5+data.byteLength),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_METADATA;
  p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;
  p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA;
  view.setUint16(3,page);
  p.set(data,5);
  return p;
}

export function validateFileGetChunk(raw,page,remaining){
  assertBinaryBytes(raw,'FILE_GET response');
  assertUnsigned(page,'FILE_GET page',0xffff);
  assertUnsigned(remaining,'FILE_GET remaining byte count');
  if(raw.length<2)throw new Error(`Invalid FILE_GET response for page ${page}.`);
  const gotPage=readU16(raw,0);
  if(gotPage!==page)throw new Error(`Unexpected page ${gotPage}, expected ${page}`);
  const chunk=raw.slice(2);
  if(!chunk.length)throw new Error(`Empty FILE_GET response for page ${page}.`);
  if(chunk.length>remaining)throw new Error(`FILE_GET page ${page} exceeds the declared file size.`);
  return chunk;
}

export function buildFileGetInitPayload(nodeId,offset=0){
  assertWireFid(nodeId);
  assertUnsigned(offset,'FILE_GET offset');
  const p=new Uint8Array(8),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_GET;
  p[1]=TE_SYSEX_FILE_GET_TYPE_INIT;
  view.setUint16(2,nodeId);
  view.setUint32(4,offset);
  return p;
}

export function buildFileGetDataPayload(page){
  assertUnsigned(page,'FILE_GET page',0xffff);
  const p=new Uint8Array(4),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_GET;
  p[1]=TE_SYSEX_FILE_GET_TYPE_DATA;
  view.setUint16(2,page);
  return p;
}
