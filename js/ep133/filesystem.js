import{TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INIT_SUBSCRIBE,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_PUT_TYPE_INIT,TE_SYSEX_FILE_PUT_TYPE_DATA,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET_PAGED,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_PLAYBACK_START,TE_SYSEX_FILE_PLAYBACK_STOP}from './constants.js';
import{requestRead,requestFile,onConnectionChange}from './device.js';
import{parseNullTerminatedString}from './packing.js';

const u16=(a,i)=>(a[i]<<8)|a[i+1];
const u32=(a,i)=>((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0;
const writeString=(view,offset,text,terminate=false)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));if(terminate)view.setUint8(offset+text.length,0);};
const writeUtf8String=(view,offset,text,terminate=false)=>{const bytes=new TextEncoder().encode(text);new Uint8Array(view.buffer,view.byteOffset+offset,bytes.length).set(bytes);if(terminate)view.setUint8(offset+bytes.length,0);return bytes.length;};
const TE_SYSEX_HEADER_OVERHEAD=8,TE_SYSEX_FOOTER_OVERHEAD=1;
const deviceChunkSizes=new Map();
let fileOperationQueue=Promise.resolve();
function runFileOperation(operation){const task=fileOperationQueue.then(operation);fileOperationQueue=task.catch(()=>{});return task;}
export function resetFileSystemState(){deviceChunkSizes.clear();fileOperationQueue=Promise.resolve();}
const getDeviceKey=device=>device?.deviceKey||device?.metadata?.serialNumber||device?.metadata?.serial||null;
let activeDeviceKey=null;
onConnectionChange(({connected,device})=>{
  activeDeviceKey=connected?getDeviceKey(device):null;
  if(!connected)deviceChunkSizes.clear();
});
function getCachedChunkSize(){return activeDeviceKey?deviceChunkSizes.get(activeDeviceKey)||0:0;}
export function calculateMaxPayloadLength(maxPacketLength){const overhead=TE_SYSEX_HEADER_OVERHEAD+2+TE_SYSEX_FOOTER_OVERHEAD;if(maxPacketLength<=overhead)return 0;const available=maxPacketLength-1-overhead;return available-Math.floor(available/8);}

function initPayload(maxResponseLength=4*1024*1024){const p=new Uint8Array(6),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_INIT;p[1]=TE_SYSEX_FILE_INIT_SUBSCRIBE;view.setUint32(2,maxResponseLength);return p;}

async function initFileSystemUnlocked(maxResponseLength=4*1024*1024){const response=await requestFile(TE_SYSEX_FILE,initPayload(maxResponseLength));if(response.rawData.length<5)throw new Error('Invalid EP-series FILE_INIT response.');const chunkSize=u32(response.rawData,1);if(!chunkSize)throw new Error('EP-series returned an invalid FILE chunk size.');if(activeDeviceKey)deviceChunkSizes.set(activeDeviceKey,chunkSize);return chunkSize;}

export async function initFileSystem(maxResponseLength=4*1024*1024){return runFileOperation(()=>initFileSystemUnlocked(maxResponseLength));}
async function initRead(maxResponseLength=4*1024*1024){return initFileSystemUnlocked(maxResponseLength);}
function listPayload(page,nodeId){const p=new Uint8Array(5),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_LIST;view.setUint16(1,page);view.setUint16(3,nodeId);return p;}

export function parseMetadataResponse(raw,page){if(raw.length<=2)return null;const responsePage=u16(raw,0);if(responsePage!==page)throw new Error('Unexpected metadata page '+responsePage+', expected '+page);return{text:parseNullTerminatedString(raw,2),done:raw[raw.length-1]===0};}

function parseList(data){const out=[];let offset=0;while(offset+7<=data.length){const nodeId=u16(data,offset),flags=data[offset+2],fileSize=u32(data,offset+3),fileName=parseNullTerminatedString(data,offset+7);out.push({nodeId,flags,fileSize,fileName,fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ),isWritable:!!(flags&8),isPlayable:!!(flags&64)});offset+=7+fileName.length+1;}return out;}

