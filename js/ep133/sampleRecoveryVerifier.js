import{hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';
import{
  collectSampleTransactionEvidence,classifySampleTransactionResidualState
}from './sampleTransactionContract.js?v=20261008-1';

const firmwareOf=device=>String(device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware||'');

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
  return[...collectSampleTransactionEvidence(transaction).affectedSlots];
}

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
  const result=classifySampleTransactionResidualState(transaction,states);
  const instant=now();
  const verifiedAt=(instant instanceof Date?instant:new Date(instant)).toISOString();
  return Object.freeze({
    verifiedAt,deviceIdentityHash:verifiedDevice.identityHash,sku:verifiedDevice.sku,firmware:verifiedDevice.firmware,
    operation:String(transaction.operation||''),recoveryKind:result.recoveryKind,
    classification:result.classification,summary:result.summary,acknowledgeSafe:result.acknowledgeSafe===true,
    affectedSlots:Object.freeze(states),
    moves:Object.freeze((result.moves||[]).map(item=>Object.freeze({...item}))),
    deviceMutated:false
  });
}
