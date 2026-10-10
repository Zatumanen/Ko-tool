/**
 * Explicit, cancellable three-way choice before any numbered sample is PUT.
 * Do not treat dismissal as consent to any upload.
 */
export function chooseSampleUploadTargets({
 documentRef=document,
 files=[],
 numberedCount=0,
 sequentialPlan=null,
 numberedPlan=null,
 sequentialError='',
 numberedError=''
}={}){
 return new Promise(resolve=>{
  const doc=documentRef;
  const overlay=doc.createElement('div');
  overlay.className='ep133-confirm-dialog ep133-upload-choice-dialog';
  overlay.setAttribute('role','presentation');
  const dialog=doc.createElement('div');
  dialog.className='ep133-confirm-window ep133-upload-choice-window';
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','ep133-upload-choice-title');
  const title=doc.createElement('strong');
  title.id='ep133-upload-choice-title';
  title.textContent='CHOOSE SAMPLE DESTINATIONS';
  const body=doc.createElement('div');
  body.className='ep133-confirm-body';
  const explanation=doc.createElement('p');
  explanation.textContent=numberedCount+' of '+files.length+' file(s) have a 001–999 prefix. Choose where to upload before anything is written.';
  const preview=doc.createElement('pre');
  preview.className='ep133-upload-choice-preview';
  const mappings=(numberedPlan?.targets||sequentialPlan?.targets||[]).slice(0,7);
  preview.textContent=mappings.map(item=>
    String(item.slot.id).padStart(3,'0')+' ← '+String(item.file.name||'audio file')
  ).join('\n')+((files.length>7)?'\n… +'+(files.length-7)+' more files':'');
  const detail=doc.createElement('p');
  detail.className='ep133-upload-choice-warning';
  detail.textContent=numberedError
    ?'Numbered slots unavailable: '+numberedError
    :'Match numbered files to their slot; files without numbers use free slots from the drop position. Occupied slots are never overwritten.';
  const buttons=doc.createElement('div');
  buttons.className='ep133-confirm-actions ep133-upload-choice-actions';
  const makeButton=(text,mode,plan,reason)=>{
    const b=doc.createElement('button');
    b.type='button';b.textContent=text;b.dataset.uploadMode=mode;
    b.disabled=!plan;
    if(reason)b.title=reason;
    b.addEventListener('click',()=>finish(plan?mode:null));
    return b;
  };
  const match=makeButton('USE NUMBERED SLOTS','numbered',numberedPlan,numberedError);
  const next=makeButton('NEXT FREE SLOTS','sequential',sequentialPlan,sequentialError);
  const cancel=makeButton('CANCEL','cancel',true);
  buttons.append(match,next,cancel);
  if(sequentialError){
   const info=doc.createElement('p');
   info.className='ep133-upload-choice-warning';
   info.textContent='Next-free slots unavailable: '+sequentialError;
   body.append(info);
  }
  body.append(explanation,preview,detail,buttons);
  dialog.append(title,body);overlay.append(dialog);
  let finished=false;
  const previousFocus=doc.activeElement;
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(null);}
   if(event.key==='Tab'){
    const enabled=[match,next,cancel].filter(item=>!item.disabled);
    if(!enabled.length)return;
    const index=enabled.indexOf(doc.activeElement);
    if(event.shiftKey&&index===0){event.preventDefault();enabled.at(-1).focus();}
    else if(!event.shiftKey&&index===enabled.length-1){event.preventDefault();enabled[0].focus();}
   }
  };
  const finish=choice=>{
   if(finished)return;
   finished=true;
   doc.removeEventListener('keydown',keydown,true);
   overlay.remove();
   if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus();
   resolve(choice==='numbered'||choice==='sequential'?choice:null);
  };
  overlay.addEventListener('click',event=>{if(event.target===overlay)finish(null);});
  doc.body.append(overlay);
  doc.addEventListener('keydown',keydown,true);
  (numberedPlan?match:sequentialPlan?next:cancel).focus();
 });
}
