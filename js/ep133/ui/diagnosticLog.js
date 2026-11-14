import {EP_ERROR_CATEGORY, EP_ERROR_CODE} from '../errors.js?v=20261001-1';
import {
  DEVICE_RUNTIME_CONNECTION, DEVICE_RUNTIME_OPERATION,
  DEVICE_RUNTIME_OWNERSHIP, DEVICE_RUNTIME_SAFETY, DEVICE_RUNTIME_STATUS
} from '../deviceRuntimeState.js';

// Export has an explicit, narrow schema. Never serialize an Error or a runtime
// snapshot: their message/stack/details, deviceKey and operation labels may be private.
const MAX_EVENTS=100;
const CODES=new Set(Object.values(EP_ERROR_CODE));
const CATEGORIES=new Set(Object.values(EP_ERROR_CATEGORY));
const STATUSES=new Set(Object.values(DEVICE_RUNTIME_STATUS));
const CONNECTIONS=new Set(Object.values(DEVICE_RUNTIME_CONNECTION));
const OPERATIONS=new Set(Object.values(DEVICE_RUNTIME_OPERATION));
const OWNERSHIPS=new Set(Object.values(DEVICE_RUNTIME_OWNERSHIP));
const SAFETIES=new Set(Object.values(DEVICE_RUNTIME_SAFETY));
// The stage table matches real UI/FILE error labels. Only the constant stage
// enters the exported report, never the label or its user-controlled suffix.
const STAGE_PREFIXES=Object.freeze([
  ['AUTO CONNECT','connect'],
  ['EP RUNTIME OWNERSHIP','connect'],
  ['EP SESSION ','connect'],
  ['UPLOAD','upload'],
  ['COULD NOT UPLOAD SAMPLE','upload'],
  ['SAMPLE LIBRARY','library'],
  ['COULD NOT READ EP SAMPLE LIBRARY','library'],
  ['METADATA SLOT ','library'],
  ['DOWNLOAD','download'],
  ['COULD NOT EDIT SAMPLE WAVEFORM','file'],
  ['COULD NOT OPEN SAMPLE WAVEFORM','file'],
  ['MOVE','move'],
  ['COPY','copy'],
  ['DELETE','delete'],
  ['RESYNC AFTER TRANSFER ERROR','recovery'],
  ['RESYNC AFTER DELETE ERROR','recovery'],
  ['TRANSFER ROLLBACK','recovery'],
  ['COULD NOT READ RECOVERY CHECKPOINTS','recovery'],
  ['EP FILE SAFETY LOCK','recovery'],
  ['ACTIVE EP PAD READ','project'],
  ['PROJECT','project'],
  ['COULD NOT READ PROJECT','project'],
  ['SEQUENCER','project'],
  ['NOTE EDIT','project'],
  ['NOTE DELETE','project'],
  ['ADD NOTE','project'],
  ['PATTERN','project'],
  ['SCENE EDIT','project'],
  ['SONG EDIT','project'],
  ['AUTOMATION','project'],
  ['ADD AUTOMATION','project'],
  ['CREATE PATTERN','project'],
  ['BACKUP','backup'],
  ['RESTORE','restore'],
  ['FILE EVENT','file'],
  ['SAMPLE EVENT','file'],
  ['RECOVERY','recovery']
]);
const pick=(values,value,fallback)=>values.has(value)?value:fallback;
const stageOf=label=>{
  if(typeof label!=='string')return 'unknown';
  for(const [prefix,stage] of STAGE_PREFIXES){
    if(label.startsWith(prefix))return stage;
  }
  return 'unknown';
};
const errorInfo=error=>{
  // Defensively avoid stringifying arbitrary objects (including custom toString).
  const code=pick(CODES,error?.code,EP_ERROR_CODE.UNKNOWN);
  return {
    code,
    category:code===EP_ERROR_CODE.UNKNOWN
      ?EP_ERROR_CATEGORY.INTERNAL
      :pick(CATEGORIES,error?.category,EP_ERROR_CATEGORY.INTERNAL)
  };
};
const runtimeInfo=snapshot=>({
  status:pick(STATUSES,snapshot?.status,DEVICE_RUNTIME_STATUS.BLOCKED),
  connection:pick(CONNECTIONS,snapshot?.connection?.status,DEVICE_RUNTIME_CONNECTION.DISCONNECTED),
  operation:pick(OPERATIONS,snapshot?.operation?.phase,DEVICE_RUNTIME_OPERATION.IDLE),
  ownership:pick(OWNERSHIPS,snapshot?.ownership?.status,DEVICE_RUNTIME_OWNERSHIP.NONE),
  safety:pick(SAFETIES,snapshot?.safety?.status,DEVICE_RUNTIME_SAFETY.UNSAFE)
});

