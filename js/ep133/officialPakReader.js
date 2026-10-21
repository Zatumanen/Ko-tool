import{parseProjectArchive}from './projectArchiveCore.js?v=20261001-1';
import{crc32Hex}from './projectRecovery.js?v=20261001-1';

const decode=new TextDecoder('utf-8',{fatal:true});
const encoder=new TextEncoder();
const asBytes=v=>v instanceof Uint8Array?v:new Uint8Array(v||[]);
const str=b=>decode.decode(b);
const u16=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(o,true);
const u32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o,true);
const hex=s=>parseInt(s,16)>>>0;
const assert=(v,message)=>{if(!v)throw new Error('Official PAK: '+message);};
const ZIP_MAX=128*1024*1024;
const EXPANDED_MAX=384*1024*1024;
const FILE_MAX=32*1024*1024;
const ENTRY_MAX=1500;
const MAX_RATIO=500;
const padPattern=/^\/projects\/P([0-9]{2})\.tar$/;
const soundPattern=/^\/sounds\/([0-9]{3}) (.+)\.wav$/i;
const metaPath='/meta.json';

const checkedPath=path=>{
  assert(path.startsWith('/')&&!path.includes('\\')&&!path.includes('\0'),'unsafe ZIP entry path');
  const bits=path.slice(1).split('/');
  assert(bits.every(x=>x&&x!=='.'&&x!=='..'),'unsafe ZIP path traversal');
  assert(path===metaPath||padPattern.test(path)||soundPattern.test(path),
    'unsupported archive entry path '+path);
  return path;
};

