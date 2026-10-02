import{isConnected}from './device.js?v=20261001-1';
import{
  listSampleRecoveryTransactions,verifySampleRecoveryTransaction,
  acknowledgeSampleRecoveryTransaction,deleteSampleRecoveryTransaction
}from './filesystem.js?v=20261001-1';

const BOOTSTRAP_KEY='__speeduppercutSampleRecoveryUi';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusOf=record=>String(record?.status||record?.transactionStatus||'').toLowerCase();
const formatTime=value=>{
  const date=new Date(value||0);
  return Number.isFinite(date.getTime())?date.toLocaleString():'—';
};

function installStyle(documentRef){
  if(documentRef.getElementById('ep133-sample-recovery-style'))return;
  const style=documentRef.createElement('style');
  style.id='ep133-sample-recovery-style';
  style.textContent=`
.ep-sample-recovery-summary{padding:5px 6px;border:1px solid #aaa;background:#f4f4f4;font:8px "Courier New",monospace}.ep-sample-recovery-slots{margin-top:6px;border:1px solid #aaa}.ep-sample-recovery-slot{display:grid;grid-template-columns:38px 70px minmax(0,1fr) 90px;gap:5px;padding:3px 5px;border-bottom:1px solid #ddd;font:8px "Courier New",monospace}.ep-sample-recovery-slot:last-child{border-bottom:0}.ep-sample-recovery-slot .missing{color:#8a1c12;font-weight:700}.ep-sample-recovery-slot .present{color:#275c27;font-weight:700}.ep-sample-recovery-note{margin-top:6px;padding:5px 6px;background:#fff2c7;border:1px solid #b7952e;font:8px "Courier New",monospace}.ep-sample-recovery-error{padding:6px;color:#7b2015;background:#ffe2de;font:8px "Courier New",monospace}@media(max-width:760px){.ep-sample-recovery-slot{grid-template-columns:38px 70px minmax(0,1fr)}.ep-sample-recovery-slot span:last-child{display:none}}
`;
  documentRef.head?.appendChild(style);
}

function ensureUi(documentRef){
  let section=documentRef.getElementById('ep133-sample-recovery-section');
  if(section)return section;
  const body=documentRef.querySelector('#ep133-backup-dialog .ep-backup-body');
  if(!body)return null;
  section=documentRef.createElement('section');
  section.id='ep133-sample-recovery-section';
  section.className='ep-backup-section ep-sample-recovery-section';
  section.setAttribute('data-recovery-panel','');
  section.innerHTML=`
    <h3>SAMPLE TRANSACTION RECOVERY</h3>
    <div class="ep-recovery-layout">
      <div id="ep133-sample-recovery-list" class="ep-recovery-list"><div class="ep-backup-empty">NO SAMPLE RECOVERY RECORDS</div></div>
      <div class="ep-recovery-inspector">
        <div id="ep133-sample-recovery-detail" class="ep-recovery-detail"><div class="ep-backup-empty">SELECT A SAMPLE TRANSACTION</div></div>
        <div class="ep-recovery-actions">
          <button id="ep133-sample-recovery-verify" type="button" disabled>VERIFY DEVICE STATE</button>
          <button id="ep133-sample-recovery-ack" type="button" disabled>ACKNOWLEDGE CURRENT STATE</button>
          <button id="ep133-sample-recovery-delete" type="button" disabled>DELETE RECORD</button>
        </div>
      </div>
    </div>`;
  body.appendChild(section);
  return section;
}

