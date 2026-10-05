import{getDeviceRuntimeSnapshot,onDeviceRuntimeChange}from './deviceRuntime.js';
import{
  getProjectRuntimeSettleState,
  listSampleRecoveryTransactions,listProjectRecoveryCheckpoints
}from './filesystem.js?v=20261001-1';
import{createMyEpWorkspaceState}from './ui/workspaceState.js?v=20261003-1';

const BOOTSTRAP_KEY='__speeduppercutMyEpWorkspace';
const POLL_MS=200;
const RECOVERY_POLL_MS=4000;
const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const parseTime=value=>{
  const time=new Date(value||0).getTime();
  return Number.isFinite(time)?time:0;
};
const sameState=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normalizeRecoveryStatus=status=>{
  const value=text(status).toLowerCase();
  if(value==='verified'||value==='succeeded')return'succeeded';
  if(value==='requires-recovery')return'requires-recovery';
  if(value==='rolled-back')return'rolled-back';
  if(value==='restored')return'restored';
  if(value==='failed')return'failed';
  return null;
};

function installWorkspaceStyle(documentRef){
  if(documentRef.getElementById('ep133-workspace-style'))return;
  const style=documentRef.createElement('style');
  style.id='ep133-workspace-style';
  style.textContent=`
.ep133-workspace-status{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.5fr) minmax(0,1fr);gap:3px;padding:0 2px;font:700 10px "Courier New",monospace;text-transform:uppercase}
.ep133-workspace-status>span{min-width:0;padding:4px 6px;background:#c0c0c0;border:2px inset #dfdfdf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111}
.ep133-workspace-status .busy{background:#ffffc0}.ep133-workspace-status .warning{background:#ffdf80}.ep133-workspace-status .danger{background:#ffb0b0}
.ep133-workspace-last{grid-column:1/-1;font-weight:400!important}
@media(max-width:760px){.ep133-workspace-status{grid-template-columns:1fr}.ep133-workspace-last{grid-column:auto}}
`;
  documentRef.head?.appendChild(style);
}

function ensureWorkspaceView(documentRef){
  let root=documentRef.getElementById('ep133-workspace-status');
  if(root)return root;
  const deviceHead=documentRef.getElementById('ep133-device-head');
  const tabs=documentRef.querySelector('.ep133-view-tabs');
  if(!deviceHead||!tabs)return null;
  root=documentRef.createElement('div');
  root.id='ep133-workspace-status';
  root.className='ep133-workspace-status';
  root.setAttribute('role','status');
  root.setAttribute('aria-live','polite');
  root.innerHTML=[
    '<span data-workspace-connection>DISCONNECTED</span>',
    '<span data-workspace-operation>READY</span>',
    '<span data-workspace-recovery>RECOVERY · NONE</span>',
    '<span class="ep133-workspace-last" data-workspace-last>LAST · —</span>'
  ].join('');
  tabs.parentNode?.insertBefore(root,tabs);
  return root;
}

function formatConnection(state){
  const connection=state.connection;
  if(connection.unsafe)return{label:'SAFETY LOCK',tone:'danger'};
  const device=connection.device||state.lastDevice;
  const identity=[device?.sku,device?.firmware&&('FW '+device.firmware)].filter(Boolean).join(' · ');
  if(connection.status==='connected')return{label:'CONNECTED'+(identity?' · '+identity:''),tone:''};
  return{label:'DISCONNECTED'+(identity?' · LAST '+identity:''),tone:''};
}
function formatOperation(state){
  const coordinator=state.coordinator;
  if(state.connection.unsafe||coordinator.state==='unsafe')return{label:'FILE · UNSAFE',tone:'danger'};
  if(coordinator.state==='blocked')return{label:'FILE · BLOCKED',tone:'danger'};
  if(coordinator.active){
    return{label:upper(coordinator.active.phase)+' · '+upper(coordinator.active.label),tone:'busy'};
  }
  if(state.projectRuntime.settling){
    return{label:'PROJECT SETTLING · '+Math.ceil(state.projectRuntime.remainingMs/1000)+'S',tone:'busy'};
  }
  return{label:'READY',tone:''};
}
function formatRecovery(state){
  const recovery=state.recovery;
  if(!recovery.required)return{label:'RECOVERY · NONE',tone:''};
  const parts=[];
  if(recovery.sampleRequired)parts.push('SAMPLE '+recovery.sampleRequired);
  if(recovery.projectRequired)parts.push('PROJECT '+recovery.projectRequired);
  return{label:'RECOVERY REQUIRED · '+parts.join(' · '),tone:'danger'};
}
function formatLast(state){
  const item=state.lastOperation;
  if(!item)return{label:'LAST · —',tone:''};
  const status=upper(item.status||'finished');
  const danger=status==='FAILED'||status==='REQUIRES-RECOVERY';
  const warning=status==='ROLLED-BACK';
  const code=item.error?.code?' · '+upper(item.error.code):'';
  return{label:'LAST · '+status+' · '+upper(item.label)+code,tone:danger?'danger':warning?'warning':''};
}
function applyStatus(element,formatted){
  if(!element)return;
  element.textContent=formatted.label;
  element.classList.toggle('busy',formatted.tone==='busy');
  element.classList.toggle('warning',formatted.tone==='warning');
  element.classList.toggle('danger',formatted.tone==='danger');
  element.title=formatted.label;
}

