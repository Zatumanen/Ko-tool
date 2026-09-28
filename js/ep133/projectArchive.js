const TAR_BLOCK_SIZE=512;
const TAR_END_BLOCKS=2;
const DEFAULT_PROJECT_PROFILE=Object.freeze({
  id:'ep133',padRecordSize:26,acceptedPadRecordSizes:[26],
  patternDialect:'ep133',patternHeaderSize:4,settingsSizes:[222,224],
  fxSettingsSizes:[144,152,160],scenesSize:712,supportsLoop:false,
  supportsSupertone:false,supportsLive:false,requiresFullSceneRefs:true
});
const profileOrDefault=profile=>profile&&typeof profile==='object'?profile:DEFAULT_PROJECT_PROFILE;

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
    members.push({path,type,size,data:bytes.slice(dataStart,dataEnd),header:header.slice()});
    offset=next;
  }
  throw new Error('Project TAR is missing the two 512-byte end blocks.');
}

const u16le=(bytes,offset)=>bytes[offset]|(bytes[offset+1]<<8);
const signed8=value=>value>127?value-256:value;

function validatePad(member,profile){
  const data=member.data;
  const accepted=Array.isArray(profile.acceptedPadRecordSizes)?profile.acceptedPadRecordSizes:[profile.padRecordSize].filter(Boolean);
  if(!accepted.includes(data.length))
    throw new Error(member.path+' has pad-record size '+data.length+' but '+profile.id+' requires '+accepted.join(' or ')+' bytes.');
  if(data[0]!==0)throw new Error(member.path+' has a nonzero validity byte.');
  const slot=u16le(data,1);
  const maxSlot=profile.supportsSupertone?1009:999;
  if(slot>maxSlot)throw new Error(member.path+' references slot/symbol '+slot+' outside 0..'+maxSlot+'.');
  if(slot>999&&!profile.supportsSupertone)throw new Error(member.path+' uses an unsupported synth symbol.');
  const pitch=signed8(data[17]),pan=signed8(data[18]);
  if(data[16]>200)throw new Error(member.path+' has amplitude outside 0..200.');
  if(pitch<-12||pitch>12)throw new Error(member.path+' has pitch outside -12..12.');
  if(pan<-16||pan>16)throw new Error(member.path+' has pan outside -16..16.');
  if(data[21]>3)throw new Error(member.path+' has an invalid time-stretch mode.');
  const maxPlayMode=profile.supportsLoop?3:2;
  if(data[23]>maxPlayMode)throw new Error(member.path+' has an invalid play mode for '+profile.id+'.');
  if(data[24]>127)throw new Error(member.path+' has an invalid root note.');
  if(profile.supportsSupertone&&slot>=1000){
    if(data.length<29)throw new Error(member.path+' supertone pad needs a 29-byte record.');
    if(data[27]>254||data[28]>254)throw new Error(member.path+' has a supertone knob outside 0..254.');
  }
}

function patternShape(member,profile){
  const data=member.data;
  if(profile.patternDialect==='ep40'){
    if(data.length<6||(data.length-6)%8!==0)throw new Error(member.path+' is not 6 + N*8 bytes for EP-40.');
    if(data[0]!==1||data[2]!==0xff||data[3]!==0xff)
      throw new Error(member.path+' does not use the native EP-40 pattern header [1,bars,FF,FF,countLE].');
    const recordCount=u16le(data,4);
    if(recordCount!==(data.length-6)/8)throw new Error(member.path+' record count does not match its payload.');
    return{headerSize:6,recordCount};
  }
  if(data.length<4||(data.length-4)%8!==0)throw new Error(member.path+' is not 4 + N*8 bytes.');
  if(data[0]!==0)throw new Error(member.path+' has a nonzero pattern header byte 0.');
  const recordCount=(data.length-4)/8;
  if(recordCount<=255&&data[2]!==recordCount)throw new Error(member.path+' record count does not match its payload.');
  if(data[3]!==0)throw new Error(member.path+' has an unverified nonzero pattern header byte 3.');
  return{headerSize:4,recordCount};
}

