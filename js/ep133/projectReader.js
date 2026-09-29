import{parseProjectArchive,validateProjectArchive,buildProjectFromNative}from './projectArchive.js?v=20260930-3';

const GROUPS=['a','b','c','d'];
const FX_TYPES=['off','delay','reverb','distortion','chorus','filter','compressor'];
const FADER_PARAMS=['LVL','PTC','TIM','LPF','HPF','FX','ATK','REL','PAN','TUNE','VEL','MOD'];

const toBytes=input=>input instanceof Uint8Array?input:new Uint8Array(input||[]);
const u16le=(data,offset)=>data[offset]|(data[offset+1]<<8);
const u32le=(data,offset)=>new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(offset,true);
const f32le=(data,offset)=>new DataView(data.buffer,data.byteOffset,data.byteLength).getFloat32(offset,true);
const signed8=value=>value>127?value-256:value;
const cloneBytes=data=>toBytes(data).slice();

function requireReaderProfile(profile){
  if(!profile||typeof profile!=='object')throw new Error('Project Reader requires an explicit EP-133 or EP-40 project profile.');
  if(profile.id!=='ep133'&&profile.id!=='ep40')
    throw new Error('Project Reader is enabled only for EP-133 and EP-40.');
  if(profile.patternDialect!=='ep133'&&profile.patternDialect!=='ep40')
    throw new Error('Project Reader pattern dialect is not verified for '+profile.id+'.');
  return profile;
}

function memberIdentity(member){
  return{path:member.path,type:member.type,size:member.size,header:cloneBytes(member.header),data:cloneBytes(member.data)};
}

export function readProjectPad(member,{profile}={}){
  profile=requireReaderProfile(profile);
  const match=String(member?.path||'').match(/^pads\/([abcd])\/p(0[1-9]|1[0-2])$/);
  if(!match)throw new Error('Not a project pad member: '+String(member?.path||'unknown'));
  const data=toBytes(member.data);
  const group=match[1],pad=Number(match[2]);
  const storedSlot=u16le(data,1);
  const pitch=signed8(data[17]);
  const pitchFraction=data.length>26?signed8(data[26]):null;
  const supertone=profile.supportsSupertone&&storedSlot>=1000&&storedSlot<=1009
    ?{
      engine:storedSlot-1000,
      symbol:storedSlot+1,
      knobX:data[27],
      knobY:data[28]
    }
    :null;
  return{
    path:member.path,
    group,
    pad,
    storedSlot,
    sampleSlot:storedSlot>=1&&storedSlot<=999?storedSlot:null,
    unassigned:storedSlot===0,
    supertone,
    midiChannelCode:data[3],
    midiChannel:data[3]===0?1:data[3],
    trimStartRawU32:u32le(data,4),
    trimStartRawBytes:cloneBytes(data.slice(4,8)),
    trimLength:u32le(data,8),
    sampleBpm:f32le(data,12),
    amplitude:data[16],
    pitch,
    pitchFraction,
    pitchSemitones:pitch+(pitchFraction==null?0:pitchFraction/100),
    pan:signed8(data[18]),
    attack:data[19],
    release:data[20],
    timeMode:data[21],
    chokeGroup:data[22],
    chokeEnabled:data[22]!==0,
    playMode:data[23],
    rootNote:data[24],
    byte25:data[25],
    rawData:cloneBytes(data),
    rawHeader:cloneBytes(member.header)
  };
}

