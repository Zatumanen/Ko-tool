import{buildProjectFromModel,readProjectModel}from './projectReader.js?v=20261001-1';
import{validateProjectArchive}from './projectArchive.js?v=20261001-1';

export const PROJECT_EDITOR_FADER_PARAMS=Object.freeze([
  'LVL','PTC','TIM','LPF','HPF','FX','ATK','REL','PAN','TUNE','VEL','MOD'
]);
export const PROJECT_EDITOR_FX_TYPES=Object.freeze([
  'OFF','DELAY','REVERB','DISTORTION','CHORUS','FILTER','COMPRESSOR'
]);

const GROUPS=['a','b','c','d'];
const PAD_KEYS=Object.freeze([
  'midiChannel','amplitude','pitch','pan','attack','release','chokeGroup','rootNote'
]);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const equalNumber=(a,b)=>Math.abs(Number(a)-Number(b))<1e-6;
const clampDraftNumber=(value,fallback)=>finite(value)??fallback;

export function createVerifiedProjectEditorDraft(result){
  const model=result?.model;
  if(!model?.profile)throw new Error('Project editor requires a loaded native project model.');
  const groupFaders={};
  for(const group of GROUPS){
    const assignment=model.settings?.faderAssignments?.[group]||{parameter:0};
    const parameter=Number(assignment.parameter)||0;
    const values=model.settings?.groupFaders?.[group]||[];
    const selected=values.find(item=>Number(item.parameter)===parameter);
    groupFaders[group]={
      parameter,
      baseValue:finite(selected?.value)??-1
    };
  }
  const pads=[];
  for(const group of GROUPS){
    for(const pad of model.pads?.[group]||[]){
      pads.push({
        group,
        pad:Number(pad.pad),
        sampleSlot:pad.sampleSlot,
        supertone:pad.supertone?{...pad.supertone}:null,
        midiChannel:Number(pad.midiChannelCode),
        amplitude:Number(pad.amplitude),
        pitch:Number(pad.pitch),
        pan:Number(pad.pan),
        attack:Number(pad.attack),
        release:Number(pad.release),
        chokeGroup:Number(pad.chokeGroup),
        rootNote:Number(pad.rootNote)
      });
    }
  }
  return{
    project:String(result?.project??'').padStart(2,'0'),
    active:!!result?.active,
    profile:{...model.profile},
    bpm:finite(model.settings?.bpm),
    groupFaders,
    fx:{
      type:Number(model.fxSettings?.effectType)||0,
      parameter1:finite(model.fxSettings?.parameter1)??0,
      parameter2:finite(model.fxSettings?.parameter2)??0,
      compressorDrive:finite(model.fxSettings?.outputCompressor?.drive)??0,
      compressorSpeed:finite(model.fxSettings?.outputCompressor?.speed)??0
    },
    pads
  };
}