function validatePattern(member,profile){
  const {headerSize,recordCount}=patternShape(member,profile);
  const data=member.data;
  for(let index=0;index<recordCount;index++){
    const offset=headerSize+index*8;
    const recordType=data[offset+2];
    if(recordType===0x01||recordType===0x05){
      const value=u16le(data,offset+5);
      if(value>32767)throw new Error(member.path+' automation record '+index+' exceeds 32767.');
    }else if(recordType%8===0&&recordType<=0x58){
      const velocity=data[offset+4];
      const duration=u16le(data,offset+5);
      if(velocity===0||velocity>127)throw new Error(member.path+' note record '+index+' has velocity outside 1..127.');
      if(duration<1)throw new Error(member.path+' note record '+index+' has zero duration.');
    }
  }
}

function validateScenes(member,patternPaths,profile){
  const data=member.data;
  const expected=Number(profile.scenesSize)||712;
  if(data.length!==expected)throw new Error('scenes must be exactly '+expected+' bytes.');
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
    if(profile.requiresFullSceneRefs!==false&&refs.some(value=>value===0))
      throw new Error('scenes entry '+(scene+1)+' has a partial-zero group-pattern reference.');
    if(numerator===0||denominator===0)throw new Error('scenes entry '+(scene+1)+' has an invalid time signature.');
    for(let group=0;group<4;group++){
      const pattern=refs[group];
      if(!pattern)continue;
      if(pattern>99)throw new Error('scenes entry '+(scene+1)+' references pattern '+pattern+' outside 1..99.');
      const path='patterns/'+groups[group]+String(pattern).padStart(2,'0');
      if(!patternPaths.has(path))throw new Error('scenes entry '+(scene+1)+' references missing '+path+'.');
    }
  }
  const trailerOffset=7+99*6;
  const currentScene=data[trailerOffset+3];
  const songLength=data[trailerOffset+11];
  if(currentScene>99)throw new Error('scenes current-scene cursor is outside 0..99.');
  if(songLength>data.length-(trailerOffset+12))throw new Error('scenes song length exceeds the trailer capacity.');
  for(let i=0;i<songLength;i++){
    const sceneNo=data[trailerOffset+12+i];
    if(sceneNo<1||sceneNo>99)throw new Error('scenes song entry '+i+' is outside 1..99.');
  }
}