export function readProjectPattern(member,{profile}={}){
  profile=requireReaderProfile(profile);
  const match=String(member?.path||'').match(/^patterns\/([abcd])(0[1-9]|[1-9][0-9])$/);
  if(!match)throw new Error('Not a project pattern member: '+String(member?.path||'unknown'));
  const data=toBytes(member.data);
  const headerSize=profile.patternDialect==='ep40'?6:4;
  const count=profile.patternDialect==='ep40'?u16le(data,4):(data.length-headerSize)/8;
  const headerRecordCount=profile.patternDialect==='ep40'?u16le(data,4):data[2];
  const records=[];
  const notes=[];
  const automation=[];
  const unknownRecords=[];
  for(let index=0;index<count;index++){
    const offset=headerSize+index*8;
    const raw=cloneBytes(data.slice(offset,offset+8));
    const tick=u16le(data,offset);
    const recordType=data[offset+2];
    if(recordType===0x01||recordType===0x05){
      const record={
        kind:'automation',
        index,
        tick,
        recordType,
        parameter:data[offset+3],
        parameterName:FADER_PARAMS[data[offset+3]]??null,
        reserved:data[offset+4],
        value:u16le(data,offset+5),
        flag:data[offset+7],
        raw
      };
      records.push(record);automation.push(record);continue;
    }
    if(recordType%8===0&&recordType<=0x58){
      const record={
        kind:'note',
        index,
        tick,
        pad:recordType/8+1,
        padCode:recordType,
        note:data[offset+3],
        velocity:data[offset+4],
        duration:u16le(data,offset+5),
        flag:data[offset+7],
        raw
      };
      records.push(record);notes.push(record);continue;
    }
    const record={kind:'unknown',index,tick,recordType,raw};
    records.push(record);unknownRecords.push(record);
  }
  return{
    path:member.path,
    id:match[1].toUpperCase()+match[2],
    group:match[1],
    pattern:Number(match[2]),
    bars:data[1],
    recordCount:count,
    headerRecordCount,
    headerSize,
    rawHeader:cloneBytes(data.slice(0,headerSize)),
    records,
    notes,
    automation,
    unknownRecords,
    rawData:cloneBytes(data),
    tarHeader:cloneBytes(member.header)
  };
}

export function readProjectScenes(member,{profile}={}){
  profile=requireReaderProfile(profile);
  if(member?.path!=='scenes')throw new Error('Not a scenes member.');
  const data=toBytes(member.data);
  const entries=[];
  for(let i=0;i<99;i++){
    const offset=7+i*6;
    const refs=[data[offset],data[offset+1],data[offset+2],data[offset+3]];
    entries.push({
      index:i+1,
      groupPatterns:{a:refs[0],b:refs[1],c:refs[2],d:refs[3]},
      timeSignature:{numerator:data[offset+4],denominator:data[offset+5]},
      used:refs.some(Boolean),
      raw:cloneBytes(data.slice(offset,offset+6))
    });
  }
  const trailerOffset=7+99*6;
  const songLength=data[trailerOffset+11];
  return{
    headerRaw:cloneBytes(data.slice(0,7)),
    entries,
    currentScene:data[trailerOffset+3],
    songLength,
    song:[...data.slice(trailerOffset+12,trailerOffset+12+songLength)],
    trailerRaw:cloneBytes(data.slice(trailerOffset)),
    rawData:cloneBytes(data),
    tarHeader:cloneBytes(member.header)
  };
}

export function readProjectSettings(member,{profile}={}){
  profile=requireReaderProfile(profile);
  if(member?.path!=='settings')throw new Error('Not a settings member.');
  const data=toBytes(member.data);
  const groupFaders={};
  const assignments={};
  for(let groupIndex=0;groupIndex<4;groupIndex++){
    const group=GROUPS[groupIndex];
    const values=[];
    for(let parameter=0;parameter<12;parameter++){
      values.push({
        parameter,
        parameterName:FADER_PARAMS[parameter],
        value:f32le(data,24+groupIndex*48+parameter*4)
      });
    }
    groupFaders[group]=values;
    assignments[group]={
      parameter:data[216+groupIndex],
      parameterName:FADER_PARAMS[data[216+groupIndex]]??null
    };
  }
  return{
    bpm:f32le(data,4),
    groupFaders,
    faderAssignments:assignments,
    unknownHeaderRaw:cloneBytes(data.slice(0,4)),
    unknownBeforeFadersRaw:cloneBytes(data.slice(8,24)),
    disputedTailRaw:cloneBytes(data.slice(220)),
    rawData:cloneBytes(data),
    tarHeader:cloneBytes(member.header)
  };
}

export function readProjectFxSettings(member,{profile}={}){
  profile=requireReaderProfile(profile);
  if(member?.path!=='fx_settings')throw new Error('Not an fx_settings member.');
  const data=toBytes(member.data);
  const effectType=data[4];
  const active=effectType>=1&&effectType<=6;
  const sidechainRouting={};
  if(data.length>=160){
    for(let i=0;i<4;i++){
      const word=u16le(data,152+i*2);
      sidechainRouting[GROUPS[i]]={
        rawWord:word,
        destination:!!(word&0x8000),
        sourcePads:Array.from({length:12},(_,pad)=>pad+1).filter(pad=>!!(word&(1<<(pad-1))))
      };
    }
  }
  return{
    effectType,
    effectName:FX_TYPES[effectType]??null,
    parameter1:active?f32le(data,12+(effectType-1)*4):null,
    parameter2:active?f32le(data,76+(effectType-1)*4):null,
    unknownBytes8To11:cloneBytes(data.slice(8,12)),
    outputCompressor:data.length>=144?{drive:f32le(data,136),speed:f32le(data,140)}:null,
    sidechain:data.length>=160?{
      length:f32le(data,144),
      shapeObserved:f32le(data,148),
      routing:sidechainRouting
    }:null,
    rawData:cloneBytes(data),
    tarHeader:cloneBytes(member.header)
  };
}

