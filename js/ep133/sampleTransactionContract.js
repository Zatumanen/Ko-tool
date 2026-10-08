export const SAMPLE_TRANSACTION_PHASES=Object.freeze(['PRECHECK','MUTATE','RECOVERY','FINALIZE']);
export const SAMPLE_TRANSACTION_EVENT_STATUS=Object.freeze(['started','completed','failed']);
export const SAMPLE_TRANSACTION_OUTCOMES=Object.freeze(['succeeded','failed','rolled-back','requires-recovery','acknowledged']);
export const SAMPLE_RECOVERY_KINDS=Object.freeze(['created-state','move-state','delete-state','metadata-state']);

const CONTRACTS=Object.freeze({
  upload:Object.freeze({operation:'upload',recoveryKind:'created-state'}),
  copy:Object.freeze({operation:'copy',recoveryKind:'created-state'}),
  move:Object.freeze({operation:'move',recoveryKind:'move-state'}),
  delete:Object.freeze({operation:'delete',recoveryKind:'delete-state'}),
  rename:Object.freeze({operation:'rename',recoveryKind:'metadata-state'}),
  property:Object.freeze({operation:'property',recoveryKind:'metadata-state'})
});

const positive=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const unique=values=>[...new Set(values.map(positive).filter(Boolean))].sort((a,b)=>a-b);
const keyPair=(a,b)=>String(Number(a)||0)+'>'+String(Number(b)||0);
const mutationEvents=transaction=>(transaction?.journal||[]).filter(event=>event?.phase==='MUTATE'&&event?.detail?.action);

export function getSampleTransactionContract(operation){
  return CONTRACTS[String(operation||'').trim().toLowerCase()]||null;
}

export function sampleOperationFromLabel(label){
  const text=String(label||'').toLowerCase();
  if(text.includes('upload'))return'upload';
  if(text.includes('copy'))return'copy';
  if(text.includes('move'))return'move';
  if(text.includes('delete'))return'delete';
  if(text.includes('rename'))return'rename';
  if(text.includes('property'))return'property';
  return null;
}

function collectMoves(events){
  const pairs=new Map();
  for(const event of events){
    if(event.detail?.action!=='move')continue;
    const sourceId=positive(event.detail.sourceId||event.detail.oldFileId);
    const targetId=positive(event.detail.targetId||event.detail.newFileId);
    if(!sourceId||!targetId)continue;
    const key=keyPair(sourceId,targetId);
    const previous=pairs.get(key)||{
      key,sourceId,targetId,expectedCrc:null,attempted:false,completed:false,failed:false
    };
    const expected=Number(event.detail.sourceCrc??event.detail.destinationCrc);
    pairs.set(key,{
      ...previous,
      expectedCrc:Number.isFinite(expected)?expected:previous.expectedCrc,
      attempted:true,
      completed:previous.completed||event.status==='completed',
      failed:previous.failed||event.status==='failed'
    });
  }
  return[...pairs.values()];
}

function collectResidualMoves(completed){
  const stack=[];
  for(const event of completed.filter(event=>event.detail?.action==='move')){
    const sourceId=positive(event.detail?.sourceId||event.detail?.oldFileId);
    const targetId=positive(event.detail?.targetId||event.detail?.newFileId);
    if(!sourceId||!targetId)continue;
    const reverseIndex=stack.findLastIndex(item=>item.sourceId===targetId&&item.targetId===sourceId);
    if(reverseIndex>=0)stack.splice(reverseIndex,1);
    else stack.push({sourceId,targetId});
  }
  return stack;
}

