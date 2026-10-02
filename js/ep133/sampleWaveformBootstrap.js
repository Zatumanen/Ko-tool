import{withFileTransaction}from './filesystem.js?v=20261001-1';
import{createSampleWaveformController}from './ui/sampleWaveformController.js?v=20261003-2';

const BOOTSTRAP_KEY='__speeduppercutMyEpSampleWaveform';

const selectedSampleFromDom=documentRef=>{
  const row=documentRef.querySelector('#ep133-sample-list .ep133-sample-row.selected.occupied');
  if(!row)return null;
  const id=Number(row.dataset.slot);
  if(!Number.isInteger(id)||id<1||id>999)return null;
  const name=row.querySelector('[data-name-input]')?.value||('slot-'+String(id).padStart(3,'0'));
  return Object.freeze({id,nodeId:id,file:Object.freeze({name})});
};

const installStyle=documentRef=>{
  if(documentRef.getElementById('ep133-sample-waveform-style'))return;
  const style=documentRef.createElement('style');
  style.id='ep133-sample-waveform-style';
  style.textContent=`
#ep133-sample-waveform{min-height:27px;padding:3px 8px;border:2px outset var(--win-gray);background:var(--win-gray);font:700 10px "Courier New",monospace;white-space:nowrap}
#ep133-sample-waveform:disabled{color:#777;cursor:not-allowed}
#ep133-sample-waveform:not(:disabled){cursor:pointer}
`;
  documentRef.head?.appendChild(style);
};

const reportWaveformError=(label,error,documentRef)=>{
  console.error(label,error);
  const status=documentRef.getElementById('ep133-status');
  if(status)status.textContent=String(label||'WAVEFORM ERROR').toUpperCase();
};

export function startMyEpSampleWaveform({documentRef=globalThis.document,windowRef=globalThis.window}={}){
  if(!documentRef)return null;
  if(windowRef?.[BOOTSTRAP_KEY])return windowRef[BOOTSTRAP_KEY];
  const nav=documentRef.querySelector('#ep133-samples-panel .ep133-sample-nav');
  const list=documentRef.getElementById('ep133-sample-list');
  if(!nav||!list)return null;
  installStyle(documentRef);

  const controller=createSampleWaveformController({
    withFileTransaction,
    reportError:(label,error)=>reportWaveformError(label,error,documentRef)
  });
  const button=documentRef.createElement('button');
  button.id='ep133-sample-waveform';
  button.type='button';
  button.textContent='WAVEFORM / CHOP';
  button.title='Open selected EP sample in the shared waveform / chop editor';
  button.disabled=true;
  nav.appendChild(button);

  const update=()=>{button.disabled=!selectedSampleFromDom(documentRef);};
  button.addEventListener('click',()=>{
    const slot=selectedSampleFromDom(documentRef);
    if(slot)void controller.open(slot);
  });
  list.addEventListener('click',()=>queueMicrotask(update));
  list.addEventListener('keydown',()=>queueMicrotask(update));
  const observer=typeof MutationObserver==='function'?new MutationObserver(update):null;
  observer?.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected']});
  update();

  const api=Object.freeze({
    controller,button,refresh:update,
    dispose(){observer?.disconnect?.();controller.close();button.remove();if(windowRef?.[BOOTSTRAP_KEY]===api)delete windowRef[BOOTSTRAP_KEY];}
  });
  if(windowRef)windowRef[BOOTSTRAP_KEY]=api;
  return api;
}

if(typeof document!=='undefined')startMyEpSampleWaveform();