export function readProjectLive(member,{profile}={}){
  profile=requireReaderProfile(profile);
  if(member?.path!=='live')throw new Error('Not a live member.');
  if(!profile.supportsLive)throw new Error('live/LSS is not supported by '+profile.id+'.');
  const data=toBytes(member.data);
  const groups={};
  for(let groupIndex=0;groupIndex<4;groupIndex++){
    const group=GROUPS[groupIndex];
    groups[group]=Array.from({length:12},(_,pad)=>({
      pad:pad+1,
      armed:data[groupIndex*12+pad]===1,
      raw:data[groupIndex*12+pad]
    }));
  }
  return{groups,rawData:cloneBytes(data),tarHeader:cloneBytes(member.header)};
}

const isKnownProjectFile=path=>
  /^pads\/[abcd]\/p(0[1-9]|1[0-2])$/.test(path)||
  /^patterns\/[abcd](0[1-9]|[1-9][0-9])$/.test(path)||
  ['scenes','settings','fx_settings','live'].includes(path);

export function readProjectModel(input,{profile}={}){
  profile=requireReaderProfile(profile);
  const sourceArchive=cloneBytes(input);
  validateProjectArchive(sourceArchive,{profile});
  const members=parseProjectArchive(sourceArchive);
  const pads={a:[],b:[],c:[],d:[]};
  const patterns=[];
  let scenes=null,settings=null,fxSettings=null,live=null;
  const unknownMembers=[],directories=[];
  for(const member of members){
    if(member.type==='5'){directories.push(memberIdentity(member));continue;}
    if(/^pads\/[abcd]\/p(0[1-9]|1[0-2])$/.test(member.path)){
      const pad=readProjectPad(member,{profile});pads[pad.group].push(pad);continue;
    }
    if(/^patterns\/[abcd](0[1-9]|[1-9][0-9])$/.test(member.path)){
      patterns.push(readProjectPattern(member,{profile}));continue;
    }
    if(member.path==='scenes'){scenes=readProjectScenes(member,{profile});continue;}
    if(member.path==='settings'){settings=readProjectSettings(member,{profile});continue;}
    if(member.path==='fx_settings'){fxSettings=readProjectFxSettings(member,{profile});continue;}
    if(member.path==='live'){live=readProjectLive(member,{profile});continue;}
    if(!isKnownProjectFile(member.path))unknownMembers.push(memberIdentity(member));
  }
  for(const group of GROUPS)pads[group].sort((a,b)=>a.pad-b.pad);
  patterns.sort((a,b)=>a.group.localeCompare(b.group)||a.pattern-b.pattern);
  return{
    profile:{...profile},
    sourceArchive,
    sourceMemberOrder:members.map(member=>member.path),
    pads,
    patterns,
    scenes,
    settings,
    fxSettings,
    live,
    directories,
    unknownMembers,
    uncertainties:{
      padTrimStartWidth:'disputed',
      padByte25:'unknown',
      patternFlagMeaning:'unknown',
      settingsTail:'disputed',
      fxSidechainShape:'observed',
      liveWithPatterns:profile.nativeLiveWithPatternsObserved?'observed-native-readonly':'unresolved',
      liveWithFx:profile.nativeLiveWithFxObserved?'observed-native-readonly':'unresolved',
      ...(profile.id==='ep40'?{sceneTimeSignaturePersistence:'unresolved'}:{})
    }
  };
}

export function buildProjectFromModel(model,patchDocument={}){
  if(!model?.sourceArchive||!model?.profile)throw new Error('Project model is missing its native source archive/profile.');
  requireReaderProfile(model.profile);
  const doc=patchDocument&&typeof patchDocument==='object'&&!Array.isArray(patchDocument)?patchDocument:{};
  if(Object.keys(doc).length===0)return cloneBytes(model.sourceArchive);
  return buildProjectFromNative(model.sourceArchive,doc,{profile:model.profile});
}