async function inflateBounded(compressed,limit,method){
  if(method===0){
    assert(compressed.length===limit,'stored ZIP size mismatch');
    return compressed.slice();
  }
  assert(method===8,'unsupported ZIP method '+method);
  assert(typeof DecompressionStream==='function','browser does not support ZIP/Deflate preview');
  let stream;
  try{stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
  catch{throw new Error('Official PAK: browser cannot initialize raw ZIP/Deflate');}
  const reader=stream.getReader();
  const result=new Uint8Array(limit);
  let pos=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(pos+value.length>limit){
        await reader.cancel();
        throw new Error('Official PAK: decompressed ZIP file exceeds its declared size');
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

/** Parse ZIP central directory, enforce explicit memory bounds and validate
 * every entry before exposing any files. No filesystem or device operations.
 */
export async function readOfficialPakZip(value){
  const src=asBytes(value);
  assert(src.length>=22&&src.length<=ZIP_MAX,'ZIP size outside safe limits');
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
    assert(packed!==0xffffffff&&unpacked!==0xffffffff&&offset!==0xffffffff,
      'ZIP64 archive is unsupported');
    assert(unpacked<=FILE_MAX&&packed<=ZIP_MAX&&
      (!packed?unpacked===0:unpacked<=packed*MAX_RATIO+65536),'ZIP entry exceeds safety limits');
    total+=unpacked;
    assert(total<=EXPANDED_MAX,'expanded ZIP exceeds memory limit');
    const name=checkedPath(str(src.subarray(pos+46,pos+46+nlen)));
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
  for(const r of records){
    const raw=await inflateBounded(src.subarray(r.start,r.end),r.unpacked,r.method);
    assert(hex(crc32Hex(raw))===r.crc,'ZIP CRC mismatch for '+r.name);
    files.set(r.name,raw);
  }
  return files;
}

const readWav=(raw,slot)=>{
  assert(raw.length>=44&&str(raw.subarray(0,4))==='RIFF'&&
    str(raw.subarray(8,12))==='WAVE','invalid WAV RIFF header in slot '+slot);
  assert(u32(raw,4)+8===raw.length,'WAV RIFF size mismatch for slot '+slot);
  let pos=12,fmt=null,pcm=null,tnge=null,smpl=null,acid=null;
  const unknown=[];
  while(pos<raw.length){
    assert(pos+8<=raw.length,'truncated WAV chunk for '+slot);
    const tag=str(raw.subarray(pos,pos+4)),len=u32(raw,pos+4),end=pos+8+len;
    assert(end<=raw.length,'WAV chunk length exceeds file for '+slot);
    const body=raw.subarray(pos+8,end);
    if(tag==='fmt '){
      assert(fmt===null&&len===16,'unsupported WAV fmt for '+slot);fmt=body;
    }else if(tag==='data'){
      assert(pcm===null&&len>0,'empty or duplicate WAV data for '+slot);pcm=body;
    }else if(tag==='smpl'){
      assert(smpl===null&&len>=36,'invalid WAV smpl for '+slot);smpl=body;
    }else if(tag==='acid'){
      assert(acid===null&&len>=24,'invalid WAV acid for '+slot);acid=body;
    }else if(tag==='LIST'){
      assert(tnge===null&&len>=12&&str(body.subarray(0,4))==='INFO'&&
        str(body.subarray(4,8))==='TNGE','invalid WAV INFO/TNGE for '+slot);
      const n=u32(body,8);
      assert(n>0&&12+n<=body.length,'truncated WAV TNGE for '+slot);
      const data=body.subarray(12,12+n);
      const nul=data.indexOf(0);
      assert(nul>=0&&data.subarray(nul).every(v=>v===0),'WAV TNGE missing NUL termination');
      try{tnge=JSON.parse(str(data.subarray(0,nul)));}
      catch{throw new Error('Official PAK: invalid WAV TNGE JSON for slot '+slot);}
      assert(tnge&&typeof tnge==='object'&&!Array.isArray(tnge),'invalid WAV metadata for '+slot);
    }else unknown.push(tag);
    pos=end+(len&1);
    assert(pos<=raw.length,'invalid WAV chunk padding');
  }
  assert(fmt&&pcm&&smpl&&tnge,'WAV missing required TE chunks for '+slot);
  assert(u16(fmt,0)===1&&[1,2].includes(u16(fmt,2))&&u16(fmt,14)===16,
    'unsupported WAV PCM format for '+slot);
  const channels=u16(fmt,2),rate=u32(fmt,4);
  assert(rate>=8000&&rate<=192000&&u16(fmt,12)===channels*2&&
    u32(fmt,8)===rate*channels*2,'inconsistent WAV rate/block size');
  assert(pcm.length%(channels*2)===0,'truncated WAV PCM for '+slot);
  const root=u32(smpl,12);
  assert(root>0&&root<=127&&tnge['sound.rootnote']===root,
    'WAV root note metadata mismatch for '+slot);
  if(acid&&typeof tnge['sound.bpm']==='number')
    assert(Math.abs(new DataView(acid.buffer,acid.byteOffset,acid.byteLength).getFloat32(20,true)-
      tnge['sound.bpm'])<0.001,'WAV ACID BPM mismatch for '+slot);
  return Object.freeze({channels,sampleRate:rate,sampleFrames:pcm.length/(channels*2),
    pcmBytes:pcm.length,pcmCrc32:crc32Hex(pcm),rootNote:root,
    metadata:Object.freeze({...tnge}),unknownChunks:Object.freeze(unknown)});
};

/** Read-only archive inventory. Data stays in memory and is never a restore
 * argument. The manifest metadata is archival identity, NOT permission to write.
 */
export async function inspectOfficialPak(input){
  const files=await readOfficialPakZip(input);
  assert(files.has(metaPath),'meta.json missing');
  let meta;
  try{meta=JSON.parse(str(files.get(metaPath)));}
  catch{throw new Error('Official PAK: invalid meta.json');}
  assert(meta&&typeof meta==='object'&&meta.info==='teenage engineering - pak file'&&
    meta.pak_version===1&&['user','project'].includes(meta.pak_type),
    'unsupported official PAK version/type');
  const projects=[],sounds=[],known=new Set(),warnings=[];
  for(const [path,data] of files){
    if(path===metaPath)continue;
    const projectMatch=path.match(padPattern);
    if(projectMatch){
      const number=projectMatch[1];
      assert(!projects.some(p=>p.number===number),'duplicate project '+number);
      const members=parseProjectArchive(data);
      const references=[];
      for(const member of members){
        const match=member.path.match(/^pads\/([abcd])\/p(0[1-9]|1[0-2])$/);
        if(!match)continue;
        assert([26,27,29].includes(member.data.length),'unsupported pad-record length in P'+number);
        const slot=member.data[1]|(member.data[2]<<8);
        if(slot>=1&&slot<=999)references.push({slot,group:match[1].toUpperCase(),pad:Number(match[2])});
      }
      projects.push(Object.freeze({number,size:data.length,crc32:crc32Hex(data),
        padReferences:Object.freeze(references)}));
    }else{
      const soundMatch=path.match(soundPattern);
      assert(!!soundMatch,'unexpected official archive entry');
      const slot=Number(soundMatch[1]);
      assert(slot>=1&&slot<=999&&!known.has(slot),'duplicate or invalid WAV sample slot');
      known.add(slot);
      const name=soundMatch[2],wav=readWav(data,slot);
      sounds.push(Object.freeze({slot,name,size:data.length,...wav}));
      for(const unknown of wav.unknownChunks)warnings.push('Slot '+slot+' unknown WAV chunk '+unknown);
    }
  }
  assert(projects.length>0,'no project TARs in official PAK');
  if(meta.pak_type==='project')assert(projects.length===1,'project PPAK includes multiple project TARs');
  projects.sort((a,b)=>a.number.localeCompare(b.number));
  sounds.sort((a,b)=>a.slot-b.slot);
  const available=new Set(sounds.map(s=>s.slot));
  const dependencyRows=projects.map(p=>{
    const missing=[...new Set(p.padReferences.map(x=>x.slot))].filter(slot=>!available.has(slot));
    return Object.freeze({project:p.number,references:p.padReferences.length,
      missing:Object.freeze(missing)});
  });
  if(dependencyRows.some(x=>x.missing.length))
    warnings.push('Some project pad references are missing from this archive; no restore is permitted.');
  return Object.freeze({format:meta.pak_type==='user'?'pak':'ppak',
    metadata:Object.freeze({...meta}),projects:Object.freeze(projects),
    sounds:Object.freeze(sounds),dependencies:Object.freeze(dependencyRows),
    warnings:Object.freeze(warnings)});
}