async function getMetadataByNodeId(nodeId){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      let page=0,text='';
      for(;;){
        const p=new Uint8Array(6),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_GET;view.setUint16(2,nodeId);view.setUint16(4,page);
        const response=await requestRead(TE_SYSEX_FILE,p);
        const parsed=parseMetadataResponse(response.rawData,page);
        if(!parsed)break;
        text+=parsed.text;if(parsed.done)break;page+=1;
      }
      return JSON.parse(text);
    }catch(error){
      lastError=error;
      if(attempt<2)await new Promise(r=>setTimeout(r,200));
    }
  }
  throw lastError||new Error('EP metadata request failed.');
}

export async function getFileMetadata(nodeId){return runFileOperation(()=>getMetadataByNodeId(nodeId));}

export async function listDeviceFiles(onProgress){return runFileOperation(async()=>{await initRead();const result=[];async function walk(nodeId=0,path='/'){for(let page=0;;page++){const response=await requestRead(TE_SYSEX_FILE,listPayload(page,nodeId));const raw=response.rawData;if(raw.length<=2)break;const pageNo=u16(raw,0);if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);for(const entry of parseList(raw.slice(2))){const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;const item={...entry,fileName:full};result.push(item);onProgress?.(item,result.length);if(entry.fileType==='folder')await walk(entry.nodeId,full);}}}await walk();return result;});}

export function normalizeFileName(name){let value=String(name||'sample.wav').replace(/^\d{3}\s/,'');value=value.split('.').slice(0,-1).join('.')||value;value=value.replace(/\//g,'').trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7F]/g,'?').replace(/[\\"]/g,'').substring(0,16);return value.toLowerCase()||'sample';}

export function buildFilePutInitPayload(fileId,parentId,fileSize,filename,metadata){const safe=normalizeFileName(filename),meta=metadata==null?'':JSON.stringify(metadata),metaBytes=new TextEncoder().encode(meta),p=new Uint8Array(11+safe.length+1+metaBytes.length),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PUT;p[1]=TE_SYSEX_FILE_PUT_TYPE_INIT;p[2]=TE_SYSEX_FILE_CAPABILITY_READ|TE_SYSEX_FILE_FILE_TYPE_FILE;view.setUint16(3,fileId);view.setUint16(5,parentId);view.setUint32(7,fileSize);writeString(view,11,safe,true);if(meta)writeUtf8String(view,12+safe.length,meta,false);return p;}

export function buildFilePutDataPayload(page,data){const p=new Uint8Array(4+data.byteLength),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PUT;p[1]=TE_SYSEX_FILE_PUT_TYPE_DATA;view.setUint16(2,page);p.set(data,4);return p;}

export function buildMetadataSetPayload(fileId,metadata){const json=JSON.stringify(metadata),bytes=new TextEncoder().encode(json),p=new Uint8Array(5+bytes.length),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET;view.setUint16(2,fileId);writeUtf8String(view,4,json,true);return p;}

export function buildMetadataPagedInitPayload(fileId,size){const p=new Uint8Array(9),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT;view.setUint16(3,fileId);view.setUint32(5,size);return p;}
export function buildMetadataPagedDataPayload(page,data){const p=new Uint8Array(5+data.byteLength),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA;view.setUint16(3,page);p.set(data,5);return p;}

export async function putFile({data,filename,parentId,destinationId,metadata=null,onProgress,timeout=15000}){
  return runFileOperation(async()=>{
  if(!(data instanceof Uint8Array))data=new Uint8Array(data);
  if(!Number.isInteger(destinationId)||destinationId<1||destinationId>999)throw new Error('Invalid EP-133 sample destination.');
  if(!Number.isInteger(parentId)||parentId<0||parentId>65535)throw new Error('Invalid EP-133 sample parent.');
  const chunkSize=getCachedChunkSize()||await initFileSystemUnlocked();
  const init=await requestFile(TE_SYSEX_FILE,buildFilePutInitPayload(destinationId,parentId,data.byteLength,filename,metadata),timeout);
  if(init.rawData.length<2)throw new Error('Invalid EP-series FILE_PUT init response.');
  const fileId=u16(init.rawData,0);
  const maxPayload=calculateMaxPayloadLength(chunkSize-6);
  if(maxPayload<=0)throw new Error('EP-series returned an unusable FILE chunk size.');
  let offset=0,page=0;
  onProgress?.(0,data.byteLength,{status:'sending',fileId});
  while(offset<data.byteLength){
    const size=Math.min(maxPayload,data.byteLength-offset);
    const payload=buildFilePutDataPayload(page,data.subarray(offset,offset+size));
    await requestFile(TE_SYSEX_FILE,payload,timeout);
    offset+=size;page+=1;
    onProgress?.(offset,data.byteLength,{status:'sending',fileId});
  }
  await requestFile(TE_SYSEX_FILE,buildFilePutDataPayload(page,new Uint8Array(0)),timeout);
  return fileId;
  });
}

export async function setFileMetadata(fileId,metadata,{timeout=15000}={}){
  return runFileOperation(async()=>{
  const chunkSize=getCachedChunkSize()||await initFileSystemUnlocked();
  const json=JSON.stringify(metadata),jsonBytes=new TextEncoder().encode(json);
  if(jsonBytes.length<=chunkSize-8){await requestFile(TE_SYSEX_FILE,buildMetadataSetPayload(fileId,metadata),timeout);return;}
  const data=jsonBytes,maxPayload=calculateMaxPayloadLength(chunkSize-8);
  await requestFile(TE_SYSEX_FILE,buildMetadataPagedInitPayload(fileId,data.byteLength),timeout);
  let offset=0,page=0;
  while(offset<data.byteLength){const size=Math.min(maxPayload,data.byteLength-offset);await requestFile(TE_SYSEX_FILE,buildMetadataPagedDataPayload(page,data.subarray(offset,offset+size)),timeout);offset+=size;page+=1;}
  await requestFile(TE_SYSEX_FILE,buildMetadataPagedDataPayload(page,new Uint8Array(0)),timeout);
  });
}

export async function uploadSampleToSlot({file,data,filename,parentId,destinationId,metadata={},onProgress}){

  const bytes=data instanceof Uint8Array?data:new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength===0)throw new Error('Cannot upload an empty sample.');
  const name=filename||file?.name||'sample.wav';
  const fileId=await putFile({data:bytes,filename:name,parentId,destinationId,metadata,onProgress});
  await setFileMetadata(fileId,{...metadata,name:normalizeFileName(name)});
  await initFileSystem();
  return fileId;
}

export async function startPlayback(nodeId,preview=true){return runFileOperation(async()=>{const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_START;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,preview?1000:0);await requestFile(TE_SYSEX_FILE,p,5000);});}
export async function stopPlayback(nodeId){return runFileOperation(async()=>{const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_STOP;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,0);await requestFile(TE_SYSEX_FILE,p,5000);});}