function validateSettings(member,profile){
  const data=member.data;
  const sizes=Array.isArray(profile.settingsSizes)?profile.settingsSizes:[222,224];
  if(!sizes.includes(data.length))throw new Error('settings must be '+sizes.join(' or ')+' bytes for '+profile.id+'.');
  for(let i=0;i<4;i++)if(data[i]!==0)throw new Error('settings bytes 0..3 must remain zero.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const bpm=view.getFloat32(4,true);
  if(!Number.isFinite(bpm)||bpm<40||bpm>399)throw new Error('settings contains a project BPM outside 40..399.');
  for(let group=0;group<4;group++)for(let param=0;param<12;param++){
    const value=view.getFloat32(24+group*48+param*4,true);
    if(!Number.isFinite(value)||(value!==-1&&(value<0||value>1)))
      throw new Error('settings contains an invalid fader base.');
  }
  for(let i=216;i<=219;i++)if(data[i]>11)throw new Error('settings contains an invalid fader assignment.');
}

function validateFxSettings(member,profile){
  const data=member.data;
  const sizes=Array.isArray(profile.fxSettingsSizes)?profile.fxSettingsSizes:[144,152,160];
  if(!sizes.includes(data.length))throw new Error('fx_settings must be '+sizes.join(', ')+' bytes for '+profile.id+'.');
  if(data[4]>6)throw new Error('fx_settings contains an invalid master FX type.');
}

function validateLive(member,profile){
  if(!profile.supportsLive)throw new Error('live member is not verified for '+profile.id+'.');
  if(member.data.length!==48)throw new Error('live must be exactly 48 bytes.');
  for(const value of member.data)if(value!==0&&value!==1)throw new Error('live contains a value other than 0 or 1.');
}

export function validateProjectArchive(input,{profile}={}){
  profile=profileOrDefault(profile);
  if(profile.patternDialect==='unverified')throw new Error('Project archive validation is not verified for '+profile.id+'.');
  const members=parseProjectArchive(input);
  const seen=new Set(),patternPaths=new Set(),scenesMembers=[];
  let pads=0,patterns=0,files=0,directories=0,unknownFiles=0,live=0;
  let scenesPosition=-1;
  for(let index=0;index<members.length;index++){
    const member=members[index];
    if(seen.has(member.path))throw new Error('Project TAR contains duplicate member '+member.path+'.');
    seen.add(member.path);
    if(member.type==='5'){directories+=1;continue;}
    files+=1;
    let match=member.path.match(/^pads\/[abcd]\/p(0[1-9]|1[0-2])$/);
    if(match){validatePad(member,profile);pads+=1;continue;}
    match=member.path.match(/^patterns\/([abcd])(0[1-9]|[1-9][0-9])$/);
    if(match){
      if(scenesPosition>=0)throw new Error('Project TAR serializes '+member.path+' after scenes; firmware will not register that pattern.');
      validatePattern(member,profile);patternPaths.add(member.path);patterns+=1;continue;
    }
    if(member.path==='scenes'){if(scenesPosition<0)scenesPosition=index;scenesMembers.push(member);continue;}
    if(member.path==='settings'){validateSettings(member,profile);continue;}
    if(member.path==='fx_settings'){validateFxSettings(member,profile);continue;}
    if(member.path==='live'){validateLive(member,profile);live+=1;continue;}
    unknownFiles+=1;
  }
  for(const member of scenesMembers)validateScenes(member,patternPaths,profile);
  if(live&&patterns)throw new Error('live + populated patterns is not a verified project structure.');
  if(live&&seen.has('fx_settings'))throw new Error('live + fx_settings is not a verified project structure.');
  return{members:members.length,files,directories,pads,patterns,scenes:scenesMembers.length,live,unknownFiles,profile:profile.id};
}


const bytesEqual=(a,b)=>{
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
};

export function compareProjectArchiveMembers(expectedInput,actualInput,{ignoreDirectories=true,allowAdditional=true}={}){
  const expected=parseProjectArchive(expectedInput);
  const actual=parseProjectArchive(actualInput);
  const actualByPath=new Map(actual.map(member=>[member.path,member]));
  let matched=0;
  for(const member of expected){
    if(ignoreDirectories&&member.type==='5')continue;
    const got=actualByPath.get(member.path);
    if(!got)throw new Error('Project readback is missing member '+member.path+'.');
    if(got.type!==member.type)throw new Error('Project readback member type changed for '+member.path+'.');
    if(!bytesEqual(member.data,got.data)){
      let mismatch=-1;
      const limit=Math.min(member.data.length,got.data.length);
      for(let i=0;i<limit;i++)if(member.data[i]!==got.data[i]){mismatch=i;break;}
      if(mismatch<0)mismatch=limit;
      throw new Error('Project readback payload mismatch for '+member.path+' at byte '+mismatch+'.');
    }
    matched+=1;
  }
  if(!allowAdditional){
    const expectedPaths=new Set(expected.filter(member=>!(ignoreDirectories&&member.type==='5')).map(member=>member.path));
    const extras=actual.filter(member=>!(ignoreDirectories&&member.type==='5')&&!expectedPaths.has(member.path));
    if(extras.length)throw new Error('Project readback contains unexpected member '+extras[0].path+'.');
  }
  return{
    matched,
    expectedMembers:expected.length,
    actualMembers:actual.length,
    additionalMembers:Math.max(0,actual.length-expected.length)
  };
}


const asciiWrite=(target,offset,length,text)=>{
  const value=String(text||'');
  if(value.length>length)throw new Error('TAR header field is too long.');
  for(let i=0;i<length;i++)target[offset+i]=0;
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i);
    if(code>0x7f)throw new Error('EP project TAR paths must be ASCII.');
    target[offset+i]=code;
  }
};
const writeOctalField=(header,offset,length,value)=>{
  asciiWrite(header,offset,length,Math.max(0,Number(value)||0).toString(8)+'\0');
};
const finalizeTarHeader=header=>{
  header.fill(0x20,148,156);
  const sum=checksumForHeader(header);
  const text=sum.toString(8)+'\0';
  for(let i=0;i<8;i++)header[148+i]=0x20;
  for(let i=0;i<text.length&&i<8;i++)header[148+i]=text.charCodeAt(i);
  return header;
};
const makeMemberHeader=(member,data)=>{
  const type=member.type||'0';
  let header;
  if(member.header instanceof Uint8Array&&member.header.length===TAR_BLOCK_SIZE){
    header=member.header.slice();
  }else{
    header=new Uint8Array(TAR_BLOCK_SIZE);
    asciiWrite(header,0,100,member.path);
    asciiWrite(header,100,8,type==='5'?'0000755\0':'0000644\0');
  }
  asciiWrite(header,0,100,member.path);
  writeOctalField(header,124,12,type==='5'?0:data.length);
  header[156]=type.charCodeAt(0);
  return finalizeTarHeader(header);
};
const concatBytes=parts=>{
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const out=new Uint8Array(total);
  let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}
  return out;
};
const serializeMembers=members=>{
  const parts=[];
  for(const member of members){
    const data=member.type==='5'?new Uint8Array():toBytes(member.data);
    parts.push(makeMemberHeader(member,data));
    if(data.length){
      parts.push(data);
      const padding=(TAR_BLOCK_SIZE-data.length%TAR_BLOCK_SIZE)%TAR_BLOCK_SIZE;
      if(padding)parts.push(new Uint8Array(padding));
    }
  }
  parts.push(new Uint8Array(TAR_BLOCK_SIZE*TAR_END_BLOCKS));
  return concatBytes(parts);
};
const replacementEntries=replacements=>{
  if(replacements instanceof Map)return[...replacements.entries()];
  if(replacements&&typeof replacements==='object')return Object.entries(replacements);
  return[];
};
const normalizeReplacement=(path,value)=>{
  if(value instanceof Uint8Array||value instanceof ArrayBuffer)return{path,type:'0',data:toBytes(value)};
  if(!value||typeof value!=='object')throw new Error('Invalid project member replacement for '+path+'.');
  const type=String(value.type||'0');
  if(type!=='0'&&type!=='5')throw new Error('Invalid project member type for '+path+'.');
  return{path,type,data:type==='5'?new Uint8Array():toBytes(value.data||[])};
};
const sectionPrefix=path=>path.startsWith('patterns/')?'patterns/':path.startsWith('pads/')?path.slice(0,path.lastIndexOf('/')+1):null;
const insertMemberInSection=(members,member)=>{
  const prefix=sectionPrefix(member.path);
  if(prefix){
    let insertAt=-1;
    for(let i=0;i<members.length;i++){
      const path=members[i].path;
      if(path===prefix.slice(0,-1)||path.startsWith(prefix))insertAt=i+1;
      if(path==='scenes'&&prefix==='patterns/'&&insertAt<0)insertAt=i;
    }
    if(insertAt<0&&prefix==='patterns/'){
      const scenes=members.findIndex(item=>item.path==='scenes');
      if(scenes>=0)insertAt=scenes;
    }
    if(insertAt>=0){
      while(insertAt>0&&members[insertAt-1]?.path?.startsWith(prefix)&&members[insertAt-1].path>member.path)insertAt-=1;
      members.splice(insertAt,0,member);return;
    }
  }
  members.push(member);
};

