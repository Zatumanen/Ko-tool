import{createBrowserSampleRecoveryStore}from './sampleRecovery.js?v=20261001-1';
import{
  createSampleTransactionJournal,createJournaledSampleFileOps,sampleOperationFromLabel
}from './sampleTransactionJournal.js?v=20261001-1';
import{
  verifySampleRecoveryTransactionState,assertSampleRecoveryDevice
}from './sampleRecoveryVerifier.js?v=20261003-3';

export function createSampleTransactionRuntime({
  getConnectedDeviceInfo,recoveryStore=createBrowserSampleRecoveryStore()
}={}){
  const journal=createSampleTransactionJournal({recoveryStore,getConnectedDeviceInfo});

  const run=async({label,operation,fileOps}={})=>{
    if(typeof operation!=='function')throw new TypeError('Sample transaction runtime requires an operation.');
    const sampleOperation=sampleOperationFromLabel(label);
    if(!sampleOperation)return operation(fileOps);

    const transaction=await journal.begin({
      operation:sampleOperation,label,detail:{coordinator:'filesystem.withFileTransaction'}
    });
    let precheckComplete=false;
    const ensurePrecheckComplete=async()=>{
      if(precheckComplete)return;
      await journal.completePhase(transaction.id,'PRECHECK',{label});
      precheckComplete=true;
    };
    const journaledOps=createJournaledSampleFileOps({
      fileOps,journal,transactionId:transaction.id,ensurePrecheckComplete
    });

    try{
      const result=await operation(journaledOps);
      await ensurePrecheckComplete();
      await journal.succeed(transaction.id,{label});
      return result;
    }catch(error){
      if(!precheckComplete){
        try{await journal.failPhase(transaction.id,'PRECHECK',error,{label});}catch{}
      }
      try{await journal.fail(transaction.id,error,{label});}catch{}
      throw error;
    }
  };

  const verifyTransaction=async(id,fileOps)=>{
    const transaction=await recoveryStore.getTransaction(id);
    if(!transaction)throw new Error('Sample recovery transaction was not found: '+String(id||''));
    if(String(transaction.status||transaction.transactionStatus)!=='requires-recovery')
      throw new Error('Only sample transactions requiring recovery can be verified.');
    const report=await verifySampleRecoveryTransactionState(transaction,{
      fileOps,device:getConnectedDeviceInfo()
    });
    const recoveryDetail={
      ...(transaction.recoveryDetail&&typeof transaction.recoveryDetail==='object'?transaction.recoveryDetail:{}),
      requiresRecovery:true,verification:report
    };
    return recoveryStore.updateTransaction(transaction.id,{recoveryDetail});
  };

  const acknowledgeTransaction=async(id,fileOps)=>{
    const transaction=await recoveryStore.getTransaction(id);
    if(!transaction)throw new Error('Sample recovery transaction was not found: '+String(id||''));
    if(String(transaction.status||transaction.transactionStatus)!=='requires-recovery')
      throw new Error('Only sample transactions requiring recovery can be acknowledged.');
    assertSampleRecoveryDevice(transaction,getConnectedDeviceInfo());
    const verified=await verifySampleRecoveryTransactionState(transaction,{
      fileOps,device:getConnectedDeviceInfo()
    });
    if(verified.classification==='unverifiable'||verified.classification==='move-state-unverifiable')
      throw new Error('Sample recovery state is not specific enough to acknowledge safely.');
    const current=await recoveryStore.getTransaction(id);
    const acknowledgedAt=new Date().toISOString();
    return recoveryStore.updateTransaction(id,{
      status:'acknowledged',transactionStatus:'acknowledged',
      recoveryDetail:{
        ...(current?.recoveryDetail&&typeof current.recoveryDetail==='object'?current.recoveryDetail:{}),
        requiresRecovery:false,verification:verified,acknowledgedAt,
        acknowledgment:'Current authoritative device state was reviewed; recovery did not mutate the device.'
      }
    });
  };

  return Object.freeze({
    persistent:journal.persistent,run,
    getTransaction:id=>journal.getTransaction(id),
    listTransactions:()=>journal.listTransactions(),
    deleteTransaction:id=>journal.deleteTransaction(id),
    verifyTransaction,acknowledgeTransaction
  });
}