export function validateFileGetChunk(raw,page,remaining){if(raw.length<2)throw new Error(`Invalid FILE_GET response for page ${page}.`);const gotPage=u16(raw,0);if(gotPage!==page)throw new Error(`Unexpected page ${gotPage}, expected ${page}`);const chunk=raw.slice(2);if(!chunk.length)throw new Error(`Empty FILE_GET response for page ${page}.`);if(chunk.length>remaining)throw new Error(`FILE_GET page ${page} exceeds the declared file size.`);return chunk;}

export async function getFile(nodeId,onProgress){return runFileOperation(async()=>{await initRead();const init=new Uint8Array(8),view=new DataView(init.buffer);init[0]=TE_SYSEX_FILE_GET;init[1]=TE_SYSEX_FILE_GET_TYPE_INIT;view.setUint16(2,nodeId);view.setUint32(4,0);const start=await requestRead(TE_SYSEX_FILE,init);if(start.rawData.length<7)throw new Error('Invalid EP-series FILE_GET init response.');const fileSize=u32(start.rawData,3),fileName=parseNullTerminatedString(start.rawData,7),chunks=[];let done=0,page=0;while(done<fileSize){if(page>0xffff)throw new Error('EP-series FILE_GET page limit exceeded.');const requestPayload=new Uint8Array(4),requestView=new DataView(requestPayload.buffer);requestPayload[0]=TE_SYSEX_FILE_GET;requestPayload[1]=TE_SYSEX_FILE_GET_TYPE_DATA;requestView.setUint16(2,page);const response=await requestRead(TE_SYSEX_FILE,requestPayload);const chunk=validateFileGetChunk(response.rawData,page,fileSize-done);chunks.push(chunk);done+=chunk.length;onProgress?.(done,fileSize);page+=1;}if(done!==fileSize)throw new Error(`Incomplete FILE_GET: received ${done} of ${fileSize} bytes.`);const data=new Uint8Array(done);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return{name:fileName,size:fileSize,data};});}