export function buildVerifiedProjectEditorPatch(model,draft){
  if(!model?.profile?.projectAuthoring)
    throw new Error('Project authoring is not hardware-verified for this device firmware.');
  if(!draft||typeof draft!=='object')throw new TypeError('Project editor draft is required.');
  const patch={};
  const changes=[];

  const bpm=finite(draft.bpm);
  if(bpm!=null&&!equalNumber(bpm,model.settings?.bpm)){
    patch.settings={...(patch.settings||{}),bpm};
    changes.push({section:'settings',field:'bpm',from:model.settings?.bpm,to:bpm});
  }

  const groupFaders=[];
  for(const group of GROUPS){
    const next=draft.groupFaders?.[group];
    if(!next)continue;
    const nativeAssignment=model.settings?.faderAssignments?.[group];
    const nativeParameter=Number(nativeAssignment?.parameter)||0;
    const parameter=Number(next.parameter);
    const nativeValue=(model.settings?.groupFaders?.[group]||[])
      .find(item=>Number(item.parameter)===parameter)?.value;
    const baseValue=clampDraftNumber(next.baseValue,nativeValue??-1);
    if(parameter!==nativeParameter||!equalNumber(baseValue,nativeValue??-1)){
      groupFaders.push({group:group.toUpperCase(),parameter,baseValue});
      changes.push({
        section:'settings',field:'groupFader',group:group.toUpperCase(),
        from:{parameter:nativeParameter,baseValue:nativeValue??-1},
        to:{parameter,baseValue}
      });
    }
  }
  if(groupFaders.length)patch.settings={...(patch.settings||{}),groupFaders};

  if(model.fxSettings){
    const fx=draft.fx||{};
    const native=model.fxSettings;
    const type=Number(fx.type);
    const parameter1=clampDraftNumber(fx.parameter1,native.parameter1??0);
    const parameter2=clampDraftNumber(fx.parameter2,native.parameter2??0);
    const drive=clampDraftNumber(fx.compressorDrive,native.outputCompressor?.drive??0);
    const speed=clampDraftNumber(fx.compressorSpeed,native.outputCompressor?.speed??0);
    const fxPatch={};
    let changed=false;
    if(type!==Number(native.effectType)){
      fxPatch.type=type;changed=true;
      changes.push({section:'fx',field:'type',from:Number(native.effectType),to:type});
    }
    if(type>0&&(!equalNumber(parameter1,native.parameter1??0)||type!==Number(native.effectType))){
      fxPatch.parameter1=parameter1;changed=true;
      changes.push({section:'fx',field:'parameter1',from:native.parameter1,to:parameter1});
    }
    if(type>0&&(!equalNumber(parameter2,native.parameter2??0)||type!==Number(native.effectType))){
      fxPatch.parameter2=parameter2;changed=true;
      changes.push({section:'fx',field:'parameter2',from:native.parameter2,to:parameter2});
    }
    if(!equalNumber(drive,native.outputCompressor?.drive??0)||!equalNumber(speed,native.outputCompressor?.speed??0)){
      fxPatch.outputCompressor={drive,speed};changed=true;
      changes.push({
        section:'fx',field:'outputCompressor',
        from:{drive:native.outputCompressor?.drive??0,speed:native.outputCompressor?.speed??0},
        to:{drive,speed}
      });
    }
    if(changed)patch.fxSettings=fxPatch;
  }

  const padPatches=[];
  const nativePads=new Map();
  for(const group of GROUPS)for(const pad of model.pads?.[group]||[])
    nativePads.set(group+':'+pad.pad,pad);
  for(const item of Array.isArray(draft.pads)?draft.pads:[]){
    const group=String(item.group||'').toLowerCase();
    const padNo=Number(item.pad);
    const native=nativePads.get(group+':'+padNo);
    if(!native)continue;
    const next={group:group.toUpperCase(),pad:padNo};
    let changed=false;
    for(const key of PAD_KEYS){
      const value=Number(item[key]);
      const nativeValue=key==='midiChannel'?Number(native.midiChannelCode):Number(native[key]);
      if(Number.isFinite(value)&&value!==nativeValue){
        next[key]=value;changed=true;
        changes.push({
          section:'pad',field:key,group:group.toUpperCase(),pad:padNo,
          from:nativeValue,to:value
        });
      }
    }
    if(changed)padPatches.push(next);
  }
  if(padPatches.length)patch.pads=padPatches;

  return{patch,changes};
}

export function buildVerifiedProjectEditorCandidate(result,draft){
  if(!result?.model?.sourceArchive)throw new Error('Project editor source archive is unavailable.');
  if(result.active)throw new Error('Verified Project Editor can only write an inactive project.');
  const{patch,changes}=buildVerifiedProjectEditorPatch(result.model,draft);
  if(!changes.length)return{
    patch,changes,
    archive:result.model.sourceArchive.slice(),
    model:result.model,
    changed:false
  };
  const archive=buildProjectFromModel(result.model,patch);
  validateProjectArchive(archive,{profile:result.model.profile});
  const model=readProjectModel(archive,{profile:result.model.profile});
  return{patch,changes,archive,model,changed:true};
}

export function summarizeVerifiedProjectChanges(changes=[]){
  const counts={settings:0,fx:0,pad:0};
  for(const change of changes)if(change?.section in counts)counts[change.section]+=1;
  return Object.freeze({
    total:changes.length,
    settings:counts.settings,
    fx:counts.fx,
    pads:counts.pad
  });
}
