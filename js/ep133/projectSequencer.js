import{patchProjectArchiveMembers,buildProjectFromNative,validateProjectArchive}from './projectArchive.js?v=20260929-19';
import{readProjectModel}from './projectReader.js?v=20260929-19';

const GROUPS='ABCD';
const FADER_MAX=32767;

const int=(value,min,max,label)=>{
  const number=Number(value);
  if(!Number.isInteger(number)||number<min||number>max)throw new Error(label+' must be '+min+'..'+max+'.');
  return number;
};
const number=(value,min,max,label)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+' must be '+min+'..'+max+'.');
  return n;
};
const u16set=(data,offset,value)=>{data[offset]=value&255;data[offset+1]=(value>>8)&255;};
const cloneRaw=raw=>raw instanceof Uint8Array?raw.slice():new Uint8Array(raw||[]);
const concat=parts=>{
  const size=parts.reduce((sum,part)=>sum+part.length,0);
  const out=new Uint8Array(size);
  let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}
  return out;
};
const normalizePatternId=id=>{
  const value=String(id||'').toUpperCase();
  if(!/^[ABCD](0[1-9]|[1-9][0-9])$/.test(value))throw new Error('Pattern id must be A01..D99.');
  return value;
};
const patternPath=id=>'patterns/'+normalizePatternId(id).toLowerCase();

