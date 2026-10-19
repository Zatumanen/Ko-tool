const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createPadRecoveryController({dom,listRecords,verify,restore,acknowledge,confirmAction,reportError}={}){
  let records=[],selected=null,version=0,busy=false,activeAction=null,disposed=false;
  const listeners=[],errors=new Map();
  const listen=(el,type,fn)=>{el?.addEventListener(type,fn);listeners.push([el,type,fn]);};
  const render=()=>{
    const record=records.find(item=>item.id===selected);
    if(dom.padRecoveryDetail)dom.padRecoveryDetail.textContent=record
      ?'PAD '+record.target.project+' / '+record.target.group+' / '+record.target.pad+' · SAMPLE '+record.target.sampleSlot+' · '+record.status+'\nORIGINAL '+JSON.stringify(record.before)+'\nCURRENT '+(record.verification?.metadata?JSON.stringify(record.verification.metadata):'NOT YET VERIFIED')+'\nDESIRED '+JSON.stringify(record.desired)+(errors.size?'\nNOT COMPLETED · '+[...errors.values()].join(' · '):'')
      :'Select a pad recovery record. Verification reads the connected device; acknowledge current state before a separate restore.';
    for(const key of ['padRecoveryVerify','padRecoveryRestore','padRecoveryAcknowledge'])if(dom[key])dom[key].disabled=busy||!record;
    for(const key of ['padRecoveryList','padRecoveryRefresh'])if(dom[key])dom[key].disabled=busy;
  };
  const refreshRecords=async()=>{
    const current=++version;
    try{const result=await listRecords();if(disposed||current!==version)return;records=result||[];
      if(!records.some(record=>record.id===selected))selected=null;
      if(dom.padRecoveryList){dom.padRecoveryList.innerHTML='<option value="">CHOOSE PAD RECOVERY RECORD</option>'+records.map(record=>'<option value="'+escape(record.id)+'">'+escape(record.target.project+' / '+record.target.group+' / '+record.target.pad+' · '+record.status)+'</option>').join('');dom.padRecoveryList.value=selected||'';}render();
    }catch(error){if(!disposed&&current===version){if(dom.padRecoveryDetail)dom.padRecoveryDetail.textContent='RECOVERY UNAVAILABLE · '+error.message;reportError?.('COULD NOT READ PAD RECOVERY.',error);}}
  };
  const refresh=()=>{if(disposed||busy)return;return refreshRecords();};
  const run=async kind=>{
    if(disposed||busy||!selected)return;const id=selected,current=version,operation={};activeAction=operation;busy=true;render();
    try{
      if(kind!=='verify'&&!await confirmAction(kind==='restore'?'Restore original values to this one pad? This creates a new guarded transaction; verify and acknowledge current state first.':'Acknowledge the freshly read current pad state and clear this recovery blocker?'))return;
      if(disposed||current!==version||id!==selected)return;
      const result=await(kind==='verify'?verify(id):kind==='restore'?restore(id,{confirmed:true}):acknowledge(id));
      if(disposed||current!==version)return;
      const record=records.find(item=>item.id===id);if(record&&result?.metadata)record.verification=result;
      errors.delete(kind);await refreshRecords();
    }catch(error){if(!disposed&&current===version){errors.set(kind,String(error.message||error));render();reportError?.('PAD RECOVERY FAILED.',error);}}
    finally{if(activeAction===operation){activeAction=null;busy=false;if(!disposed)render();}}
  };
  listen(dom.padRecoveryList,'change',()=>{if(busy)return;selected=dom.padRecoveryList.value||null;errors.clear();version++;render();});
  listen(dom.padRecoveryRefresh,'click',refresh);listen(dom.padRecoveryVerify,'click',()=>run('verify'));listen(dom.padRecoveryRestore,'click',()=>run('restore'));listen(dom.padRecoveryAcknowledge,'click',()=>run('acknowledge'));
  const reset=()=>{version++;records=[];selected=null;activeAction=null;busy=false;errors.clear();if(dom.padRecoveryList){dom.padRecoveryList.innerHTML='';dom.padRecoveryList.value='';}render();};
  reset();return{refresh,reset,dispose(){reset();disposed=true;for(const[el,type,fn]of listeners)el?.removeEventListener(type,fn);listeners.length=0;}};
}
