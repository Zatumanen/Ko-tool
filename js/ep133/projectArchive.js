const TAR_BLOCK_SIZE=512;
const TAR_END_BLOCKS=2;

const toBytes=input=>input instanceof Uint8Array?input:new Uint8Array(input||[]);
const byteString=(bytes,start,length)=>{
  let out='';
  const end=Math.min(bytes.length,start+length);
  for(let i=start;i<end&&bytes[i]!==0;i++)out+=String.fromCharCode(bytes[i]);
  return out;
};
const normalizePath=path=>String(path||'').replace(/^\.\//,'').replace(/\/{2,}/g,'/').replace(/\/$/,'');
const isZeroBlock=(bytes,offset)=>{
  if(offset+TAR_BLOCK_SIZE>bytes.length)return false;
  for(let i=offset;i<offset+TAR_BLOCK_SIZE;i++)if(bytes[i]!==0)return false;
  return true;
};
const parseOctalField=(bytes,start,length,label)=>{
  const raw=byteString(bytes,start,length).trim();
  if(!raw)return 0;
  if(!/^[0-7]+$/.test(raw))throw new Error('Invalid project TAR '+label+' field.');
  return Number.parseInt(raw,8);
};
const checksumForHeader=header=>{
  let sum=0;
  for(let i=0;i<TAR_BLOCK_SIZE;i++)sum+=i>=148&&i<156?0x20:header[i];
  return sum;
};
const parseHeaderPath=header=>{
  const name=byteString(header,0,100);
  const prefix=byteString(header,345,155);
  return normalizePath(prefix?prefix+'/'+name:name);
};

export function parseProjectArchive(input){
  const bytes=toBytes(input);
  if(bytes.byteLength===0||bytes.byteLength%TAR_BLOCK_SIZE!==0)
    throw new Error('Project archive must be a non-empty 512-byte-aligned TAR.');
  const members=[];
  let offset=0,zeroBlocks=0;
  while(offset<bytes.length){
    if(isZeroBlock(bytes,offset)){
      zeroBlocks+=1;
      offset+=TAR_BLOCK_SIZE;
      if(zeroBlocks>=TAR_END_BLOCKS){
        for(let i=offset;i<bytes.length;i++)if(bytes[i]!==0)throw new Error('Project TAR contains data after the end blocks.');
        return members;
      }
      continue;
    }
    if(zeroBlocks)throw new Error('Project TAR contains a member after a partial end marker.');
    const header=bytes.slice(offset,offset+TAR_BLOCK_SIZE);
    const path=parseHeaderPath(header);
    if(!path)throw new Error('Project TAR contains a member with an empty path.');
    const size=parseOctalField(header,124,12,'size');
    const storedChecksum=parseOctalField(header,148,8,'checksum');
    const actualChecksum=checksumForHeader(header);
    if(storedChecksum!==actualChecksum)
      throw new Error('Project TAR checksum mismatch for '+path+'.');
    const typeByte=header[156];
    const type=typeByte===0?'0':String.fromCharCode(typeByte);
    if(type!=='0'&&type!=='5')throw new Error('Unsupported project TAR member type '+JSON.stringify(type)+' for '+path+'.');
    const dataStart=offset+TAR_BLOCK_SIZE;
    const dataEnd=dataStart+size;
    const next=dataStart+Math.ceil(size/TAR_BLOCK_SIZE)*TAR_BLOCK_SIZE;
    if(dataEnd>bytes.length||next>bytes.length)throw new Error('Project TAR member exceeds archive size: '+path+'.');
    members.push({path,type,size,data:bytes.slice(dataStart,dataEnd)});
    offset=next;
  }
  throw new Error('Project TAR is missing the two 512-byte end blocks.');
}

const u16le=(bytes,offset)=>bytes[offset]|(bytes[offset+1]<<8);
const signed8=value=>value>127?value-256:value;

function validatePad(member){
  const data=member.data;
  if(data.length===27)throw new Error(member.path+' uses the unsafe 27-byte pad-record form.');
  if(data.length!==26)throw new Error(member.path+' must be a native 26-byte pad record.');
  if(data[0]!==0)throw new Error(member.path+' has a nonzero validity byte.');
  const slot=u16le(data,1);
  if(slot>999)throw new Error(member.path+' references sample slot '+slot+' outside 0..999.');
  const pitch=signed8(data[17]),pan=signed8(data[18]);
  if(data[16]>200)throw new Error(member.path+' has amplitude outside 0..200.');
  if(pitch<-12||pitch>12)throw new Error(member.path+' has pitch outside -12..12.');
  if(pan<-16||pan>16)throw new Error(member.path+' has pan outside -16..16.');
  if(data[21]>3)throw new Error(member.path+' has an invalid time-stretch mode.');
  if(data[23]>3)throw new Error(member.path+' has an invalid play mode.');
  if(data[24]>127)throw new Error(member.path+' has an invalid root note.');
}

function validatePattern(member){
  const data=member.data;
  if(data.length<4||(data.length-4)%8!==0)throw new Error(member.path+' is not 4 + N*8 bytes.');
  if(data[0]!==0)throw new Error(member.path+' has a nonzero pattern header byte 0.');
  const recordCount=(data.length-4)/8;
  if(recordCount<=255&&data[2]!==recordCount)
    throw new Error(member.path+' record count does not match its payload.');
  for(let index=0;index<recordCount;index++){
    const offset=4+index*8;
    const recordType=data[offset+2];
    if(recordType===0x01||recordType===0x05){
      const value=u16le(data,offset+5);
      if(value>32767)throw new Error(member.path+' automation record '+index+' exceeds 32767.');
    }
  }
}

function validateScenes(member,patternPaths){
  const data=member.data;
  if(data.length!==712)throw new Error('scenes must be exactly 712 bytes.');
  const groups=['a','b','c','d'];
  for(let scene=0;scene<99;scene++){
    const offset=7+scene*6;
    const refs=[data[offset],data[offset+1],data[offset+2],data[offset+3]];
    const numerator=data[offset+4],denominator=data[offset+5];
    const empty=refs.every(value=>value===0);
    if(empty){
      if(numerator!==4||denominator!==4)
        throw new Error('scenes entry '+(scene+1)+' is unused but does not retain the required 4/4 signature.');
      continue;
    }
    if(numerator===0||denominator===0)throw new Error('scenes entry '+(scene+1)+' has an invalid time signature.');
    for(let group=0;group<4;group++){
      const pattern=refs[group];
      if(!pattern)continue;
      if(pattern>99)throw new Error('scenes entry '+(scene+1)+' references pattern '+pattern+' outside 1..99.');
      const path='patterns/'+groups[group]+String(pattern).padStart(2,'0');
      if(!patternPaths.has(path))throw new Error('scenes entry '+(scene+1)+' references missing '+path+'.');
    }
  }
}

function validateSettings(member){
  const data=member.data;
  if(data.length!==222&&data.length!==224)throw new Error('settings must be 222 or 224 bytes.');
  for(let i=0;i<4;i++)if(data[i]!==0)throw new Error('settings bytes 0..3 must remain zero.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const bpm=view.getFloat32(4,true);
  if(!Number.isFinite(bpm)||bpm<=0)throw new Error('settings contains an invalid project BPM.');
  for(let group=0;group<4;group++)for(let param=0;param<12;param++){
    const value=view.getFloat32(24+group*48+param*4,true);
    if(!Number.isFinite(value)||(value!==-1&&(value<0||value>1)))
      throw new Error('settings contains an invalid fader base.');
  }
  for(let i=216;i<=219;i++)if(data[i]>11)throw new Error('settings contains an invalid fader assignment.');
}

function validateFxSettings(member){
  const data=member.data;
  if(![144,152,160].includes(data.length))throw new Error('fx_settings must be 144, 152, or 160 bytes.');
  if(data[4]>6)throw new Error('fx_settings contains an invalid master FX type.');
}

export function validateProjectArchive(input){
  const members=parseProjectArchive(input);
  const seen=new Set(),patternPaths=new Set(),scenesMembers=[];
  let pads=0,patterns=0,files=0,directories=0,unknownFiles=0;
  for(const member of members){
    if(seen.has(member.path))throw new Error('Project TAR contains duplicate member '+member.path+'.');
    seen.add(member.path);
    if(member.type==='5'){directories+=1;continue;}
    files+=1;
    let match=member.path.match(/^pads\/[abcd]\/p(0[1-9]|1[0-2])$/);
    if(match){validatePad(member);pads+=1;continue;}
    match=member.path.match(/^patterns\/([abcd])(0[1-9]|[1-9][0-9])$/);
    if(match){validatePattern(member);patternPaths.add(member.path);patterns+=1;continue;}
    if(member.path==='scenes'){scenesMembers.push(member);continue;}
    if(member.path==='settings'){validateSettings(member);continue;}
    if(member.path==='fx_settings'){validateFxSettings(member);continue;}
    unknownFiles+=1;
  }
  for(const member of scenesMembers)validateScenes(member,patternPaths);
  return{members:members.length,files,directories,pads,patterns,scenes:scenesMembers.length,unknownFiles};
}