function cloneRecord(record,id){
  return{
    ...record,
    id,
    raw:cloneRaw(record.raw),
    originalIndex:record.index,
    generated:false,
    dirty:false
  };
}
function clonePattern(pattern){
  return{
    id:pattern.id,
    path:pattern.path,
    group:pattern.group,
    pattern:pattern.pattern,
    bars:pattern.bars,
    rawHeader:cloneRaw(pattern.rawHeader),
    records:pattern.records.map((record,index)=>cloneRecord(record,'r'+index)),
    isNew:false,
    dirty:false,
    needsSort:false
  };
}
function hasUnknown(pattern){return pattern.records.some(record=>record.kind==='unknown');}
function assertStructuralSafe(pattern){
  if(hasUnknown(pattern))
    throw new Error('Pattern '+pattern.id+' contains unknown native records; structural/tick edits are blocked to preserve them byte-for-byte.');
}
function publicRecord(record){
  const copy={...record,raw:cloneRaw(record.raw)};
  delete copy.dirty;
  delete copy.generated;
  delete copy.originalIndex;
  return copy;
}
function publicPattern(pattern){
  return{
    id:pattern.id,
    group:pattern.group,
    pattern:pattern.pattern,
    bars:pattern.bars,
    records:pattern.records.map(publicRecord)
  };
}
function recordOrder(record){
  if(record.kind==='automation')return[record.tick,0,record.parameter??0,record.originalIndex??Number.MAX_SAFE_INTEGER];
  if(record.kind==='note')return[record.tick,1,record.pad??0,record.originalIndex??Number.MAX_SAFE_INTEGER];
  return[record.tick??0,2,0,record.originalIndex??Number.MAX_SAFE_INTEGER];
}
function compareOrder(a,b){
  const aa=recordOrder(a),bb=recordOrder(b);
  for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];
  return 0;
}
function serializeRecord(record){
  if(record.kind==='unknown')return cloneRaw(record.raw);
  const raw=record.generated?new Uint8Array(8):cloneRaw(record.raw);
  u16set(raw,0,int(record.tick,0,65535,'record tick'));
  if(record.kind==='note'){
    const pad=int(record.pad,1,12,'note pad');
    raw[2]=(pad-1)*8;
    raw[3]=int(record.note,0,127,'note pitch');
    raw[4]=int(record.velocity,1,127,'note velocity');
    u16set(raw,5,int(record.duration,1,65535,'note duration'));
    if(record.generated)raw[7]=0;
    return raw;
  }
  const recordType=record.generated?1:int(record.recordType,0,255,'automation record type');
  if(recordType!==1&&recordType!==5)throw new Error('Automation record type must remain 0x01 or 0x05.');
  raw[2]=recordType;
  raw[3]=int(record.parameter,0,11,'automation parameter');
  if(record.generated)raw[4]=0;
  u16set(raw,5,int(record.value,0,FADER_MAX,'automation value'));
  if(record.generated)raw[7]=0;
  return raw;
}
function serializePattern(pattern,profile){
  const records=pattern.needsSort?[...pattern.records].sort(compareOrder):[...pattern.records];
  const count=records.length;
  let header=cloneRaw(pattern.rawHeader);
  if(profile.patternDialect==='ep40'){
    if(count>65535)throw new Error('EP-40 pattern record count exceeds 65535.');
    if(header.length!==6)header=Uint8Array.from([1,pattern.bars,0xff,0xff,0,0]);
    header[0]=1;header[1]=int(pattern.bars,1,99,'pattern bars');header[2]=0xff;header[3]=0xff;
    u16set(header,4,count);
  }else if(profile.patternDialect==='ep133'){
    if(count>255)throw new Error('EP-133 pattern record count exceeds 255.');
    if(header.length!==4)header=Uint8Array.from([0,pattern.bars,0,0]);
    header[0]=0;header[1]=int(pattern.bars,1,99,'pattern bars');header[2]=count;
    // Header byte 3 is intentionally preserved for native patterns.
  }else throw new Error('Pattern authoring is not verified for '+profile.id+'.');
  return concat([header,...records.map(serializeRecord)]);
}
function noteChanges(record,changes,pattern){
  if(!changes||typeof changes!=='object')return;
  if(Object.prototype.hasOwnProperty.call(changes,'flag'))
    throw new Error('Pattern flag authoring is not supported; native flags are preserved and generated notes use 0.');
  if(Object.prototype.hasOwnProperty.call(changes,'tick')){
    const tick=int(changes.tick,0,65535,'note tick');
    if(tick!==record.tick){assertStructuralSafe(pattern);record.tick=tick;pattern.needsSort=true;}
  }
  if(Object.prototype.hasOwnProperty.call(changes,'pad'))record.pad=int(changes.pad,1,12,'note pad');
  if(Object.prototype.hasOwnProperty.call(changes,'note'))record.note=int(changes.note,0,127,'note pitch');
  if(Object.prototype.hasOwnProperty.call(changes,'velocity'))record.velocity=int(changes.velocity,1,127,'note velocity');
  if(Object.prototype.hasOwnProperty.call(changes,'duration'))record.duration=int(changes.duration,1,65535,'note duration');
  record.dirty=true;pattern.dirty=true;
}
function automationChanges(record,changes,pattern){
  if(!changes||typeof changes!=='object')return;
  if(Object.prototype.hasOwnProperty.call(changes,'flag')||Object.prototype.hasOwnProperty.call(changes,'recordType'))
    throw new Error('Automation flag/type authoring is not supported; native values are preserved and generated automation uses type 0x01 / flag 0.');
  if(Object.prototype.hasOwnProperty.call(changes,'tick')){
    const tick=int(changes.tick,0,65535,'automation tick');
    if(tick!==record.tick){assertStructuralSafe(pattern);record.tick=tick;pattern.needsSort=true;}
  }
  if(Object.prototype.hasOwnProperty.call(changes,'parameter'))record.parameter=int(changes.parameter,0,11,'automation parameter');
  if(Object.prototype.hasOwnProperty.call(changes,'value'))record.value=int(changes.value,0,FADER_MAX,'automation value');
  record.dirty=true;pattern.dirty=true;
}

