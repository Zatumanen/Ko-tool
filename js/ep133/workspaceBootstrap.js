import{getDeviceRuntimeSnapshot,onDeviceRuntimeChange}from './deviceRuntime.js';
import{
  getProjectRuntimeSettleState,
  listSampleRecoveryTransactions,listProjectRecoveryCheckpoints
}from './filesystem.js?v=20261001-1';
import{createMyEpWorkspaceState}from './ui/workspaceState.js?v=20261003-1';
import{describeMyEpWorkspaceGuidance,describeMyEpTechnicalState}from './ui/workspaceGuidance.js';

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
.ep133-workspace-guidance{grid-column:1/-1;display:grid;gap:6px;background:#e4e9e8;color:#162125;border:2px inset #dfdfdf;padding:9px 12px;text-transform:none;white-space:normal;font:12px/1.45 Arial,sans-serif}
.ep133-workspace-guidance[data-tone="danger"]{background:#ffded4;border-color:#bd6652}
.ep133-workspace-guidance[data-tone="busy"]{background:#ffffd5}
.ep133-workspace-guidance strong{font-size:13px}
.ep133-workspace-guidance p{margin:0}
.ep133-workspace-guidance button{justify-self:start;border:1px solid #4d565b;background:#fff;color:#182125;padding:7px 12px;cursor:pointer;font:700 11px "Courier New",monospace}
.ep133-workspace-guidance button:focus-visible,.ep133-workspace-technical summary:focus-visible{outline:3px solid #bb583f;outline-offset:2px}
.ep133-workspace-technical{grid-column:1/-1;color:#222;background:#c0c0c0;border:2px inset #dfdfdf;font:10px/1.5 "Courier New",monospace;text-transform:none}
.ep133-workspace-technical summary{cursor:pointer;padding:7px 9px;font-weight:bold}
.ep133-workspace-technical pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px 10px;margin:0;border-top:1px solid #929292;font:inherit}
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
    '<span class="ep133-workspace-last" data-workspace-last>LAST · —</span>',
    '<div class="ep133-workspace-guidance" data-workspace-guidance><strong data-workspace-guidance-title>Device not connected</strong><p data-workspace-guidance-summary>There is no verified active device connection.</p><p data-workspace-guidance-next>Connect explicitly in My EP.</p><button type="button" data-workspace-review-recovery hidden>REVIEW RECOVERY →</button></div>',
    '<details class="ep133-workspace-technical" data-workspace-details><summary>TECHNICAL DETAILS</summary><pre data-workspace-technical>Connection: disconnected</pre></details>'
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
  return{label:'LAST · '+status+' · '+upper(item.label),tone:danger?'danger':warning?'warning':''};
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
  const guidance=root.querySelector('[data-workspace-guidance]');
  const guidanceTitle=root.querySelector('[data-workspace-guidance-title]');
  const guidanceSummary=root.querySelector('[data-workspace-guidance-summary]');
  const guidanceNext=root.querySelector('[data-workspace-guidance-next]');
  const technical=root.querySelector('[data-workspace-technical]');
  const reviewButton=root.querySelector('[data-workspace-review-recovery]');
  const render=state=>{
    applyStatus(connectionEl,formatConnection(state));
    applyStatus(operationEl,formatOperation(state));
    applyStatus(recoveryEl,formatRecovery(state));
    applyStatus(lastEl,formatLast(state));
    const copy=describeMyEpWorkspaceGuidance(state);
    if(guidance)guidance.dataset.tone=copy.tone;
    if(guidanceTitle)guidanceTitle.textContent=copy.label;
    if(guidanceSummary)guidanceSummary.textContent=copy.summary;
    if(guidanceNext)guidanceNext.textContent=copy.next;
    if(reviewButton)reviewButton.hidden=!copy.canReview;
    if(technical)technical.textContent=describeMyEpTechnicalState(state);
  };
  const unsubscribeWorkspace=workspace.subscribe(render);

  const samplesButton=documentRef.getElementById('ep133-view-samples');
  const projectsButton=documentRef.getElementById('ep133-view-projects');
  samplesButton?.addEventListener('click',()=>workspace.setView('samples'));
  projectsButton?.addEventListener('click',()=>workspace.setView('projects'));
  reviewButton?.addEventListener('click',()=>{
    // User-initiated navigation only: existing recovery controller still owns
    // verification, confirmation and any device mutation.
    const recoveryButton=documentRef.getElementById('ep133-project-recovery');
    if(!reviewButton.hidden&&projectsButton&&recoveryButton){
      projectsButton.click();recoveryButton.click();
    }
  });
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