export function patchProjectArchiveMembers(baseInput,replacements,{profile,allowAdditions=true}={}){
  profile=profileOrDefault(profile);
  validateProjectArchive(baseInput,{profile});
  const base=parseProjectArchive(baseInput).map(member=>({...member,data:member.data.slice(),header:member.header.slice()}));
  const byPath=new Map(base.map((member,index)=>[member.path,index]));
  const additions=[];
  for(const[path,value]of replacementEntries(replacements)){
    const replacement=normalizeReplacement(String(path),value);
    if(byPath.has(replacement.path)){
      const index=byPath.get(replacement.path);
      const original=base[index];
      base[index]={...original,type:replacement.type||original.type,data:replacement.data};
    }else{
      if(!allowAdditions)throw new Error('Project patch may not add '+replacement.path+'.');
      additions.push(replacement);
    }
  }
  for(const member of additions.sort((a,b)=>a.path.localeCompare(b.path)))insertMemberInSection(base,member);
  const output=serializeMembers(base);
  validateProjectArchive(output,{profile});
  return output;
}

const requireInteger=(value,min,max,label)=>{
  const number=Number(value);
  if(!Number.isInteger(number)||number<min||number>max)throw new Error(label+' must be '+min+'..'+max+'.');
  return number;
};
const requireFloat=(value,min,max,label)=>{
  const number=Number(value);
  if(!Number.isFinite(number)||number<min||number>max)throw new Error(label+' must be '+min+'..'+max+'.');
  return number;
};
const setU16le=(data,offset,value)=>{data[offset]=value&255;data[offset+1]=(value>>8)&255;};
const setU32le=(data,offset,value)=>{new DataView(data.buffer,data.byteOffset,data.byteLength).setUint32(offset,value,true);};
const setF32le=(data,offset,value)=>{new DataView(data.buffer,data.byteOffset,data.byteLength).setFloat32(offset,value,true);};

