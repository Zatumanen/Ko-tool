import{readZip}from '../archive/zipReader.js?v=20261001-1';
import{parseProjectArchive}from './projectArchiveCore.js?v=20261001-1';
import{crc32Hex}from './projectRecovery.js?v=20261001-1';

const decode=new TextDecoder('utf-8',{fatal:true});
const encoder=new TextEncoder();
const asBytes=v=>v instanceof Uint8Array?v:new Uint8Array(v||[]);
const str=b=>decode.decode(b);
const u16=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(o,true);
const u32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o,true);
const assert=(v,message)=>{if(!v)throw new Error('Official PAK: '+message);};
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

export async function readOfficialPakZip(value){
  try{return await readZip(value,{checkPath:checkedPath});}
  catch(error){throw new Error('Official PAK: '+error.message.replace(/^ZIP: /,''));}
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
