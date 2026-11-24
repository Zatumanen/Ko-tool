import{crc32}from '../zip.js';
const decode=new TextDecoder('utf-8',{fatal:true});
const str=b=>decode.decode(b);
const u16=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(o,true);
const u32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o,true);
const assert=(v,message)=>{if(!v)throw Error('ZIP: '+message);};
async function inflateBounded(compressed,limit,method){
  if(method===0){
    assert(compressed.length===limit,'stored ZIP size mismatch');
    return compressed.slice();
  }
  assert(method===8,'unsupported ZIP method '+method);
  assert(typeof DecompressionStream==='function','browser does not support ZIP/Deflate preview');
  let stream;
  try{stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
  catch{throw new Error('ZIP: browser cannot initialize raw ZIP/Deflate');}
  const reader=stream.getReader();
  const result=new Uint8Array(limit);
  let pos=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(pos+value.length>limit){
        await reader.cancel();
        throw new Error('ZIP: decompressed ZIP file exceeds its declared size');
      }
      result.set(value,pos);pos+=value.length;
    }
  }catch(error){
    try{await reader.cancel();}catch{}
    throw error;
  }
  assert(pos===limit,'decompressed ZIP size mismatch');
  return result;
}

function readZipDirectory(value,{checkPath,limits={},storedOnly=false}={}){
  const {zipMax:ZIP_MAX=128*1024*1024,expandedMax:EXPANDED_MAX=384*1024*1024,fileMax:FILE_MAX=32*1024*1024,entryMax:ENTRY_MAX=1500,maxRatio:MAX_RATIO=500}=limits;
  assert(typeof checkPath==='function','path policy is required');
  const sharedAvailable=typeof SharedArrayBuffer==='function';
  const isBuffer=value instanceof ArrayBuffer||(sharedAvailable&&value instanceof SharedArrayBuffer);
  const length=isBuffer?value.byteLength:value?.length;
  assert(Number.isSafeInteger(length)&&length>=22&&length<=ZIP_MAX,'ZIP size outside safe limits');
  const input=value instanceof Uint8Array?value:isBuffer
    ?new Uint8Array(value,0,length)
    :Uint8Array.from({length},(_,index)=>value[index]);
  const src=sharedAvailable&&input.buffer instanceof SharedArrayBuffer?Uint8Array.from(input.subarray(0,length)):input;
  let eocd=-1;
  const min=Math.max(0,src.length-65557);
  for(let i=src.length-22;i>=min;i--){
    if(u32(src,i)===0x06054b50&&i+22+u16(src,i+20)===src.length){eocd=i;break;}
  }
  assert(eocd>=0,'ZIP end-of-central-directory not found');
  assert(u16(src,eocd+4)===0&&u16(src,eocd+6)===0,'multi-disk ZIP is unsupported');
  const count=u16(src,eocd+10),size=u32(src,eocd+12),start=u32(src,eocd+16);
  assert(count===u16(src,eocd+8)&&count>0&&count<=ENTRY_MAX,'invalid ZIP entry count');
  assert(size!==0xffffffff&&start!==0xffffffff&&start+size===eocd,
    'invalid ZIP central directory bounds');
  const files=new Map(),records=[];
  let pos=start,total=0;
  for(let i=0;i<count;i++){
    assert(pos+46<=eocd&&u32(src,pos)===0x02014b50,'invalid ZIP central header');
    const flags=u16(src,pos+8),method=u16(src,pos+10),crc=u32(src,pos+16);
    const packed=u32(src,pos+20),unpacked=u32(src,pos+24);
    const nlen=u16(src,pos+28),extra=u16(src,pos+30),comment=u16(src,pos+32);
    const disk=u16(src,pos+34),offset=u32(src,pos+42);
    const next=pos+46+nlen+extra+comment;
    assert(next<=eocd&&disk===0,'invalid ZIP central entry');
    assert(!(flags&1)&&!(flags&~0x808)&&[0,8].includes(method),
      'encrypted or unsupported ZIP entry flags/method');
    if(storedOnly)assert(method===0&&!(flags&8),'legacy ZIP requires stored entries without data descriptors');
    assert(packed!==0xffffffff&&unpacked!==0xffffffff&&offset!==0xffffffff,
      'ZIP64 archive is unsupported');
    assert(unpacked<=FILE_MAX&&packed<=ZIP_MAX&&
      (!packed?unpacked===0:unpacked<=packed*MAX_RATIO+65536),'ZIP entry exceeds safety limits');
    total+=unpacked;
    assert(total<=EXPANDED_MAX,'expanded ZIP exceeds memory limit');
    const name=checkPath(str(src.subarray(pos+46,pos+46+nlen)));
    assert(!files.has(name),'duplicate ZIP entry '+name);
    files.set(name,null);
    records.push({name,flags,method,crc,packed,unpacked,offset});
    pos=next;
  }
  assert(pos===eocd,'ZIP central directory size mismatch');
  const spans=[];
  for(const r of records){
    const p=r.offset;
    assert(p+30<=start&&u32(src,p)===0x04034b50,'invalid ZIP local header');
    const flags=u16(src,p+6),method=u16(src,p+8);
    const nl=u16(src,p+26),el=u16(src,p+28),dataStart=p+30+nl+el;
    const dataEnd=dataStart+r.packed;
    assert(flags===r.flags&&method===r.method&&dataEnd<=start,'ZIP local/central disagreement');
    assert(str(src.subarray(p+30,p+30+nl))===r.name,'ZIP local/central name disagreement');
    if(!(flags&8))assert(u32(src,p+14)===r.crc&&
      u32(src,p+18)===r.packed&&u32(src,p+22)===r.unpacked,
      'ZIP local size/CRC mismatch');
    spans.push([p,dataEnd]);
    r.start=dataStart;r.end=dataEnd;
  }
  spans.sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<spans.length;i++)
    assert(spans[i][0]>=spans[i-1][1],'overlapping ZIP entries');
  return{src,records};
}

/** Parse bounded ZIPs with validation before exposing any files. */
export async function readZip(value,options){
  const{src,records}=readZipDirectory(value,options);
  const files=new Map();
  for(const r of records){
    const raw=await inflateBounded(src.subarray(r.start,r.end),r.unpacked,r.method);
    assert(crc32(raw)===r.crc,'ZIP CRC mismatch for '+r.name);
    files.set(r.name,raw);
  }
  return files;
}

/** Bounded, synchronous reader for stored ZIPs. Values view validated bytes. Shared buffers are snapshotted. */
export function readStoredZipViews(value,options){
  const{src,records}=readZipDirectory(value,{...options,storedOnly:true});
  const files=new Map();
  for(const entry of records){
    const data=src.subarray(entry.start,entry.end);
    assert(data.length===entry.unpacked,'stored ZIP size mismatch');
    assert(crc32(data)===entry.crc,'ZIP CRC mismatch for '+entry.name);
    files.set(entry.name,data);
  }
  return files;
}