export function startSampleRecoveryUi({documentRef=globalThis.document,windowRef=globalThis.window,setTimeoutFn=globalThis.setTimeout}={}){
  if(!documentRef)return null;
  if(windowRef?.[BOOTSTRAP_KEY])return windowRef[BOOTSTRAP_KEY];
  installStyle(documentRef);
  const section=ensureUi(documentRef);
  if(!section)return null;
  const list=section.querySelector('#ep133-sample-recovery-list');
  const detail=section.querySelector('#ep133-sample-recovery-detail');
  const verifyButton=section.querySelector('#ep133-sample-recovery-verify');
  const acknowledgeButton=section.querySelector('#ep133-sample-recovery-ack');
  const deleteButton=section.querySelector('#ep133-sample-recovery-delete');
  const recoveryOpen=documentRef.getElementById('ep133-project-recovery');
  let records=[];
  let selectedId=null;
  let busy=false;

  const selected=()=>records.find(item=>item.id===selectedId)||null;
  const setButtons=record=>{
    const status=statusOf(record);
    const unresolved=status==='requires-recovery';
    const hasVerification=!!record?.recoveryDetail?.verification;
    verifyButton.disabled=busy||!record||!unresolved||!isConnected();
    acknowledgeButton.disabled=busy||!record||!unresolved||!hasVerification||!isConnected();
    deleteButton.disabled=busy||!record||['requires-recovery','pending','running'].includes(status);
  };
  const renderDetail=record=>{
    if(!record){
      detail.innerHTML='<div class="ep-backup-empty">SELECT A SAMPLE TRANSACTION</div>';
      setButtons(null);return;
    }
    const recovery=record.recoveryDetail||{};
    const verification=recovery.verification||null;
    const slots=(verification?.affectedSlots||[]).map(item=>
      '<div class="ep-sample-recovery-slot"><b>'+String(item.slot).padStart(3,'0')+'</b><span class="'+(item.present?'present':'missing')+'">'+(item.present?'PRESENT':'MISSING')+'</span><span>'+escapeHtml(item.name||'—')+'</span><span>'+(item.crc==null?'CRC —':'CRC '+escapeHtml(item.crc))+'</span></div>'
    ).join('');
    const journal=(record.journal||[]).map(event=>
      '<div><b>'+escapeHtml(event.sequence||'')+'</b><span>'+escapeHtml((event.detail?.action||event.phase||'').toUpperCase())+'</span><em>'+escapeHtml(event.status||'')+'</em></div>'
    ).join('');
    detail.innerHTML=[
      '<div class="ep-recovery-head"><strong>',escapeHtml(String(record.operation||'sample').toUpperCase()),'</strong><span>',escapeHtml(statusOf(record).toUpperCase()),'</span></div>',
      '<div class="ep-sample-recovery-summary"><b>',escapeHtml(record.label||record.operation||'sample transaction'),'</b><br>',escapeHtml(formatTime(record.updatedAt||record.createdAt)),'<br>',escapeHtml(recovery.reason||'Recovery journal requires review.'),'</div>',
      verification?'<div class="ep-sample-recovery-note"><b>'+escapeHtml(verification.classification.toUpperCase())+'</b><br>'+escapeHtml(verification.summary)+'<br>VERIFY IS READ-ONLY · NO DEVICE MUTATION WAS PERFORMED.</div>':'<div class="ep-sample-recovery-note">VERIFY DEVICE STATE BEFORE ACKNOWLEDGING. ACKNOWLEDGE ONLY CLEARS THIS RECOVERY WARNING; IT DOES NOT RESTORE PCM OR CHANGE THE EP.</div>',
      slots?'<div class="ep-sample-recovery-slots">'+slots+'</div>':'',
      journal?'<div class="ep-recovery-journal">'+journal+'</div>':''
    ].join('');
    setButtons(record);
  };
  const renderList=()=>{
    if(!records.length){list.innerHTML='<div class="ep-backup-empty">NO SAMPLE RECOVERY RECORDS</div>';selectedId=null;renderDetail(null);return;}
    if(!records.some(item=>item.id===selectedId))selectedId=records[0].id;
    list.innerHTML=records.map(record=>
      '<button type="button" class="ep-recovery-row '+(record.id===selectedId?'selected':'')+'" data-sample-recovery-id="'+escapeHtml(record.id)+'"><b>'+escapeHtml(String(record.operation||'sample').toUpperCase())+'</b><span>'+escapeHtml(statusOf(record).toUpperCase())+'</span><small>'+escapeHtml(formatTime(record.updatedAt||record.createdAt))+'</small></button>'
    ).join('');
    renderDetail(selected());
  };
  const refresh=async()=>{
    try{records=await listSampleRecoveryTransactions();renderList();}
    catch(error){detail.innerHTML='<div class="ep-sample-recovery-error">'+escapeHtml(error?.message||error)+'</div>';}
  };
  const run=async operation=>{
    if(busy)return;
    busy=true;setButtons(selected());
    try{await operation();await refresh();}
    catch(error){detail.insertAdjacentHTML('afterbegin','<div class="ep-sample-recovery-error">'+escapeHtml(error?.message||error)+'</div>');}
    finally{busy=false;setButtons(selected());}
  };

  list.addEventListener('click',event=>{
    const row=event.target.closest?.('[data-sample-recovery-id]');
    if(!row)return;
    selectedId=row.dataset.sampleRecoveryId||null;renderList();
  });
  verifyButton.addEventListener('click',()=>run(async()=>{
    const record=selected();if(!record)return;
    await verifySampleRecoveryTransaction(record.id);
  }));
  acknowledgeButton.addEventListener('click',()=>run(async()=>{
    const record=selected();if(!record)return;
    const ok=windowRef?.confirm?.('ACKNOWLEDGE CURRENT SAMPLE STATE?\n\nThis only clears the recovery warning. It does not restore or modify samples.')??true;
    if(!ok)return;
    await acknowledgeSampleRecoveryTransaction(record.id);
  }));
  deleteButton.addEventListener('click',()=>run(async()=>{
    const record=selected();if(!record)return;
    const ok=windowRef?.confirm?.('DELETE THIS RESOLVED SAMPLE RECOVERY RECORD?')??true;
    if(!ok)return;
    await deleteSampleRecoveryTransaction(record.id);selectedId=null;
  }));
  recoveryOpen?.addEventListener('click',()=>setTimeoutFn?.(()=>{void refresh();},0));
  const controller=Object.freeze({refresh,getSelected:()=>selected()});
  if(windowRef)windowRef[BOOTSTRAP_KEY]=controller;
  return controller;
}

if(typeof document!=='undefined')startSampleRecoveryUi();
