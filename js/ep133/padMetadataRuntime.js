import{getPadMetadataAvailability,listPadTargets,readPadTarget,preparePadMetadataPayload,verifyPadMetadata,PAD_METADATA_FIELDS}from './padMetadata.js';
import{hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';
import{isUnresolvedPadRecord}from './padRecovery.js';
import{decodeFileRights}from './deviceCapabilities.js?v=20261001-1';
import{TE_SYSEX_FILE_FILE_TYPE_FILE}from './constants.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const canonical=value=>JSON.stringify(sort(value));
const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;
const TARGET_KEYS=['project','group','pad','projectFid','groupFid','padFid','sampleSlot'];
const sameTarget=(a,b)=>TARGET_KEYS.every(key=>a?.[key]===b?.[key]);
const sameDevice=(a,b)=>a.identityHash===b?.identityHash&&a.sku===b.sku&&a.firmware===b.firmware;
const EDITABLE=new Set(['sound.pitch','sound.playmode','time.mode','envelope.release']);
const identity=device=>{
  if(!device?.sku||!String(device?.metadata?.serialNumber||device?.metadata?.serial||'').trim())
    throw new Error('Pad operation requires a stable physical device identity.');
  return{identityHash:hashDeviceIdentity(device),sku:String(device.sku),
    firmware:String(device.metadata.os_version||device.metadata.sw_version||'')};
};
let sequence=0;
const recordId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++sequence)+'-'+Math.random().toString(36).slice(2);