export function createDiagnosticLog({now=()=>performance.now(),maxEvents=MAX_EVENTS}={}){
  const cap=Number.isInteger(maxEvents)?Math.max(1,Math.min(MAX_EVENTS,maxEvents)):MAX_EVENTS;
  const started=now();
  const entries=[];
  let sequence=0;
  let lastRuntime='';
  const record=(type,payload)=>{
    // Coarse relative duration prevents exporting wall-clock, location or timezone.
    const elapsedMs=Math.max(0,Math.round((now()-started)/100)*100)||0;
    entries.push(Object.freeze({seq:++sequence,elapsedMs,type,...payload}));
    if(entries.length>cap)entries.shift();
  };
  const logError=(label,error)=>{
    const info=errorInfo(error);
    record('error',{stage:stageOf(label),code:info.code,category:info.category});
  };
  const logRuntime=snapshot=>{
    const info=runtimeInfo(snapshot);
    const signature=Object.values(info).join('|');
    if(signature===lastRuntime)return;
    lastRuntime=signature;
    record('runtime',{...info});
  };
  const report=()=>({
    schema:'ko-tool-myep-diagnostics',version:1,
    privacy:'allowlisted-only; no raw messages, device IDs, audio, project data or SysEx',
    entries:entries.map(entry=>({...entry}))
  });
  return Object.freeze({logError,logRuntime,report,exportJson:()=>JSON.stringify(report(),null,2)+'\n'});
}

export function downloadDiagnosticJson(json,{
  documentRef=globalThis.document,urlRef=globalThis.URL,
  setTimeoutFn=globalThis.setTimeout
}={}){
  if(typeof json!=='string'||!documentRef?.body||!urlRef?.createObjectURL)
    throw new Error('Local diagnostic download is unavailable.');
  const blob=new Blob([json],{type:'application/json;charset=utf-8'});
  const url=urlRef.createObjectURL(blob);
  const link=documentRef.createElement('a');
  link.href=url;
  link.download='ko-tool-myep-diagnostics.json';
  link.hidden=true;
  try{
    documentRef.body.append(link);
    link.click();
  }finally{
    link.remove();
    if(typeof setTimeoutFn==='function')setTimeoutFn(()=>urlRef.revokeObjectURL(url),1000);
    else urlRef.revokeObjectURL(url);
  }
}

export function installMyEpDiagnosticExport({
  documentRef=globalThis.document,panel,
  confirmAction,diagnostics,download=downloadDiagnosticJson,onError=()=>{}
}={}){
  const tabBar=panel?.querySelector?.('.ep133-view-tabs');
  if(!tabBar||!documentRef?.createElement||typeof confirmAction!=='function'||!diagnostics)
    return ()=>{};
  const actions=documentRef.createElement('div');
  actions.className='ep133-diagnostics-actions';
  const button=documentRef.createElement('button');
  button.type='button';
  button.id='ep133-export-diagnostics';
  button.className='ep133-diagnostics-export';
  button.textContent='EXPORT DIAGNOSTICS';
  button.setAttribute('aria-label','Export anonymized My EP diagnostics');
  button.title='Download a local diagnostic log with allowlisted codes and states only';
  actions.append(button);
  tabBar.insertAdjacentElement('afterend',actions);

  let pending=false;
  const onClick=async()=>{
    if(pending)return;
    pending=true;
    button.disabled=true;
    try{
      const accepted=await confirmAction(
        'Download a local anonymized My EP diagnostic JSON? It includes only known error codes and runtime states, not raw Logs, file names, serial numbers, SysEx, audio or project contents. Nothing is uploaded.',
        {confirmLabel:'DOWNLOAD JSON',cancelLabel:'CANCEL'}
      );
      if(accepted===true)download(diagnostics.exportJson(),{documentRef});
    }catch(error){
      onError('COULD NOT EXPORT DIAGNOSTICS.',error);
    }finally{
      button.disabled=false;
      pending=false;
    }
  };
  button.addEventListener('click',onClick);
  return ()=>{button.removeEventListener('click',onClick);actions.remove();};
}
