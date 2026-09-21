import{TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA,TE_SYSEX_FILE_FILE_TYPE_FILE}from './constants.js';
import{request}from './device.js';
import{parseNullTerminatedString}from './packing.js';

function u16(a,i){return(a[i]<<8)|a[i+1]}
function u32(a,i){return((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0}
function initRead(max=4*1024*1024){const p=new Uint8Array(6);p[0]=TE_SYSEX_FILE_INIT;p[1]=0;new DataView(p.buffer).setUint32(2,max);return request(TE_SYSEX_FILE,p);}
function listPayload(page,node){const p=new Uint8Array(5);p[0]=TE_SYSEX_FILE_LIST;new DataView(p.buffer).setUint16(1,page);new DataView(p.buffer).setUint16(3,node);return p}
function parseList(data){const out=[];let o=0;while(o+7<=data.length){const nodeId=u16(data,o),flags=data[o+2],size=u32(data,o+3),name=parseNullTerminatedString(data,o+7);out.push({nodeId,flags,fileSize:size,fileName:name,fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder'});o+=8+name.length;}return out}
export async function listDeviceFiles(onProgress){
  await initRead();
  const result=[];
  async function walk(nodeId=0,path='/'){
    for(let page=0;;page++){
      const response=await request(TE_SYSEX_FILE,listPayload(page,nodeId));
      const raw=response.rawData;
      if(raw.length<2)break;
      const pageNo=u16(raw,0);
      if(pageNo!==page)throw new Error(`Unexpected EP-133 file-list page ${pageNo}, expected ${page}`);
      const entries=parseList(raw.slice(2));
      if(!entries.length)break;
      for(const entry of entries){
        const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;
        const item={...entry,fileName:full};
        result.push(item);onProgress?.(item,result.length);
        if(entry.fileType==='folder')await walk(entry.nodeId,full);
      }
    }
  }
  await walk();
  return result;
}
export async function getFile(nodeId,onProgress){
  await initRead();
  const init=new Uint8Array(8);init[0]=TE_SYSEX_FILE_GET;init[1]=TE_SYSEX_FILE_GET_TYPE_INIT;new DataView(init.buffer).setUint16(2,nodeId);new DataView(init.buffer).setUint32(4,0);
  const start=await request(TE_SYSEX_FILE,init);
  const total=start.rawData.length>=7?u32(start.rawData,3):0;
  const chunks=[];let done=0;
  for(let page=0;done<total;){
    const p=new Uint8Array(4);p[0]=TE_SYSEX_FILE_GET;p[1]=TE_SYSEX_FILE_GET_TYPE_DATA;new DataView(p.buffer).setUint16(2,page);
    const r=await request(TE_SYSEX_FILE,p);const raw=r.rawData;
    if(raw.length<2)break;
    const got=u16(raw,0);if(got!==page)throw new Error(`Unexpected EP-133 file page ${got}, expected ${page}`);
    const data=raw.slice(2);if(!data.length)break;
    chunks.push(data);done+=data.length;onProgress?.(done,total);page++;
  }
  const data=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let o=0;for(const c of chunks){data.set(c,o);o+=c.length}
  return{name:new TextDecoder().decode(start.rawData.slice(7)).replace(/\0.*$/,''),size:total,data};
}
