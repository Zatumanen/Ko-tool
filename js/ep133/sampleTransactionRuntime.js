import{createBrowserSampleRecoveryStore}from './sampleRecovery.js?v=20261001-1';
import{
  createSampleTransactionJournal,createJournaledSampleFileOps,sampleOperationFromLabel
}from './sampleTransactionJournal.js?v=20261001-1';

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

  return Object.freeze({
    persistent:journal.persistent,run,
    getTransaction:id=>journal.getTransaction(id),
    listTransactions:()=>journal.listTransactions(),
    deleteTransaction:id=>journal.deleteTransaction(id)
  });
}