export function patchPadRecord(input,changes,{profile}={}){
  profile=profileOrDefault(profile);
  const data=toBytes(input).slice();
  validatePad({path:'pad',data},profile);
  const changingSlot=Object.prototype.hasOwnProperty.call(changes||{},'slot')&&Number(changes.slot)!==u16le(data,1);
  if(changingSlot){
    for(const key of ['trimStart','trimLength','sampleBpm','amplitude','release','timeMode','playMode','rootNote'])
      if(!Object.prototype.hasOwnProperty.call(changes,key))
        throw new Error('Changing a pad slot requires '+key+' to avoid stale playback state.');
  }
  if('slot'in(changes||{})){
    const max=profile.supportsSupertone?1009:999;
    const slot=requireInteger(changes.slot,0,max,'pad slot');
    if(slot>999&&!profile.supportsSupertone)throw new Error('Supertone symbols are not supported by '+profile.id+'.');
    setU16le(data,1,slot);
  }
  if('midiChannel'in changes)data[3]=requireInteger(changes.midiChannel,0,16,'pad midiChannel');
  if('trimStart'in changes)setU32le(data,4,requireInteger(changes.trimStart,0,0xffffffff,'pad trimStart'));
  if('trimLength'in changes)setU32le(data,8,requireInteger(changes.trimLength,0,0xffffffff,'pad trimLength'));
  if('sampleBpm'in changes)setF32le(data,12,requireFloat(changes.sampleBpm,1,399,'pad sampleBpm'));
  if('amplitude'in changes)data[16]=requireInteger(changes.amplitude,0,200,'pad amplitude');
  if('pitch'in changes)data[17]=requireInteger(changes.pitch,-12,12,'pad pitch')&255;
  if('pan'in changes)data[18]=requireInteger(changes.pan,-16,16,'pad pan')&255;
  if('attack'in changes)data[19]=requireInteger(changes.attack,0,255,'pad attack');
  if('release'in changes)data[20]=requireInteger(changes.release,0,255,'pad release');
  if('timeMode'in changes)data[21]=requireInteger(changes.timeMode,0,3,'pad timeMode');
  if('chokeGroup'in changes)data[22]=requireInteger(changes.chokeGroup,0,255,'pad chokeGroup');
  if('playMode'in changes)data[23]=requireInteger(changes.playMode,0,profile.supportsLoop?3:2,'pad playMode');
  if('rootNote'in changes)data[24]=requireInteger(changes.rootNote,0,127,'pad rootNote');
  const slot=u16le(data,1);
  if(profile.supportsSupertone&&slot>=1000){
    if('supertoneKnobX'in changes)data[27]=requireInteger(changes.supertoneKnobX,0,254,'supertone knob X');
    if('supertoneKnobY'in changes)data[28]=requireInteger(changes.supertoneKnobY,0,254,'supertone knob Y');
  }
  validatePad({path:'pad',data},profile);
  return data;
}