export function createProjectSequencer(model){
  if(!model?.sourceArchive||!model?.profile)throw new Error('Sequencer Core requires a Project Reader model.');
  const profile={...model.profile};
  if(profile.id!=='ep133'&&profile.id!=='ep40')throw new Error('Sequencer Core is enabled only for EP-133 and EP-40.');
  const patterns=new Map(model.patterns.map(pattern=>[pattern.id,clonePattern(pattern)]));
  const padEdits=new Map();
  const sceneEdits=new Map();
  const settingsDoc={};
  const groupFaders=new Map();
  let currentScene=null,song=null,fxSettings=null,newRecordId=0;

  const requirePattern=id=>{
    const key=normalizePatternId(id);
    const pattern=patterns.get(key);
    if(!pattern)throw new Error('Pattern '+key+' does not exist.');
    return pattern;
  };
  const requireRecord=(pattern,id,kind)=>{
    const record=pattern.records.find(item=>item.id===String(id));
    if(!record||record.kind!==kind)throw new Error(pattern.id+' '+kind+' record '+id+' does not exist.');
    return record;
  };

  return{
    profile:{...profile},

    listPatterns(){return[...patterns.values()].map(publicPattern);},
    getPattern(id){return publicPattern(requirePattern(id));},

    createPattern(id,{bars=1}={}){
      const key=normalizePatternId(id);
      if(patterns.has(key))throw new Error('Pattern '+key+' already exists.');
      const group=key[0].toLowerCase(),patternNumber=Number(key.slice(1));
      const rawHeader=profile.patternDialect==='ep40'
        ?Uint8Array.from([1,int(bars,1,99,'pattern bars'),0xff,0xff,0,0])
        :Uint8Array.from([0,int(bars,1,99,'pattern bars'),0,0]);
      const pattern={id:key,path:patternPath(key),group,pattern:patternNumber,bars:Number(bars),rawHeader,records:[],isNew:true,dirty:true,needsSort:false};
      patterns.set(key,pattern);
      return publicPattern(pattern);
    },

    setPatternBars(id,bars){
      const pattern=requirePattern(id);
      const nextBars=int(bars,1,99,'pattern bars');
      if(nextBars!==pattern.bars)assertStructuralSafe(pattern);
      pattern.bars=nextBars;pattern.dirty=true;
      return publicPattern(pattern);
    },

    editNote(id,recordId,changes){
      const pattern=requirePattern(id),record=requireRecord(pattern,recordId,'note');
      noteChanges(record,changes,pattern);
      return publicRecord(record);
    },

    addNote(id,event){
      const pattern=requirePattern(id);
      assertStructuralSafe(pattern);
      const record={
        kind:'note',id:'n'+(++newRecordId),index:-1,originalIndex:Number.MAX_SAFE_INTEGER,
        tick:int(event?.tick,0,65535,'note tick'),
        pad:int(event?.pad,1,12,'note pad'),
        note:int(event?.note??60,0,127,'note pitch'),
        velocity:int(event?.velocity??100,1,127,'note velocity'),
        duration:int(event?.duration,1,65535,'note duration'),
        flag:0,raw:new Uint8Array(8),generated:true,dirty:true
      };
      pattern.records.push(record);pattern.dirty=true;pattern.needsSort=true;
      return publicRecord(record);
    },

    removeNote(id,recordId){
      const pattern=requirePattern(id);
      assertStructuralSafe(pattern);
      const record=requireRecord(pattern,recordId,'note');
      pattern.records=pattern.records.filter(item=>item!==record);
      pattern.dirty=true;pattern.needsSort=true;
    },

    editAutomation(id,recordId,changes){
      const pattern=requirePattern(id),record=requireRecord(pattern,recordId,'automation');
      automationChanges(record,changes,pattern);
      return publicRecord(record);
    },

    addAutomation(id,event){
      const pattern=requirePattern(id);
      assertStructuralSafe(pattern);
      const record={
        kind:'automation',id:'a'+(++newRecordId),index:-1,originalIndex:Number.MAX_SAFE_INTEGER,
        tick:int(event?.tick,0,65535,'automation tick'),
        recordType:1,
        parameter:int(event?.parameter??event?.parameterID,0,11,'automation parameter'),
        value:int(event?.value,0,FADER_MAX,'automation value'),
        reserved:0,flag:0,raw:new Uint8Array(8),generated:true,dirty:true
      };
      pattern.records.push(record);pattern.dirty=true;pattern.needsSort=true;
      return publicRecord(record);
    },

    removeAutomation(id,recordId){
      const pattern=requirePattern(id);
      assertStructuralSafe(pattern);
      const record=requireRecord(pattern,recordId,'automation');
      pattern.records=pattern.records.filter(item=>item!==record);
      pattern.dirty=true;pattern.needsSort=true;
    },

    assignPad(spec){
      if(!spec||typeof spec!=='object')throw new Error('Pad edit must be an object.');
      const group=String(spec.group||'').toUpperCase();
      if(!GROUPS.includes(group))throw new Error('pad group must be A..D.');
      const pad=int(spec.pad,1,12,'pad number');
      padEdits.set(group+pad,{...spec,group,pad});
    },

    setBpm(value){settingsDoc.bpm=number(value,40,399,'project BPM');},

    setGroupFader({group,parameter,baseValue}){
      const g=String(group||'').toUpperCase();
      if(!GROUPS.includes(g))throw new Error('group fader group must be A..D.');
      const p=int(parameter,0,11,'group fader parameter');
      const entry={group:g,parameter:p};
      if(baseValue!=null){
        const base=Number(baseValue);
        if(!Number.isFinite(base)||(base!==-1&&(base<0||base>1)))throw new Error('group fader baseValue must be -1 or 0..1.');
        entry.baseValue=base;
      }
      groupFaders.set(g+':'+p,entry);
    },

    setScene(index,{groupPatterns,timeSignature}={}){
      const scene=int(index,1,99,'scene index');
      if(!Array.isArray(groupPatterns)||groupPatterns.length!==4)throw new Error('scene groupPatterns must contain four entries.');
      const refs=groupPatterns.map(value=>int(value,0,99,'scene pattern reference'));
      if(refs.some(value=>value===0)&&refs.some(value=>value!==0))
        throw new Error('Defined scenes must reference a pattern for all four groups.');
      const edit={index:scene,groupPatterns:refs};
      if(timeSignature!=null){
        if(profile.id==='ep40')throw new Error('EP-40 scene time-signature authoring remains unresolved and is disabled.');
        if(!Array.isArray(timeSignature)||timeSignature.length!==2)throw new Error('scene timeSignature must be [numerator, denominator].');
        edit.timeSignature=[int(timeSignature[0],1,255,'time-signature numerator'),int(timeSignature[1],1,255,'time-signature denominator')];
      }
      sceneEdits.set(scene,edit);
    },

    setCurrentScene(value){currentScene=int(value,1,99,'current scene');},
    setSong(entries){
      if(!Array.isArray(entries)||entries.length<1||entries.length>99)throw new Error('song must contain 1..99 scene numbers.');
      song=entries.map(value=>int(value,1,99,'song scene'));
    },

    setFxSettings(spec){
      if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new Error('FX settings edit must be an object.');
      if(spec.sidechain?.shape!=null)throw new Error('Sidechain shape authoring is not hardware-verified.');
      fxSettings=typeof structuredClone==='function'?structuredClone(spec):JSON.parse(JSON.stringify(spec));
    },

    buildArchive(){
      return buildArchiveInternal();
    },

    readBuiltModel(){return readProjectModel(buildArchiveInternal(),{profile});}
  };

  function buildArchiveInternal(){
    const replacements={};
    for(const pattern of patterns.values())if(pattern.dirty)replacements[pattern.path]=serializePattern(pattern,profile);
    let archive=Object.keys(replacements).length
      ?patchProjectArchiveMembers(model.sourceArchive,replacements,{profile,allowAdditions:true})
      :model.sourceArchive.slice();

    const doc={};
    if(padEdits.size)doc.pads=[...padEdits.values()].map(item=>({...item}));
    const sceneSpec={};
    if(sceneEdits.size)sceneSpec.entries=[...sceneEdits.values()].sort((a,b)=>a.index-b.index);
    if(currentScene!=null)sceneSpec.currentScene=currentScene;
    if(song!=null)sceneSpec.song=[...song];
    if(Object.keys(sceneSpec).length)doc.scenes=sceneSpec;
    if(Object.prototype.hasOwnProperty.call(settingsDoc,'bpm')||groupFaders.size){
      doc.settings={...settingsDoc};
      if(groupFaders.size)doc.settings.groupFaders=[...groupFaders.values()];
    }
    if(fxSettings!=null)doc.fxSettings=fxSettings;
    if(Object.keys(doc).length)archive=buildProjectFromNative(archive,doc,{profile});
    validateProjectArchive(archive,{profile});
    return archive;
  }
}
