import{hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';

const number=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const firmwareOf=device=>String(device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware||'');
const unique=values=>[...new Set(values.map(number).filter(Boolean))].sort((a,b)=>a-b);
const mutationEvents=transaction=>(transaction?.journal||[]).filter(event=>event?.phase==='MUTATE'&&event?.detail?.action);

export function assertSampleRecoveryDevice(transaction,device){
  if(!device)throw new Error('Connect the EP-series device before verifying sample recovery.');
  const expected=transaction?.device||{};
  const identityHash=hashDeviceIdentity(device);
  const sku=String(device?.sku||'').toUpperCase();
  const firmware=firmwareOf(device);
  if(expected.identityHash&&String(expected.identityHash)!==identityHash)
    throw new Error('Sample recovery belongs to a different EP-series device.');
  if(expected.sku&&String(expected.sku).toUpperCase()!==sku)
    throw new Error('Sample recovery SKU does not match the connected EP-series device.');
  if(expected.firmware&&String(expected.firmware)!==firmware)
    throw new Error('Sample recovery firmware does not match the connected EP-series device.');
  return Object.freeze({identityHash,sku,firmware});
}

export function getSampleRecoveryAffectedSlots(transaction){
  const ids=[];
  for(const slot of transaction?.slots||[]){
    ids.push(slot?.slotId,slot?.sourceId,slot?.targetId,slot?.nodeId);
  }
  for(const slot of transaction?.recoveryDetail?.affectedSlots||[])ids.push(slot);
  for(const event of mutationEvents(transaction)){
    const detail=event.detail||{};
    ids.push(detail.slotId,detail.sourceId,detail.targetId,detail.destinationId,detail.createdId,detail.fileId,detail.oldFileId,detail.newFileId);
  }
  return unique(ids);
}

const movePairs=transaction=>{
  const pairs=new Map();
  for(const event of mutationEvents(transaction)){
    if(event.detail?.action!=='move')continue;
    const sourceId=number(event.detail.sourceId||event.detail.oldFileId);
    const targetId=number(event.detail.targetId||event.detail.newFileId);
    if(!sourceId||!targetId)continue;
    const key=sourceId+'>'+targetId;
    const previous=pairs.get(key)||{sourceId,targetId,expectedCrc:null,attempted:false,completed:false,failed:false};
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
};

const classify=(transaction,states,moves)=>{
  const operation=String(transaction?.operation||'').toLowerCase();
  if(!states.length)return{classification:'unverifiable',summary:'No affected sample slots were recorded.'};
  const present=states.filter(item=>item.present);
  const missing=states.filter(item=>!item.present);
  if(operation==='delete'){
    if(!missing.length)return{classification:'delete-not-visible',summary:'All recorded delete targets are currently present.'};
    if(missing.length===states.length)return{classification:'destructive-state-visible',summary:'All recorded delete targets are currently missing.'};
    return{classification:'partial-delete-state-visible',summary:'Some recorded delete targets are missing and some are present.'};
  }
  if(operation==='upload'||operation==='copy'){
    if(!present.length)return{classification:'rollback-state-visible',summary:'No recorded created sample slot is currently present.'};
    return{classification:'residual-created-state-visible',summary:'One or more recorded created sample slots are currently present.'};
  }
  if(operation==='move'){
    if(!moves.length)return{classification:'move-state-unverifiable',summary:'MOVE source/target pairs were not recorded.'};
    const bySlot=new Map(states.map(item=>[item.slot,item]));
    const pairStates=moves.map(pair=>{
      const source=bySlot.get(pair.sourceId)||{present:false,crc:null};
      const target=bySlot.get(pair.targetId)||{present:false,crc:null};
      const crcExpected=Number.isFinite(Number(pair.expectedCrc));
      const sourceCrcMatch=!crcExpected||Number(source.crc)===Number(pair.expectedCrc);
      const targetCrcMatch=!crcExpected||Number(target.crc)===Number(pair.expectedCrc);
      return{...pair,sourcePresent:!!source.present,targetPresent:!!target.present,sourceCrcMatch,targetCrcMatch};
    });
    const forward=pairStates.every(item=>!item.sourcePresent&&item.targetPresent&&item.targetCrcMatch);
    const rollback=pairStates.every(item=>item.sourcePresent&&!item.targetPresent&&item.sourceCrcMatch);
    if(forward)return{classification:'forward-move-state-visible',summary:'Recorded MOVE effects are visible at their destination slots.',pairStates};
    if(rollback)return{classification:'rollback-state-visible',summary:'Recorded MOVE sources are present and destinations are absent.',pairStates};
    return{classification:'partial-move-state-visible',summary:'MOVE source/target state is mixed or does not match recorded CRC evidence.',pairStates};
  }
  if(operation==='rename'||operation==='property')
    return{classification:'metadata-state-observed',summary:'Affected sample slots were read authoritatively; metadata intent is not stored in the journal.'};
  return{classification:'state-observed',summary:'Affected sample slots were read authoritatively.'};
};

export async function verifySampleRecoveryTransactionState(transaction,{fileOps,device,now=()=>new Date()}={}){
  if(!transaction)throw new Error('Sample recovery transaction was not found.');
  if(typeof fileOps?.listDirectory!=='function'||typeof fileOps?.getFileMetadata!=='function')
    throw new TypeError('Sample recovery verification requires FILE list and metadata reads.');
  const verifiedDevice=assertSampleRecoveryDevice(transaction,device);
  const root=await fileOps.listDirectory(0,'/');
  const sounds=(root||[]).find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
  if(!sounds)throw new Error('EP-series /sounds node is unavailable.');
  const nodes=await fileOps.listDirectory(sounds.nodeId,'/sounds');
  const nodeMap=new Map((nodes||[]).map(item=>[Number(item.nodeId),item]));
  const slotIds=getSampleRecoveryAffectedSlots(transaction);
  const states=[];
  for(const slot of slotIds){
    const node=nodeMap.get(slot)||null;
    let metadata=null,metadataReadable=true;
    if(node){
      try{metadata=await fileOps.getFileMetadata(slot);}catch{metadataReadable=false;}
    }
    const crc=Number(metadata?.crc);
    states.push(Object.freeze({
      slot,present:!!node,size:node?Math.max(0,Number(node.fileSize)||0):0,
      name:node?String(metadata?.name||node.fileName||'').slice(0,200):null,
      crc:Number.isFinite(crc)?crc:null,metadataReadable
    }));
  }
  const moves=movePairs(transaction);
  const result=classify(transaction,states,moves);
  const verifiedAt=(now() instanceof Date?now():new Date(now())).toISOString();
  return Object.freeze({
    verifiedAt,deviceIdentityHash:verifiedDevice.identityHash,sku:verifiedDevice.sku,firmware:verifiedDevice.firmware,
    operation:String(transaction.operation||''),classification:result.classification,summary:result.summary,
    affectedSlots:Object.freeze(states),
    moves:Object.freeze((result.pairStates||moves).map(item=>Object.freeze({...item}))),
    deviceMutated:false
  });
}