export function patchProjectPad(baseInput,{group,pad,...changes},{profile}={}){
  profile=profileOrDefault(profile);
  const groupName=String(group||'').toLowerCase();
  const padNumber=requireInteger(pad,1,12,'pad number');
  if(!/^[abcd]$/.test(groupName))throw new Error('pad group must be A..D.');
  const path='pads/'+groupName+'/p'+String(padNumber).padStart(2,'0');
  const member=parseProjectArchive(baseInput).find(item=>item.path===path);
  if(!member)throw new Error('Native project template is missing '+path+'.');
  const data=patchPadRecord(member.data,changes,{profile});
  return patchProjectArchiveMembers(baseInput,{[path]:data},{profile,allowAdditions:false});
}


const patternMemberPath=spec=>{
  const explicit=String(spec?.id||'').toUpperCase();
  if(/^[ABCD](0[1-9]|[1-9][0-9])$/.test(explicit))return'patterns/'+explicit.toLowerCase();
  const group=String(spec?.group||'').toUpperCase();
  const pattern=requireInteger(spec?.pattern,1,99,'pattern number');
  if(!/^[ABCD]$/.test(group))throw new Error('pattern group must be A..D.');
  return'patterns/'+group.toLowerCase()+String(pattern).padStart(2,'0');
};
const recordBytes=(tick,b2,b3,b4,b5,b6,b7)=>Uint8Array.from([
  tick&255,(tick>>8)&255,b2&255,b3&255,b4&255,b5&255,b6&255,b7&255
]);

export function encodePatternMember(spec={}, {profile}={}){
  profile=profileOrDefault(profile);
  const bars=requireInteger(spec.bars??1,1,99,'pattern bars');
  const records=[];
  for(const event of Array.isArray(spec.events)?spec.events:[]){
    const tick=requireInteger(event.tick,0,65535,'pattern event tick');
    const pad=requireInteger(event.pad,1,12,'pattern event pad');
    const note=requireInteger(event.note??60,0,127,'pattern event note');
    const velocity=requireInteger(event.velocity??100,1,127,'pattern event velocity');
    const duration=requireInteger(event.duration,1,65535,'pattern event duration');
    if(event.flag!=null&&Number(event.flag)!==0)
      throw new Error('Generated pattern note flags must be 0; other values are not authoring-safe.');
    records.push({
      tick,kind:1,order:pad,
      bytes:recordBytes(tick,(pad-1)*8,note,velocity,duration&255,(duration>>8)&255,0)
    });
  }
  for(const event of Array.isArray(spec.automation)?spec.automation:[]){
    const tick=requireInteger(event.tick,0,65535,'automation tick');
    const parameter=requireInteger(event.parameter??event.parameterID,0,11,'automation parameter');
    const value=requireInteger(event.value,0,32767,'automation value');
    records.push({
      tick,kind:0,order:parameter,
      bytes:recordBytes(tick,0x01,parameter,0,value&255,(value>>8)&255,0)
    });
  }
  records.sort((a,b)=>a.tick-b.tick||a.kind-b.kind||a.order-b.order);
  const count=records.length;
  let header;
  if(profile.patternDialect==='ep40'){
    if(count>65535)throw new Error('EP-40 pattern record count exceeds 65535.');
    header=Uint8Array.from([1,bars,0xff,0xff,count&255,(count>>8)&255]);
  }else if(profile.patternDialect==='ep133'){
    if(count>255)throw new Error('EP-133 pattern record count exceeds 255.');
    header=Uint8Array.from([0,bars,count,0]);
  }else throw new Error('Pattern authoring is not verified for '+profile.id+'.');
  const output=concatBytes([header,...records.map(record=>record.bytes)]);
  validatePattern({path:'pattern',data:output},profile);
  return output;
}

