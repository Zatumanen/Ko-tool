import{createSampleRecoveryTransaction}from './sampleRecovery.js?v=20261001-1';
import{serializeEpError}from './errors.js?v=20261001-1';
import{
  SAMPLE_TRANSACTION_PHASES,SAMPLE_TRANSACTION_EVENT_STATUS,
  assessSampleTransactionRecovery,sampleOperationFromLabel
}from './sampleTransactionContract.js?v=20261008-1';

export{SAMPLE_TRANSACTION_PHASES,SAMPLE_TRANSACTION_EVENT_STATUS,sampleOperationFromLabel};
export const assessSampleRecovery=assessSampleTransactionRecovery;

const PHASES=new Set(SAMPLE_TRANSACTION_PHASES);
const EVENT_STATUS=new Set(SAMPLE_TRANSACTION_EVENT_STATUS);
const timestamp=value=>{
  const date=value instanceof Date?value:new Date(value||Date.now());
  return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();
};
const safeError=error=>String(error?.message||error||'Unknown error').slice(0,1000);
const sanitizeValue=(value,depth=0)=>{
  if(depth>4)return'[truncated]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,500);
  if(value instanceof Uint8Array||value instanceof ArrayBuffer)return'[binary omitted]';
  if(Array.isArray(value))return value.slice(0,64).map(item=>sanitizeValue(item,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const[key,item]of Object.entries(value)){
      if(/^(data|bytes|pcm|audio|serial|serialNumber)$/i.test(key))continue;
      out[key]=sanitizeValue(item,depth+1);
    }
    return out;
  }
  return String(value).slice(0,500);
};

export function createSampleTransactionJournal({
  recoveryStore,getConnectedDeviceInfo,now=()=>new Date()
}={}){
  for(const method of ['saveTransaction','updateTransaction','getTransaction','listTransactions','deleteTransaction'])
    if(typeof recoveryStore?.[method]!=='function')
      throw new TypeError('Sample transaction journal recoveryStore.'+method+' is required.');
  if(typeof getConnectedDeviceInfo!=='function')
    throw new TypeError('Sample transaction journal getConnectedDeviceInfo is required.');

  const append=async(id,phase,status,{detail=null,error=null}={})=>{
    const normalizedPhase=String(phase||'').toUpperCase();
    const normalizedStatus=String(status||'').toLowerCase();
    if(!PHASES.has(normalizedPhase))throw new Error('Unknown sample transaction phase: '+normalizedPhase);
    if(!EVENT_STATUS.has(normalizedStatus))throw new Error('Unknown sample transaction event status: '+normalizedStatus);
    const current=await recoveryStore.getTransaction(id);
    if(!current)throw new Error('Sample recovery transaction was not found: '+String(id||''));
    const journal=Array.isArray(current.journal)?current.journal.map(event=>({...event})):[];
    const event={
      sequence:journal.length+1,
      phase:normalizedPhase,
      status:normalizedStatus,
      at:timestamp(now()),
      detail:detail==null?null:sanitizeValue(detail),
      error:error==null?null:safeError(error),
      errorInfo:error==null?null:serializeEpError(error)
    };
    journal.push(event);
    const patch={journal,currentPhase:normalizedPhase,transactionStatus:'running'};
    if(normalizedStatus==='completed')patch.lastSuccessfulPhase=normalizedPhase;
    if(normalizedStatus==='failed'&&!current.failurePhase)patch.failurePhase=normalizedPhase;
    return recoveryStore.updateTransaction(id,patch);
  };

  return Object.freeze({
    persistent:!!recoveryStore.persistent,
    async begin({operation,label='',slots=[],detail=null}={}){
      const checkpoint=createSampleRecoveryTransaction({
        device:getConnectedDeviceInfo()||{},operation,label,slots,detail,createdAt:now()
      });
      const saved=await recoveryStore.saveTransaction(checkpoint);
      await append(saved.id,'PRECHECK','started',{detail:{label:saved.label,persistent:!!recoveryStore.persistent}});
      return recoveryStore.getTransaction(saved.id);
    },
    beginPhase:(id,phase,detail=null)=>append(id,phase,'started',{detail}),
    completePhase:(id,phase,detail=null)=>append(id,phase,'completed',{detail}),
    failPhase:(id,phase,error,detail=null)=>append(id,phase,'failed',{detail,error}),
    async succeed(id,detail=null){
      await append(id,'FINALIZE','completed',{detail});
      return recoveryStore.updateTransaction(id,{
        status:'succeeded',transactionStatus:'succeeded',recoveryDetail:null
      });
    },
    async fail(id,error,detail=null){
      try{await append(id,'FINALIZE','failed',{detail,error});}catch{}
      const current=await recoveryStore.getTransaction(id);
      const assessment=assessSampleRecovery(current);
      if(assessment.status==='rolled-back'){
        try{await append(id,'RECOVERY','completed',{detail:assessment});}catch{}
      }else if(assessment.requiresRecovery){
        try{await append(id,'RECOVERY','failed',{detail:assessment,error});}catch{}
      }
      return recoveryStore.updateTransaction(id,{
        status:assessment.status,
        transactionStatus:assessment.status,
        recoveryDetail:sanitizeValue({...assessment,error:safeError(error),errorInfo:serializeEpError(error)})
      });
    },
    getTransaction:id=>recoveryStore.getTransaction(id),
    listTransactions:()=>recoveryStore.listTransactions(),
    deleteTransaction:id=>recoveryStore.deleteTransaction(id)
  });
}

