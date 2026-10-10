/**
 * Plan only. No device calls or writes. The actual FILE transaction must
 * still verify EVERY destination with assertSlotsEmpty immediately before PUT.
 */
export function numberedSampleSlot(name){
 const match=String(name||'').match(/^((?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2}))[ \t]+(?=\S)/);
 return match?Number(match[1]):null;
}

export function planSampleUploadTargets(files,{startSlot,sampleStore,mode='sequential'}={}){
 const list=Array.from(files||[]);
 const start=Number(startSlot);
 if(!Number.isInteger(start)||start<1||start>999)throw new Error('Choose a valid sample slot (001–999).');
 if(!sampleStore||typeof sampleStore.getSlot!=='function')throw new Error('Sample inventory is unavailable.');
 if(!['sequential','numbered'].includes(mode))throw new Error('Unknown sample upload destination mode.');
 const reserved=new Set();
 const results=new Array(list.length);
 let numberedCount=0;
 if(mode==='numbered'){
  for(let i=0;i<list.length;i++){
   const id=numberedSampleSlot(list[i]?.name);
   if(id==null)continue;
   numberedCount++;
   const name=String(list[i]?.name||'sample');
   if(reserved.has(id))throw new Error('Multiple files specify slot '+String(id).padStart(3,'0')+'. Rename or separate those files before uploading.');
   const slot=sampleStore.getSlot(id);
   if(!slot)throw new Error('Slot '+String(id).padStart(3,'0')+' is unavailable.');
   if(slot.file)throw new Error('Slot '+String(id).padStart(3,'0')+' already contains a sample. Nothing will be overwritten.');
   reserved.add(id);
   results[i]={file:list[i],slot,sourceName:name};
  }
 }
 let cursor=start;
 for(let i=0;i<list.length;i++){
  if(results[i])continue;
  // Match existing behavior for sequential mode: only search at or after
  // the drop slot. With mixed input, do not use reserved numbered slots.
  let chosen=null;
  for(let id=cursor;id<=999;id++){
   if(reserved.has(id))continue;
   const slot=sampleStore.getSlot(id);
   if(slot&&!slot.file){chosen=slot;cursor=id+1;break;}
  }
  if(!chosen)throw new Error('Not enough free sample slots above the drop position.');
  reserved.add(chosen.id);
  results[i]={file:list[i],slot:chosen,sourceName:String(list[i]?.name||'sample')};
 }
 return Object.freeze({
  mode,numberedCount,
  targets:results.map(item=>Object.freeze({file:item.file,slot:item.slot}))
 });
}