export function patchScenesMember(input,spec={}, {profile}={}){
  profile=profileOrDefault(profile);
  const data=toBytes(input).slice();
  if(data.length!==(Number(profile.scenesSize)||712))throw new Error('Native scenes template has an unexpected size.');
  const entries=Array.isArray(spec)?spec:Array.isArray(spec.entries)?spec.entries:[];
  for(const entry of entries){
    const index=requireInteger(entry.index??entry.scene,1,99,'scene index')-1;
    const refs=entry.groupPatterns;
    if(!Array.isArray(refs)||refs.length!==4)throw new Error('scene groupPatterns must contain four entries.');
    const values=refs.map(value=>requireInteger(value,0,99,'scene pattern reference'));
    const empty=values.every(value=>value===0);
    if(!empty&&profile.requiresFullSceneRefs!==false&&values.some(value=>value===0))
      throw new Error('Defined scenes must reference a pattern for all four groups.');
    const time=entry.timeSignature??[4,4];
    if(!Array.isArray(time)||time.length!==2)throw new Error('scene timeSignature must be [numerator, denominator].');
    const numerator=empty?4:requireInteger(time[0],1,255,'time-signature numerator');
    const denominator=empty?4:requireInteger(time[1],1,255,'time-signature denominator');
    const offset=7+index*6;
    data.set(values,offset);
    data[offset+4]=numerator;
    data[offset+5]=denominator;
  }
  const trailer=7+99*6;
  if(spec.currentScene!=null){
    const current=requireInteger(spec.currentScene,1,99,'current scene');
    const offset=7+(current-1)*6;
    const refs=[data[offset],data[offset+1],data[offset+2],data[offset+3]];
    if(refs.every(value=>value===0))throw new Error('currentScene must reference a defined scene.');
    data[trailer+3]=current;
  }
  if(spec.song!=null){
    if(!Array.isArray(spec.song)||spec.song.length<1||spec.song.length>99)
      throw new Error('song must contain 1..99 scene numbers.');
    data.fill(0,trailer+12,trailer+111);
    data[trailer+11]=spec.song.length;
    spec.song.forEach((value,index)=>{
      const sceneNo=requireInteger(value,1,99,'song scene');
      const offset=7+(sceneNo-1)*6;
      const refs=[data[offset],data[offset+1],data[offset+2],data[offset+3]];
      if(refs.every(item=>item===0))throw new Error('song references undefined scene '+sceneNo+'.');
      data[trailer+12+index]=sceneNo;
    });
  }
  return data;
}

const faderBaseValue=value=>{
  const number=Number(value);
  if(number===-1)return-1;
  if(!Number.isFinite(number)||number<0||number>1)throw new Error('group fader baseValue must be -1 or 0..1.');
  return number;
};

export function patchSettingsMember(input,spec={}, {profile}={}){
  profile=profileOrDefault(profile);
  const data=toBytes(input).slice();
  validateSettings({path:'settings',data},profile);
  if(spec.bpm!=null)setF32le(data,4,requireFloat(spec.bpm,40,399,'project BPM'));
  for(const item of Array.isArray(spec.groupFaders)?spec.groupFaders:[]){
    const group=String(item.group||'').toUpperCase();
    if(!/^[ABCD]$/.test(group))throw new Error('group fader group must be A..D.');
    const groupIndex='ABCD'.indexOf(group);
    const parameter=requireInteger(item.parameter,0,11,'group fader parameter');
    data[216+groupIndex]=parameter;
    if(item.baseValue!=null){
      setF32le(data,24+groupIndex*48+parameter*4,faderBaseValue(item.baseValue));
    }
  }
  validateSettings({path:'settings',data},profile);
  return data;
}