export function createPadMetadataRuntime({withFileTransaction,getConnectedDeviceInfo,getDeviceSessionToken,
  recoveryStore,onRecoveryEvent,getPadMetadataAvailability:availability=getPadMetadataAvailability}={}){
  for(const dependency of [withFileTransaction,getConnectedDeviceInfo,getDeviceSessionToken,availability])
    if(typeof dependency!=='function')throw new TypeError('Pad runtime requires transaction, device, session and availability services.');
  // Notifications are connection-owned, unlike the durable journal. A late old
  // transaction must never acquire the bridge's current connection epoch.
  const notify=(event,ctx)=>{try{ctx.guard();onRecoveryEvent?.(event);}catch{/* Durable state remains authoritative. */}};
  const context=(token=getDeviceSessionToken())=>{
    if(typeof token!=='string'||!token)throw new Error('Pad operation requires a current device session.');
    const device=identity(getConnectedDeviceInfo());
    const guard=(write=false)=>{
      if(token!==getDeviceSessionToken())throw new Error('Pad device session changed.');
      const connected=getConnectedDeviceInfo();
      if(!sameDevice(device,identity(connected)))throw new Error('Pad physical device identity changed.');
      const permission=availability(connected);
      if(permission?.read!==true||write&&permission.write!==true)
        throw new Error('Pad '+(write?'write':'read')+' permission requires scoped firmware evidence.');
    };
    guard();return{device,guard};
  };
  const assertNoBlocker=async(ctx)=>{
    ctx.guard(true);
    const records=await recoveryStore.list();ctx.guard(true);
    if(records.some(record=>sameDevice(ctx.device,record.device)&&isUnresolvedPadRecord(record)))
      throw new Error('Unresolved pad recovery requires verification and acknowledgement before mutation.');
  };
  const read=async(ops,target,ctx)=>{
    ctx.guard();const result=await readPadTarget(ops,target);ctx.guard();
    if(!sameTarget(result.target,target))throw new Error('Pad target identity changed; select the target again.');
    return result;
  };
  const snapshotCheck=async(ops,target,before,ctx)=>{
    ctx.guard(true);const result=await read(ops,target,ctx);
    if(canonical(result.metadata)!==canonical(before.metadata||before)||
      before.fingerprint!=null&&result.fingerprint!==before.fingerprint||
      before.target!=null&&!sameTarget(result.target,before.target))
      throw new Error('Stale pad snapshot; read the authoritative target again.');
    const info=await ops.getFileInfo(target.padFid);ctx.guard(true);
    if(info?.nodeId!==target.padFid||info.parentId!==target.groupFid||info.fileName!==target.pad||
      !Number.isInteger(info.flags)||info.flags<0||info.flags>255||(info.flags&3)!==TE_SYSEX_FILE_FILE_TYPE_FILE||
      !decodeFileRights(info.flags).read||!decodeFileRights(info.flags).write)
      throw new Error('Pad target WRITE capability and identity are required.');
    return result;
  };
  const mutate=async(ops,{target,before,changes,restoresRecordId},ctx)=>{
    if(recoveryStore?.persistent!==true)throw new Error('Persistent pad recovery storage is required before mutation.');
    await assertNoBlocker(ctx);
    const original=await snapshotCheck(ops,target,before,ctx);
    const desired=preparePadMetadataPayload(original.metadata,changes);
    const id='pad:'+recordId(),createdAt=new Date().toISOString();
    const record={id,device:ctx.device,target:original.target,before:original.metadata,desired,
      status:'pending',phase:'PRECHECK',verification:null,createdAt,updatedAt:createdAt,
      ...(restoresRecordId?{restoresRecordId}:{})};
    let saved=false,dispatched=false;
    try{
      ctx.guard(true);await recoveryStore.save(record);saved=true;ctx.guard(true);
      await snapshotCheck(ops,target,original,ctx);
      // Persist an unresolved marker BEFORE dispatch; even a failed subsequent
      // storage update must leave a restart-visible blocker. No speculative retry.
      ctx.guard(true);await recoveryStore.update(id,{status:'requires-recovery',phase:'MUTATE'});ctx.guard(true);
      await snapshotCheck(ops,target,original,ctx);ctx.guard(true);
      dispatched=true;await ops.setFileMetadata(target.padFid,clone(desired));ctx.guard(true);
      await recoveryStore.update(id,{phase:'VERIFY'});ctx.guard(true);
      const current=await read(ops,target,ctx);
      const verification=verifyPadMetadata(original.metadata,desired,current.metadata);
      if(!verification.ok)throw new Error('Pad readback verification failed.');
      ctx.guard(true);await recoveryStore.update(id,{status:'verified',phase:'VERIFY',verification});ctx.guard(true);
      return{metadata:current.metadata,recordId:id,verification};
    }catch(error){
      if(dispatched){
        try{await recoveryStore.update(id,{status:'requires-recovery'});}catch{/* MUTATE is already durable. */}
        notify({type:'required',transactionId:id,reason:'Pad mutation requires authoritative recovery verification.'},ctx);
        const failure=new Error('Pad mutation requires recovery; no automatic retry was performed.');
        failure.recordId=id;throw failure;
      }
      if(saved){try{await recoveryStore.update(id,{status:'aborted'});}catch{/* No SET was dispatched. */}}
      throw error;
    }
  };
  const getRecord=async(id,ctx)=>{
    const record=await recoveryStore.get(id);ctx.guard();
    if(!record)throw new Error('Pad recovery record was not found.');
    if(!sameDevice(ctx.device,record.device))throw new Error('Pad recovery belongs to a different physical device or firmware.');
    return record;
  };
  const inspect=async(record,ops,ctx)=>{
    const current=await read(ops,record.target,ctx);
    // A divergent state is acknowledgeable only when every field is understood.
    preparePadMetadataPayload(current.metadata,{});
    const verification=verifyPadMetadata(record.before,record.desired,current.metadata);
    return{...verification,classification:verification.ok?'desired':canonical(current.metadata)===canonical(record.before)?'before':'diverged',
      fingerprint:current.fingerprint,metadata:current.metadata,deviceMutated:false,verifiedAt:new Date().toISOString()};
  };
  return Object.freeze({
    async listTargets(options={}){
      const ctx=context(),selectors=clone(options);
      return withFileTransaction('pad target discovery',async ops=>{
        ctx.guard();const result=await listPadTargets(ops,selectors);ctx.guard();return result;
      },{strict:false});
    },
    async readTarget(options={}){
      const ctx=context(),selectors=clone(options);
      return withFileTransaction('pad target read',async ops=>{
        ctx.guard();const result=await readPadTarget(ops,selectors);ctx.guard();return result;
      },{strict:false});
    },
    async apply(args={}){
      // Clone caller-owned objects before queue/persistence suspensions.
      if(typeof args.sessionToken!=='string'||!args.sessionToken)throw new Error('Pad mutation requires an explicitly captured session token.');
      const ctx=context(args.sessionToken),request=clone({target:args.target,before:args.before,changes:args.changes});
      ctx.guard(true);
      return withFileTransaction('pad metadata mutation',ops=>mutate(ops,request,ctx),{strict:true});
    },
    async verify(id){
      const ctx=context();
      return withFileTransaction('pad recovery verification',async ops=>{
        const record=await getRecord(id,ctx),report=await inspect(record,ops,ctx);
        await recoveryStore.update(id,{verification:report});ctx.guard();
        notify({type:'verified',transactionId:record.id,verification:report},ctx);return report;
      },{strict:false,recoveryRead:true});
    },
    async acknowledge(id){
      const ctx=context();
      return withFileTransaction('pad recovery acknowledgement',async ops=>{
        const record=await getRecord(id,ctx),report=await inspect(record,ops,ctx);
        ctx.guard();await recoveryStore.update(id,{status:'acknowledged',verification:report});
        try{ctx.guard();}catch(error){
          try{await recoveryStore.update(id,{status:'requires-recovery'});}catch{/* Keep runtime blocked as well. */}
          notify({type:'required',transactionId:record.id,reason:'Pad acknowledgement was interrupted.'},ctx);throw error;
        }
        notify({type:'acknowledged',transactionId:record.id,verification:report},ctx);return report;
      },{strict:false,recoveryRead:true});
    },
    async restore(id,{confirmed=false}={}){
      if(confirmed!==true)throw new Error('Pad restore requires explicit confirmation.');
      const ctx=context();ctx.guard(true);
      return withFileTransaction('pad recovery restore',async ops=>{
        await assertNoBlocker(ctx);
        const record=await getRecord(id,ctx);
        if(record.status!=='acknowledged')
          throw new Error('Pad restore requires an acknowledged recovery record.');
        const current=await read(ops,record.target,ctx);
        for(const key of PAD_METADATA_FIELDS)
          if(!EDITABLE.has(key)&&!Object.is(current.metadata[key],record.before[key]))
            throw new Error('Pad restore refuses changed protected fields; preserve current authoritative values.');
        const changes=Object.fromEntries([...EDITABLE].map(key=>[key,record.before[key]]));
        return mutate(ops,{target:record.target,before:current,changes,restoresRecordId:record.id},ctx);
      },{strict:true});
    },
    listRecords:()=>recoveryStore.list()
  });
}