export function collectSampleTransactionEvidence(transaction){
  const events=mutationEvents(transaction);
  const started=events.filter(event=>event.status==='started');
  const completed=events.filter(event=>event.status==='completed');
  const failed=events.filter(event=>event.status==='failed');
  const affected=[];
  for(const slot of transaction?.slots||[])affected.push(slot?.slotId,slot?.sourceId,slot?.targetId,slot?.nodeId);
  for(const slot of transaction?.recoveryDetail?.affectedSlots||[])affected.push(slot);
  for(const event of events){
    const detail=event.detail||{};
    affected.push(
      detail.slotId,detail.sourceId,detail.targetId,detail.destinationId,
      detail.createdId,detail.fileId,detail.oldFileId,detail.newFileId
    );
  }

  const created=new Set(),deleted=new Set();
  for(const event of completed){
    if(event.detail?.action==='upload'){
      const id=positive(event.detail?.fileId||event.detail?.createdId||event.detail?.destinationId);
      if(id)created.add(id);
    }
    if(event.detail?.action==='delete'){
      const id=positive(event.detail?.slotId);
      if(id)deleted.add(id);
    }
  }
  for(const event of failed.filter(event=>event.detail?.action==='upload')){
    const id=positive(event.detail?.createdId);
    if(id)created.add(id);
  }

  const contract=getSampleTransactionContract(transaction?.operation);
  return Object.freeze({
    operation:contract?.operation||String(transaction?.operation||'').toLowerCase(),
    recoveryKind:contract?.recoveryKind||null,
    mutationAttempted:events.length>0,
    started:Object.freeze(started),
    completed:Object.freeze(completed),
    failed:Object.freeze(failed),
    affectedSlots:Object.freeze(unique(affected)),
    createdSlots:Object.freeze([...created].sort((a,b)=>a-b)),
    deletedSlots:Object.freeze([...deleted].sort((a,b)=>a-b)),
    moves:Object.freeze(collectMoves(events).map(item=>Object.freeze(item))),
    residualMoves:Object.freeze(collectResidualMoves(completed).map(item=>Object.freeze(item))),
    metadataAttempted:events.some(event=>event.detail?.action==='set-metadata'),
    metadataCompleted:completed.some(event=>event.detail?.action==='set-metadata')
  });
}

export function assessSampleTransactionRecovery(transaction){
  const evidence=collectSampleTransactionEvidence(transaction);
  if(!evidence.mutationAttempted)
    return{status:'failed',outcome:'failed',requiresRecovery:false,recoveryKind:evidence.recoveryKind,reason:'No sample mutation reached the device.'};

  if(evidence.recoveryKind==='delete-state'){
    return{
      status:'requires-recovery',outcome:'requires-recovery',requiresRecovery:true,recoveryKind:evidence.recoveryKind,
      reason:'A delete transaction failed after a destructive FILE mutation was attempted.',
      affectedSlots:evidence.affectedSlots
    };
  }

  if(evidence.recoveryKind==='move-state'){
    if(evidence.failed.some(event=>event.detail?.action==='move')){
      return{
        status:'requires-recovery',outcome:'requires-recovery',requiresRecovery:true,recoveryKind:evidence.recoveryKind,
        reason:'A native MOVE failed after it was attempted.',moves:evidence.moves.map(item=>item.key)
      };
    }
    const completedMove=evidence.completed.some(event=>event.detail?.action==='move');
    if(completedMove&&!evidence.residualMoves.length){
      return{
        status:'rolled-back',outcome:'rolled-back',requiresRecovery:false,recoveryKind:evidence.recoveryKind,
        reason:'Completed MOVE steps were reversed successfully.'
      };
    }
    return{
      status:'requires-recovery',outcome:'requires-recovery',requiresRecovery:true,recoveryKind:evidence.recoveryKind,
      reason:'One or more MOVE effects remain unmatched after transaction failure.',
      moves:evidence.residualMoves.map(item=>keyPair(item.sourceId,item.targetId))
    };
  }

  if(evidence.recoveryKind==='created-state'){
    const created=new Set(evidence.createdSlots),deleted=new Set(evidence.deletedSlots);
    const residual=[...created].filter(id=>!deleted.has(id));
    const failedDelete=evidence.failed.some(event=>event.detail?.action==='delete');
    if(!residual.length&&created.size&&!failedDelete){
      return{
        status:'rolled-back',outcome:'rolled-back',requiresRecovery:false,recoveryKind:evidence.recoveryKind,
        reason:'Created sample slots were removed successfully.',createdSlots:[...created]
      };
    }
    return{
      status:'requires-recovery',outcome:'requires-recovery',requiresRecovery:true,recoveryKind:evidence.recoveryKind,
      reason:residual.length?'Created sample slots may remain after rollback.':'An upload mutation failed before its final state could be proven.',
      affectedSlots:residual.length?residual:evidence.affectedSlots
    };
  }

  if(evidence.recoveryKind==='metadata-state'&&evidence.metadataAttempted){
    return{
      status:'requires-recovery',outcome:'requires-recovery',requiresRecovery:true,recoveryKind:evidence.recoveryKind,
      reason:'Sample metadata may have changed before the transaction failed; authoritative readback is required.',
      affectedSlots:evidence.affectedSlots
    };
  }

  return{
    status:'failed',outcome:'failed',requiresRecovery:false,recoveryKind:evidence.recoveryKind,
    reason:'The sample transaction failed before a confirmed mutation.'
  };
}