export function createJournaledSampleFileOps({fileOps,journal,transactionId,ensurePrecheckComplete}={}){
  if(!fileOps||typeof fileOps!=='object')throw new TypeError('Sample journal fileOps are required.');
  if(!journal||!transactionId)return Object.freeze({...fileOps});
  let precheckComplete=false;
  const beforeMutation=async()=>{
    if(precheckComplete)return;
    if(typeof ensurePrecheckComplete==='function')await ensurePrecheckComplete();
    else await journal.completePhase(transactionId,'PRECHECK');
    precheckComplete=true;
  };
  const mutationResult=(action,result)=>{
    if(action==='upload')return{fileId:Number(result)||null};
    if(action==='move')return{
      oldFileId:Number(result?.oldFileId)||null,newFileId:Number(result?.newFileId)||null,
      sourceCrc:Number.isFinite(Number(result?.sourceCrc))?Number(result.sourceCrc):null,
      destinationCrc:Number.isFinite(Number(result?.destinationCrc))?Number(result.destinationCrc):null,
      crcVerified:result?.crcVerified===true
    };
    return{};
  };
  const record=async(action,detail,operation)=>{
    await beforeMutation();
    await journal.beginPhase(transactionId,'MUTATE',{action,...detail});
    try{
      const result=await operation();
      await journal.completePhase(transactionId,'MUTATE',{action,...detail,...mutationResult(action,result)});
      return result;
    }catch(error){
      await journal.failPhase(transactionId,'MUTATE',error,{action,...detail});
      throw error;
    }
  };

  const wrapped={...fileOps};
  if(typeof fileOps.uploadSampleToSlot==='function')wrapped.uploadSampleToSlot=async args=>{
    let createdId=null;
    const originalOnCreated=args?.onCreated;
    const nextArgs={...args,onCreated:id=>{
      createdId=Number(id)||Number(args?.destinationId)||null;
      originalOnCreated?.(id);
    }};
    await beforeMutation();
    const detail={action:'upload',destinationId:Number(args?.destinationId)||null,createdId:null};
    await journal.beginPhase(transactionId,'MUTATE',detail);
    try{
      const result=await fileOps.uploadSampleToSlot(nextArgs);
      const fileId=Number(result)||createdId||Number(args?.destinationId)||null;
      await journal.completePhase(transactionId,'MUTATE',{...detail,createdId,fileId});
      return result;
    }catch(error){
      await journal.failPhase(transactionId,'MUTATE',error,{...detail,createdId});
      throw error;
    }
  };
  if(typeof fileOps.deleteFile==='function')wrapped.deleteFile=(slotId,...rest)=>record(
    'delete',{slotId:Number(slotId)||null},()=>fileOps.deleteFile(slotId,...rest)
  );
  if(typeof fileOps.moveFile==='function')wrapped.moveFile=(sourceId,parentId,targetId,options)=>record(
    'move',{
      sourceId:Number(sourceId)||null,targetId:Number(targetId)||null,parentId:Number(parentId)||null,
      verifyCrc:options?.verifyCrc===true
    },()=>fileOps.moveFile(sourceId,parentId,targetId,options)
  );
  if(typeof fileOps.setFileMetadata==='function')wrapped.setFileMetadata=(slotId,payload,...rest)=>record(
    'set-metadata',{
      slotId:Number(slotId)||null,
      keys:payload&&typeof payload==='object'?Object.keys(payload).sort():[]
    },()=>fileOps.setFileMetadata(slotId,payload,...rest)
  );
  Object.defineProperty(wrapped,'sampleJournalState',{
    value:Object.freeze({transactionId,ensurePrecheckComplete:beforeMutation}),enumerable:false
  });
  return Object.freeze(wrapped);
}