const normalized01=(value,label)=>requireFloat(value,0,1,label);
export function patchFxSettingsMember(input,spec={}, {profile}={}){
  profile=profileOrDefault(profile);
  const data=toBytes(input).slice();
  validateFxSettings({path:'fx_settings',data},profile);
  if(spec.type!=null)data[4]=requireInteger(spec.type,0,6,'FX type');
  const type=data[4];
  const parameter1=spec.parameter1??spec.parameters?.x;
  const parameter2=spec.parameter2??spec.parameters?.y;
  if(parameter1!=null||parameter2!=null){
    if(type<1||type>6)throw new Error('FX parameters require an active FX type 1..6.');
    if(parameter1!=null)setF32le(data,12+(type-1)*4,normalized01(parameter1,'FX parameter1'));
    if(parameter2!=null)setF32le(data,76+(type-1)*4,normalized01(parameter2,'FX parameter2'));
  }
  if(spec.outputCompressor!=null){
    if(!spec.outputCompressor||typeof spec.outputCompressor!=='object')throw new Error('outputCompressor must be an object.');
    if(spec.outputCompressor.drive!=null)setF32le(data,136,normalized01(spec.outputCompressor.drive,'output compressor drive'));
    if(spec.outputCompressor.speed!=null)setF32le(data,140,normalized01(spec.outputCompressor.speed,'output compressor speed'));
  }
  if(spec.sidechain!=null){
    if(!spec.sidechain||typeof spec.sidechain!=='object')throw new Error('sidechain must be an object.');
    if(data.length<160)throw new Error('Sidechain authoring requires a native 160-byte fx_settings member.');
    if(spec.sidechain.shape!=null)throw new Error('Sidechain shape authoring is not yet hardware-verified.');
    if(spec.sidechain.length!=null)setF32le(data,144,normalized01(spec.sidechain.length,'sidechain length'));
    const routing=spec.sidechain.routing;
    if(routing!=null){
      if(!routing||typeof routing!=='object'||Array.isArray(routing))throw new Error('sidechain routing must map groups A..D to routes.');
      for(const[groupName,route]of Object.entries(routing)){
        const group=String(groupName).toUpperCase();
        if(!/^[ABCD]$/.test(group)||!route||typeof route!=='object')throw new Error('sidechain route needs group A..D and an object value.');
        let word=route.destination?0x8000:0;
        for(const pad of Array.isArray(route.sourcePads)?route.sourcePads:[]){
          const number=requireInteger(pad,1,12,'sidechain source pad');
          word|=1<<(number-1);
        }
        setU16le(data,152+'ABCD'.indexOf(group)*2,word);
      }
    }
  }
  validateFxSettings({path:'fx_settings',data},profile);
  return data;
}

export function buildProjectFromNative(baseInput,doc={}, {profile}={}){
  profile=profileOrDefault(profile);
  if(!doc||typeof doc!=='object'||Array.isArray(doc))throw new Error('Project patch document must be an object.');
  validateProjectArchive(baseInput,{profile});
  const members=parseProjectArchive(baseInput);
  const byPath=new Map(members.map(member=>[member.path,member]));
  const replacements={};

  for(const padSpec of Array.isArray(doc.pads)?doc.pads:[]){
    const group=String(padSpec.group||'').toLowerCase();
    const padNumber=requireInteger(padSpec.pad,1,12,'pad number');
    if(!/^[abcd]$/.test(group))throw new Error('pad group must be A..D.');
    const path='pads/'+group+'/p'+String(padNumber).padStart(2,'0');
    const native=byPath.get(path);
    if(!native)throw new Error('Native project template is missing '+path+'.');
    const {group:_group,pad:_pad,...changes}=padSpec;
    replacements[path]=patchPadRecord(native.data,changes,{profile});
  }

  for(const pattern of Array.isArray(doc.patterns)?doc.patterns:[]){
    const path=patternMemberPath(pattern);
    replacements[path]=encodePatternMember(pattern,{profile});
  }

  if(doc.scenes!=null){
    const native=byPath.get('scenes');
    if(!native)throw new Error('Safe scenes authoring requires a native scenes member from the connected firmware.');
    replacements.scenes=patchScenesMember(native.data,doc.scenes,{profile});
  }

  if(doc.settings!=null){
    const native=byPath.get('settings');
    if(!native)throw new Error('Safe settings authoring requires a native device-written settings member.');
    replacements.settings=patchSettingsMember(native.data,doc.settings,{profile});
  }

  if(doc.fxSettings!=null){
    const native=byPath.get('fx_settings');
    if(!native)throw new Error('Safe FX authoring requires a native device-written fx_settings member.');
    replacements.fx_settings=patchFxSettingsMember(native.data,doc.fxSettings,{profile});
  }

  if(doc.live!=null)throw new Error('Riddim live/LSS semantic authoring is not enabled until live + patterns coexistence is resolved.');
  return patchProjectArchiveMembers(baseInput,replacements,{profile,allowAdditions:true});
}