export function classifySampleTransactionResidualState(transaction,states){
  const evidence=collectSampleTransactionEvidence(transaction);
  const list=Array.isArray(states)?states:[];
  if(!list.length)return{
    recoveryKind:evidence.recoveryKind,classification:'unverifiable',summary:'No affected sample slots were recorded.',
    acknowledgeSafe:false,moves:evidence.moves
  };
  const present=list.filter(item=>item.present),missing=list.filter(item=>!item.present);

  if(evidence.recoveryKind==='delete-state'){
    if(!missing.length)return{recoveryKind:evidence.recoveryKind,classification:'delete-not-visible',summary:'All recorded delete targets are currently present.',acknowledgeSafe:true,moves:evidence.moves};
    if(missing.length===list.length)return{recoveryKind:evidence.recoveryKind,classification:'destructive-state-visible',summary:'All recorded delete targets are currently missing.',acknowledgeSafe:true,moves:evidence.moves};
    return{recoveryKind:evidence.recoveryKind,classification:'partial-delete-state-visible',summary:'Some recorded delete targets are missing and some are present.',acknowledgeSafe:true,moves:evidence.moves};
  }

  if(evidence.recoveryKind==='created-state'){
    if(!present.length)return{recoveryKind:evidence.recoveryKind,classification:'rollback-state-visible',summary:'No recorded created sample slot is currently present.',acknowledgeSafe:true,moves:evidence.moves};
    return{recoveryKind:evidence.recoveryKind,classification:'residual-created-state-visible',summary:'One or more recorded created sample slots are currently present.',acknowledgeSafe:true,moves:evidence.moves};
  }

  if(evidence.recoveryKind==='move-state'){
    if(!evidence.moves.length)return{recoveryKind:evidence.recoveryKind,classification:'move-state-unverifiable',summary:'MOVE source/target pairs were not recorded.',acknowledgeSafe:false,moves:evidence.moves};
    const bySlot=new Map(list.map(item=>[item.slot,item]));
    const pairStates=evidence.moves.map(pair=>{
      const source=bySlot.get(pair.sourceId)||{present:false,crc:null};
      const target=bySlot.get(pair.targetId)||{present:false,crc:null};
      const crcExpected=Number.isFinite(Number(pair.expectedCrc));
      const sourceCrcMatch=!crcExpected||Number(source.crc)===Number(pair.expectedCrc);
      const targetCrcMatch=!crcExpected||Number(target.crc)===Number(pair.expectedCrc);
      return{...pair,sourcePresent:!!source.present,targetPresent:!!target.present,sourceCrcMatch,targetCrcMatch};
    });
    const forward=pairStates.every(item=>!item.sourcePresent&&item.targetPresent&&item.targetCrcMatch);
    const rollback=pairStates.every(item=>item.sourcePresent&&!item.targetPresent&&item.sourceCrcMatch);
    if(forward)return{recoveryKind:evidence.recoveryKind,classification:'forward-move-state-visible',summary:'Recorded MOVE effects are visible at their destination slots.',acknowledgeSafe:true,moves:pairStates};
    if(rollback)return{recoveryKind:evidence.recoveryKind,classification:'rollback-state-visible',summary:'Recorded MOVE sources are present and destinations are absent.',acknowledgeSafe:true,moves:pairStates};
    return{recoveryKind:evidence.recoveryKind,classification:'partial-move-state-visible',summary:'MOVE source/target state is mixed or does not match recorded CRC evidence.',acknowledgeSafe:true,moves:pairStates};
  }

  if(evidence.recoveryKind==='metadata-state')return{
    recoveryKind:evidence.recoveryKind,classification:'metadata-state-observed',
    summary:'Affected sample slots were read authoritatively; metadata intent is not stored in the journal.',
    acknowledgeSafe:true,moves:evidence.moves
  };

  return{
    recoveryKind:evidence.recoveryKind,classification:'state-observed',summary:'Affected sample slots were read authoritatively.',
    acknowledgeSafe:true,moves:evidence.moves
  };
}

export function isSampleRecoveryVerificationAcknowledgable(report){
  return report?.acknowledgeSafe===true;
}