export function startMyEpWorkspace({
  documentRef=globalThis.document,
  windowRef=globalThis.window,
  setIntervalFn=globalThis.setInterval,
  clearIntervalFn=globalThis.clearInterval,
  setTimeoutFn=globalThis.setTimeout
}={}){
  if(!documentRef)return null;
  if(windowRef?.[BOOTSTRAP_KEY])return windowRef[BOOTSTRAP_KEY];
  installWorkspaceStyle(documentRef);
  const root=ensureWorkspaceView(documentRef);
  if(!root)return null;

  const workspace=createMyEpWorkspaceState();
  if(windowRef)windowRef[BOOTSTRAP_KEY]=workspace;
  const connectionEl=root.querySelector('[data-workspace-connection]');
  const operationEl=root.querySelector('[data-workspace-operation]');
  const recoveryEl=root.querySelector('[data-workspace-recovery]');
  const lastEl=root.querySelector('[data-workspace-last]');
  const render=state=>{
    applyStatus(connectionEl,formatConnection(state));
    applyStatus(operationEl,formatOperation(state));
    applyStatus(recoveryEl,formatRecovery(state));
    applyStatus(lastEl,formatLast(state));
  };
  const unsubscribeWorkspace=workspace.subscribe(render);

  const samplesButton=documentRef.getElementById('ep133-view-samples');
  const projectsButton=documentRef.getElementById('ep133-view-projects');
  samplesButton?.addEventListener('click',()=>workspace.setView('samples'));
  projectsButton?.addEventListener('click',()=>workspace.setView('projects'));
  setTimeoutFn?.(()=>{
    const mode=workspace.getState().view.mode;
    const button=mode==='projects'?projectsButton:samplesButton;
    if(button&&button.getAttribute('aria-selected')!=='true')button.click();
  },0);

  let previousDeviceRuntime=null;
  const applyDeviceRuntime=snapshot=>{
    const previousActive=previousDeviceRuntime?.operation?.active;
    const nextActive=snapshot?.operation?.active;
    const becameConnected=
      previousDeviceRuntime?.connection?.status!=='connected'&&snapshot?.connection?.status==='connected';
    previousDeviceRuntime=snapshot;
    workspace.setRuntime(snapshot);
    if(previousActive&&!nextActive){
      workspace.recordOperation({label:previousActive.label,mode:previousActive.mode,status:'finished',at:Date.now()});
      setTimeoutFn?.(()=>{void refreshRecovery();},0);
    }
    if(becameConnected)void refreshRecovery();
  };
  applyDeviceRuntime(getDeviceRuntimeSnapshot());
  const unsubscribeRuntime=onDeviceRuntimeChange(applyDeviceRuntime);

  let previousProjectRuntime=null;
  const pollProjectRuntime=()=>{
    try{
      const runtime=getProjectRuntimeSettleState();
      if(!sameState(previousProjectRuntime,runtime)){
        previousProjectRuntime=runtime;
        workspace.setProjectRuntime(runtime);
      }
    }catch{}
  };

  const newestRecoveryOperation=(sampleTransactions,projectCheckpoints)=>{
    const items=[];
    for(const record of sampleTransactions||[]){
      const status=normalizeRecoveryStatus(record?.status||record?.transactionStatus);
      if(!status)continue;
      items.push({
        label:text(record?.label||record?.operation||'sample transaction'),
        status,
        at:parseTime(record?.updatedAt||record?.createdAt),
        error:record?.recoveryDetail?.errorInfo||record?.errorInfo||null
      });
    }
    for(const record of projectCheckpoints||[]){
      const status=normalizeRecoveryStatus(record?.status);
      if(!status)continue;
      items.push({
        label:'project '+text(record?.project||record?.projectNumber||'write'),
        status,
        at:parseTime(record?.updatedAt||record?.verifiedAt||record?.createdAt),
        error:record?.errorInfo||record?.recoveryDetail?.errorInfo||null
      });
    }
    return items.sort((a,b)=>b.at-a.at)[0]||null;
  };

  async function refreshRecovery(){
    const [sampleResult,projectResult]=await Promise.allSettled([
      listSampleRecoveryTransactions(),listProjectRecoveryCheckpoints()
    ]);
    const samples=sampleResult.status==='fulfilled'?sampleResult.value:[];
    const projects=projectResult.status==='fulfilled'?projectResult.value:[];
    workspace.setRecovery({sampleTransactions:samples,projectCheckpoints:projects});
    const latest=newestRecoveryOperation(samples,projects);
    if(latest&&latest.at>(workspace.getState().lastOperation?.at||0))workspace.recordOperation(latest);
  }

  pollProjectRuntime();
  void refreshRecovery();
  const pollTimer=setIntervalFn?.(pollProjectRuntime,POLL_MS);
  const recoveryTimer=setIntervalFn?.(()=>{void refreshRecovery();},RECOVERY_POLL_MS);
  const dispose=()=>{
    unsubscribeWorkspace();unsubscribeRuntime();
    if(pollTimer!=null)clearIntervalFn?.(pollTimer);
    if(recoveryTimer!=null)clearIntervalFn?.(recoveryTimer);
    if(windowRef?.[BOOTSTRAP_KEY]===workspace)delete windowRef[BOOTSTRAP_KEY];
  };
  windowRef?.addEventListener?.('beforeunload',dispose,{once:true});
  return workspace;
}

if(typeof document!=='undefined')startMyEpWorkspace();
