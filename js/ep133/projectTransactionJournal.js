import{assertProjectTransactionStatus}from './coreContracts.js?v=20261008-1';
import{serializeEpError}from './errors.js?v=20261001-1';

export const PROJECT_TRANSACTION_PHASES=Object.freeze([
  'PRECHECK','CHECKPOINT','WRITE','READBACK','RELOAD','VERIFY','ROLLBACK'
]);
export const PROJECT_TRANSACTION_EVENT_STATUS=Object.freeze([
  'started','completed','skipped','failed'
]);

const PHASES=new Set(PROJECT_TRANSACTION_PHASES);
const EVENT_STATUS=new Set(PROJECT_TRANSACTION_EVENT_STATUS);

const timestamp=value=>{
  const date=value instanceof Date?value:new Date(value||Date.now());
  return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();
};
const safeError=error=>String(error?.message||error||'Unknown error').slice(0,1000);

const sanitizeValue=(value,depth=0)=>{
  if(depth>3)return'[truncated]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,500);
  if(Array.isArray(value))return value.slice(0,32).map(item=>sanitizeValue(item,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const[key,item]of Object.entries(value)){
      if(/^(data|serial|serialNumber)$/i.test(key))continue;
      out[key]=sanitizeValue(item,depth+1);
    }
    return out;
  }
  return String(value).slice(0,500);
};

export function journalFromCheckpoint(checkpoint){
  if(!checkpoint)return null;
  return{
    id:String(checkpoint.id||''),
    transactionStatus:String(checkpoint.transactionStatus||'pending'),
    currentPhase:checkpoint.currentPhase||null,
    lastSuccessfulPhase:checkpoint.lastSuccessfulPhase||null,
    failurePhase:checkpoint.failurePhase||null,
    events:Array.isArray(checkpoint.journal)
      ?checkpoint.journal.map(event=>({...event,detail:event.detail?sanitizeValue(event.detail):null,errorInfo:event.errorInfo?sanitizeValue(event.errorInfo):null}))
      :[]
  };
}

export function createProjectTransactionJournal({
  recoveryStore,
  now=()=>new Date()
}={}){
  for(const method of ['getCheckpoint','updateCheckpoint'])
    if(typeof recoveryStore?.[method]!=='function')
      throw new TypeError('Project transaction journal recoveryStore.'+method+' is required.');

  const append=async(checkpointId,phase,status,{detail=null,error=null,transactionStatus=null}={})=>{
    const normalizedPhase=String(phase||'').toUpperCase();
    const normalizedStatus=String(status||'').toLowerCase();
    if(!PHASES.has(normalizedPhase))throw new Error('Unknown project transaction phase: '+normalizedPhase);
    if(!EVENT_STATUS.has(normalizedStatus))throw new Error('Unknown project transaction event status: '+normalizedStatus);

    const current=await recoveryStore.getCheckpoint(checkpointId);
    if(!current)throw new Error('Project transaction checkpoint was not found: '+String(checkpointId||''));

    const journal=Array.isArray(current.journal)?current.journal.map(event=>({...event})):[];
    const event=Object.freeze({
      sequence:journal.length+1,
      phase:normalizedPhase,
      status:normalizedStatus,
      at:timestamp(now()),
      detail:detail==null?null:sanitizeValue(detail),
      error:error==null?null:safeError(error),
      errorInfo:error==null?null:serializeEpError(error)
    });
    journal.push(event);

    let nextTransactionStatus=transactionStatus||current.transactionStatus||'running';
    if(normalizedStatus==='failed')nextTransactionStatus='failed';
    if(normalizedPhase==='VERIFY'&&normalizedStatus==='completed')nextTransactionStatus='succeeded';
    if(normalizedPhase==='ROLLBACK'&&normalizedStatus==='completed')nextTransactionStatus='rolled-back';
    if(normalizedPhase==='ROLLBACK'&&normalizedStatus==='failed')nextTransactionStatus='rollback-failed';

    assertProjectTransactionStatus(nextTransactionStatus);
    const patch={
      journal,
      transactionStatus:nextTransactionStatus,
      currentPhase:normalizedPhase
    };
    if(normalizedStatus==='completed')patch.lastSuccessfulPhase=normalizedPhase;
    if(normalizedStatus==='failed'&&normalizedPhase!=='ROLLBACK'&&!current.failurePhase)
      patch.failurePhase=normalizedPhase;

    const saved=await recoveryStore.updateCheckpoint(checkpointId,patch);
    return{event,checkpoint:saved,journal:journalFromCheckpoint(saved)};
  };

  return Object.freeze({
    beginPhase:(id,phase,detail=null)=>append(id,phase,'started',{detail,transactionStatus:'running'}),
    completePhase:(id,phase,detail=null)=>append(id,phase,'completed',{detail}),
    skipPhase:(id,phase,detail=null)=>append(id,phase,'skipped',{detail}),
    failPhase:(id,phase,error,detail=null)=>append(id,phase,'failed',{detail,error}),
    async markRequiresRecovery(id,detail=null){
      const current=await recoveryStore.getCheckpoint(id);
      if(!current)throw new Error('Project transaction checkpoint was not found: '+String(id||''));
      return recoveryStore.updateCheckpoint(id,{
        transactionStatus:'requires-recovery',
        recoveryDetail:detail==null?null:sanitizeValue(detail)
      });
    },
    async markAborted(id,detail=null){
      const current=await recoveryStore.getCheckpoint(id);
      if(!current)throw new Error('Project transaction checkpoint was not found: '+String(id||''));
      return recoveryStore.updateCheckpoint(id,{
        transactionStatus:'aborted',
        recoveryDetail:detail==null?null:sanitizeValue(detail)
      });
    },
    async getJournal(id){
      return journalFromCheckpoint(await recoveryStore.getCheckpoint(id));
    }
  });
}
