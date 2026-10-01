import{createProjectSequencer}from './projectSequencer.js?v=20261001-1';

export const SEQUENCER_GRID_TICKS=24;
export const SEQUENCER_GRID_STEPS=16;

const asBytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const equalBytes=(a,b)=>{
  const left=asBytes(a),right=asBytes(b);
  if(left.byteLength!==right.byteLength)return false;
  for(let index=0;index<left.length;index++)if(left[index]!==right[index])return false;
  return true;
};
const normalizePatternId=id=>{
  const value=String(id||'').toUpperCase();
  if(!/^[ABCD](0[1-9]|[1-9][0-9])$/.test(value))throw new Error('Pattern id must be A01..D99.');
  return value;
};

export function getProjectSequencerAvailability(result){
  if(!result?.model)return{enabled:false,reason:'LOAD A PROJECT FIRST'};
  if(!result.model.profile?.projectAuthoring)
    return{enabled:false,reason:'AUTHORING NOT VERIFIED FOR THIS FIRMWARE'};
  if(result.active)
    return{enabled:false,reason:'ACTIVE PROJECT CANNOT BE SEQUENCED'};
  if(result.dependencies?.allSamplesAvailable===false)
    return{enabled:false,reason:'PROJECT HAS MISSING SAMPLE DEPENDENCIES'};
  if(!['ep133','ep40'].includes(result.model.profile.id))
    return{enabled:false,reason:'SEQUENCER CORE IS NOT VERIFIED FOR THIS DEVICE'};
  return{enabled:true,reason:'HARDWARE-VERIFIED SEQUENCER'};
}

export function createProjectSequencerSession(result){
  const availability=getProjectSequencerAvailability(result);
  if(!availability.enabled)throw new Error(availability.reason+'.');
  const sequencer=createProjectSequencer(result.model);
  const sourceArchive=asBytes(result.model.sourceArchive).slice();

  const getPattern=id=>sequencer.getPattern(normalizePatternId(id));
  const listPatterns=()=>sequencer.listPatterns();

  const getPatternSafety=id=>{
    const pattern=getPattern(id);
    const unknownRecords=pattern.records.filter(record=>record.kind==='unknown').length;
    return Object.freeze({
      unknownRecords,
      structuralEditsAllowed:unknownRecords===0,
      valueEditsAllowed:true
    });
  };

  const toggleGridNote=(id,{page=0,step,pad,note=60,velocity=100,duration=SEQUENCER_GRID_TICKS}={})=>{
    const patternId=normalizePatternId(id);
    const tick=(Number(page)*SEQUENCER_GRID_STEPS+Number(step))*SEQUENCER_GRID_TICKS;
    if(!Number.isInteger(tick)||tick<0||tick>65535)throw new Error('Grid tick is out of range.');
    const pattern=getPattern(patternId);
    const existing=pattern.records.find(record=>
      record.kind==='note'&&Number(record.tick)===tick&&Number(record.pad)===Number(pad)
    );
    if(existing){
      sequencer.removeNote(patternId,existing.id);
      return{action:'removed',record:existing,tick};
    }
    const record=sequencer.addNote(patternId,{tick,pad,note,velocity,duration});
    return{action:'added',record,tick};
  };

  const addNote=(id,event)=>sequencer.addNote(normalizePatternId(id),event);
  const editNote=(id,recordId,changes)=>sequencer.editNote(normalizePatternId(id),recordId,changes);
  const removeNote=(id,recordId)=>sequencer.removeNote(normalizePatternId(id),recordId);
  const addAutomation=(id,event)=>sequencer.addAutomation(normalizePatternId(id),event);
  const editAutomation=(id,recordId,changes)=>sequencer.editAutomation(normalizePatternId(id),recordId,changes);
  const removeAutomation=(id,recordId)=>sequencer.removeAutomation(normalizePatternId(id),recordId);
  const setPatternBars=(id,bars)=>sequencer.setPatternBars(normalizePatternId(id),bars);
  const createPattern=(id,options)=>sequencer.createPattern(normalizePatternId(id),options);
  const setScene=(index,spec)=>sequencer.setScene(index,spec);
  const setCurrentScene=value=>sequencer.setCurrentScene(value);
  const setSong=entries=>sequencer.setSong(entries);

  const build=()=>{
    const archive=sequencer.buildArchive();
    return Object.freeze({
      archive,
      model:sequencer.readBuiltModel(),
      changed:!equalBytes(archive,sourceArchive)
    });
  };

  return Object.freeze({
    profile:{...sequencer.profile},
    listPatterns,getPattern,getPatternSafety,
    toggleGridNote,addNote,editNote,removeNote,
    addAutomation,editAutomation,removeAutomation,
    setPatternBars,createPattern,setScene,setCurrentScene,setSong,
    build
  });
}

export function summarizeSequencerPattern(pattern){
  const records=Array.isArray(pattern?.records)?pattern.records:[];
  const notes=records.filter(record=>record.kind==='note');
  const automation=records.filter(record=>record.kind==='automation');
  const unknown=records.filter(record=>record.kind==='unknown');
  const maxTick=records.reduce((max,record)=>Math.max(max,Number(record.tick)||0),0);
  return Object.freeze({
    id:String(pattern?.id||''),
    bars:Number(pattern?.bars)||1,
    notes:notes.length,
    automation:automation.length,
    unknown:unknown.length,
    maxTick,
    pages:Math.max(1,Math.floor(maxTick/(SEQUENCER_GRID_TICKS*SEQUENCER_GRID_STEPS))+1)
  });
}
