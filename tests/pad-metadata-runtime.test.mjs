import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '../js/ep133/padMetadataRuntime.js';
import {deviceRuntime} from '../js/ep133/deviceRuntime.js';
import {createDeviceOperationCoordinator} from '../js/ep133/deviceOperationCoordinator.js';
import {publishPadRecoveryEvent,syncDeviceRuntimeRecovery} from '../js/ep133/deviceRecoveryRuntimeBridge.js';
import {readPadTarget} from '../js/ep133/padMetadata.js';

// Synthetic leased FILE tree and durable dependency, never hardware evidence.
const target={project:'01',group:'A',pad:'01',sampleSlot:7,projectFid:2101,groupFid:4001,padFid:6107};
const metadata=()=>({sym:7,'sound.playmode':'oneshot','sample.start':4,'sample.end':300,
  'envelope.attack':5,'envelope.release':90,'sound.pitch':0,'sound.amplitude':72,
  'sound.pan':-3,'sound.mutegroup':2,'time.mode':'off','midi.channel':4});
function harness({records=new Map(),persistent=true,availability=()=>({read:true,write:true}),coordinator=null,publish=null}={}){
  let current=metadata(),token='PRIVATE-SESSION-TOKEN',device={sku:'TE032AS001',metadata:{serial:'PRIVATE-SERIAL',os_version:'2.5.1'}};
  const actions=[],events=[];
  const nodes=[{nodeId:1800,parentId:0,fileName:'projects',flags:6},
    {nodeId:2101,parentId:1800,fileName:'01',flags:6},
    {nodeId:3900,parentId:2101,fileName:'groups',flags:6},
    {nodeId:4001,parentId:3900,fileName:'A',flags:6},
    {nodeId:6107,parentId:4001,fileName:'01',flags:13}];
  const fileOps={
    async listDirectory(fid,path){return nodes.filter(n=>n.parentId===fid).map(n=>({nodeId:n.nodeId,fileName:(path==='/'?'':path)+'/'+n.fileName,fileType:n.flags&1?'file':'folder'}));},
    async getFileInfo(fid){return structuredClone(nodes.find(n=>n.nodeId===fid));},
    async getFileMetadata(fid){actions.push(['GET',fid]);return structuredClone(current);},
    async setFileMetadata(fid,value){actions.push(['SET',fid]);current=structuredClone(value);}
  };
  const store={persistent,
    async save(record){actions.push(['SAVE',record.phase]);records.set(record.id,structuredClone(record));return structuredClone(record);},
    async update(id,patch){actions.push(['UPDATE',patch.phase,patch.status]);const r={...records.get(id),...structuredClone(patch)};records.set(id,r);return structuredClone(r);},
    async get(id){return structuredClone(records.get(id)||null);},
    async list(){return structuredClone([...records.values()]);}
  };
  const dependencies={withFileTransaction:async(label,operation,options)=>{
    actions.push(['LEASE',options.strict,options.recoveryRead===true]);return coordinator?coordinator.run(label,()=>operation(fileOps),{mode:options.strict?'mutation':options.recoveryRead?'recovery-read':'read'}):operation(fileOps);
  },getConnectedDeviceInfo:()=>device,getDeviceSessionToken:()=>token,recoveryStore:store,onRecoveryEvent:e=>{events.push(e);publish?.(e);}};
  if(availability)dependencies.getPadMetadataAvailability=availability;
  const runtime=module.createPadMetadataRuntime(dependencies);
  return{runtime,store,records,actions,events,fileOps,nodes,
    snapshot:()=>readPadTarget(fileOps,target),
    apply:async(before)=>runtime.apply({target,before:before||await readPadTarget(fileOps,target),changes:{'sound.pitch':3},sessionToken:token}),
    get current(){return current;},set current(value){current=value;},
    set token(value){token=value;},set device(value){device=value;}};
}
const sets=h=>h.actions.filter(a=>a[0]==='SET');

test('pad runtime persists before SET on wire FID >999 and verifies all fields under one strict lease',async()=>{
  const h=harness(),result=await h.apply();
  assert.equal(result.metadata['sound.pitch'],3);
  assert.equal(result.verification.ok,true);
  assert.deepEqual(sets(h),[['SET',6107]]);
  assert.equal(h.actions.filter(a=>a[0]==='LEASE').length,1);
  assert.equal(h.actions.find(a=>a[0]==='LEASE')[1],true);
  assert.ok(h.actions.findIndex(a=>a[0]==='SAVE')<h.actions.findIndex(a=>a[0]==='SET'));
  const record=await h.store.get(result.recordId);
  assert.equal(record.status,'verified');
  assert.equal(record.before['sample.start'],4);
  assert.equal(JSON.stringify(record).includes('PRIVATE'),false);
});

test('production resolver refuses synthetic pad write authority',async()=>{
  const h=harness({availability:null});
  await assert.rejects(()=>h.apply(),/evidence|hardware|write|permission/i);
  assert.equal(sets(h).length,0);
});

test('missing persistence and durable save failure both refuse before SET',async()=>{
  for(const persistent of [false,true]){
    const h=harness({persistent});
    if(persistent)h.store.save=async()=>{throw new Error('storage failed');};
    await assert.rejects(()=>h.apply(),/persist|storage/i);
    assert.equal(sets(h).length,0);
  }
});

test('stale protected fields, assignment, and relocated FIDs refuse without SET',async()=>{
  for(const change of [h=>h.current['sample.start']++,h=>h.current.sym=8,h=>{h.nodes.at(-1).nodeId=6108;}]){
    const h=harness(),before=await h.snapshot();change(h);
    await assert.rejects(()=>h.apply(before),/stale|snapshot|target|assignment/i);
    assert.equal(sets(h).length,0);
  }
});

test('missing node WRITE capability refuses despite injected semantic write permission',async()=>{
  const h=harness();h.nodes.at(-1).flags=5;
  await assert.rejects(()=>h.apply(),/write|capability/i);
  assert.equal(sets(h).length,0);
});

test('final write-rights INFO must still identify a readable pad file',async()=>{
  for(const flags of [14,9,269]){
    const h=harness(),before=await h.snapshot(),info=h.fileOps.getFileInfo;let padChecks=0;
    h.fileOps.getFileInfo=async fid=>({...await info(fid),...(fid===6107&&++padChecks%2===0?{flags}:{})});
    await assert.rejects(()=>h.apply(before),/write|capability|identity/i);
    assert.equal(sets(h).length,0);
  }
});

test('every prewrite storage suspension rechecks session and authoritative snapshot before dispatch',async()=>{
  for(const point of ['save','update'])for(const drift of ['session','snapshot']){
    const h=harness(),base=h.store[point];let once=true;
    h.store[point]=async(...args)=>{const r=await base(...args);if(once){once=false;if(drift==='session')h.token='REPLACEMENT';else h.current['sound.pan']=8;}return r;};
    await assert.rejects(()=>h.apply(),/session|stale|snapshot/i);
    assert.equal(sets(h).length,0);
  }
});

test('anonymous physical identity fails closed before writing',async()=>{
  const h=harness();h.device={sku:'TE032AS001',metadata:{os_version:'2.5.1'}};
  await assert.rejects(()=>h.apply(),/identity/i);
  assert.equal(sets(h).length,0);
});

test('apply requires an explicitly captured nonempty session token',async()=>{
  const h=harness(),before=await h.snapshot();
  for(const sessionToken of [undefined,null,''])
    await assert.rejects(()=>h.runtime.apply({target,before,changes:{'sound.pitch':3},sessionToken}),/session/i);
  assert.equal(sets(h).length,0);
});

test('recovery from another physical device refuses read acknowledgement and restore',async()=>{
  const h=harness(),result=await h.apply();
  h.device={sku:'TE032AS001',metadata:{serial:'OTHER-DEVICE',os_version:'2.5.1'}};
  for(const operation of [()=>h.runtime.verify(result.recordId),()=>h.runtime.acknowledge(result.recordId),
    ()=>h.runtime.restore(result.recordId,{confirmed:true})])await assert.rejects(operation,/different physical/i);
  assert.equal(sets(h).length,1);
});

test('ACK without device change and unrelated-field reset retain recovery with no retry',async()=>{
  for(const behavior of ['ack-only','reset']){
    const h=harness();h.fileOps.setFileMetadata=async(fid,value)=>{
      h.actions.push(['SET',fid]);if(behavior==='reset')h.current={...value,'sound.pan':0};
    };
    await assert.rejects(()=>h.apply(),/verification|recovery/i);
    assert.equal(sets(h).length,1);
    assert.equal((await h.runtime.listRecords())[0].status,'requires-recovery');
    assert.equal(h.events.at(-1).type,'required');
  }
});

test('ambiguous timeout persists a blocker across runtime restart without automatic SET retry',async()=>{
  const h=harness();h.fileOps.setFileMetadata=async fid=>{h.actions.push(['SET',fid]);throw new Error('timeout PRIVATE-SESSION-TOKEN');};
  await assert.rejects(()=>h.apply(),/recovery/i);
  assert.equal(sets(h).length,1);
  const restarted=harness({records:h.records});
  await assert.rejects(()=>restarted.apply(),/recovery|unresolved/i);
  assert.equal(sets(restarted).length,0);
  assert.equal(JSON.stringify(await h.runtime.listRecords()).includes('PRIVATE'),false);
});

test('failed durable update after dispatch retains the persisted MUTATE blocker',async()=>{
  const h=harness(),update=h.store.update;
  h.store.update=async(id,patch)=>{if(h.actions.some(a=>a[0]==='SET'))throw new Error('storage failed');return update(id,patch);};
  await assert.rejects(()=>h.apply(),/recovery/i);
  const record=(await h.store.list())[0];
  assert.equal(record.phase,'MUTATE');
  assert.equal(record.status,'requires-recovery');
  assert.equal(sets(h).length,1);
  const restarted=harness({records:h.records});
  await assert.rejects(()=>restarted.apply(),/recovery|unresolved/i);
  assert.equal(sets(restarted).length,0);
});

test('verify and acknowledge reread authoritative current state without SET',async()=>{
  const h=harness();h.fileOps.setFileMetadata=async fid=>{h.actions.push(['SET',fid]);throw new Error('timeout');};
  await assert.rejects(()=>h.apply());const record=(await h.store.list())[0];
  const report=await h.runtime.verify(record.id);
  assert.equal(report.classification,'before');
  h.current['sound.pitch']=9;
  const acknowledged=await h.runtime.acknowledge(record.id);
  assert.equal(acknowledged.classification,'diverged');
  assert.equal((await h.store.get(record.id)).status,'acknowledged');
  assert.equal(sets(h).length,1);
  assert.equal(h.events.at(-1).type,'acknowledged');
  assert.ok(h.actions.filter(a=>a[0]==='LEASE').slice(-2).every(a=>a[2]===true));
});

for(const [label,current] of [
  ['incomplete snapshot',()=>({sym:7})],
  ['unknown playmode',()=>({...metadata(),'sound.playmode':'unknown'})],
  ['invalid field type',()=>({...metadata(),'sound.pitch':'3'})],
  ['unsupported field',()=>({...metadata(),unknown:1})]
])for(const operation of ['verify','acknowledge']){
  test(operation+' refuses '+label+' without clearing recovery or publishing verified state',async()=>{
    const h=harness();
    h.fileOps.setFileMetadata=async fid=>{h.actions.push(['SET',fid]);throw new Error('timeout');};
    await assert.rejects(()=>h.apply(),/recovery/i);
    const record=(await h.store.list())[0];
    h.current=current();h.events.length=0;
    await assert.rejects(()=>h.runtime[operation](record.id),/snapshot|complete|enum|finite|unsupported|metadata/i);
    assert.equal((await h.store.get(record.id)).status,'requires-recovery');
    assert.equal(h.events.length,0);
    await assert.rejects(()=>h.apply(),/recovery|unresolved/i);
    assert.equal(sets(h).length,1);
  });
}

test('restore requires acknowledgement and confirmation then journals a new guarded transaction',async()=>{
  const h=harness();const realSet=h.fileOps.setFileMetadata;
  h.fileOps.setFileMetadata=async(fid,value)=>{await realSet(fid,value);throw new Error('timeout');};
  await assert.rejects(()=>h.apply());const original=(await h.store.list())[0];
  await assert.rejects(()=>h.runtime.restore(original.id,{confirmed:true}),/acknowledge|unresolved|recovery/i);
  assert.equal(sets(h).length,1);
  await h.runtime.acknowledge(original.id);
  await assert.rejects(()=>h.runtime.restore(original.id),/confirm/i);
  h.fileOps.setFileMetadata=realSet;
  const restored=await h.runtime.restore(original.id,{confirmed:true});
  assert.equal(restored.metadata['sound.pitch'],0);
  assert.equal((await h.store.get(restored.recordId)).restoresRecordId,original.id);
  assert.equal(sets(h).length,2);
});

test('failed restore establishes its own blocker and refuses further mutation',async()=>{
  const h=harness(),result=await h.apply();
  h.fileOps.setFileMetadata=async fid=>{h.actions.push(['SET',fid]);throw new Error('timeout');};
  await assert.rejects(()=>h.runtime.restore(result.recordId,{confirmed:true}),/recovery/i);
  const failed=(await h.store.list()).find(r=>r.id!==result.recordId);
  assert.equal(failed.status,'requires-recovery');
  await assert.rejects(()=>h.apply(),/recovery|unresolved/i);
  assert.equal(sets(h).length,2);
});

test('restore refuses external protected-field drift rather than overwriting it',async()=>{
  const h=harness(),result=await h.apply();h.current['sound.pan']=11;
  await assert.rejects(()=>h.runtime.restore(result.recordId,{confirmed:true}),/protected|preserv/i);
  assert.equal(sets(h).length,1);
});

test('runtime discovery and read use read leases with current session and firmware guards',async()=>{
  const h=harness();
  assert.equal((await h.runtime.listTargets({project:'01',group:'A',sampleSlot:7})).pads[0].padFid,6107);
  assert.deepEqual((await h.runtime.readTarget(target)).metadata,metadata());
  assert.ok(h.actions.filter(a=>a[0]==='LEASE').every(a=>a[1]===false));
  const denied=harness({availability:()=>({read:false,write:false})});
  await assert.rejects(()=>denied.runtime.readTarget(target),/permission|evidence/i);
});

// Real runtime/coordinator/bridge; only leased FILE and journal dependencies are synthetic.
for(const reconnect of ['different-device','same-device-new-session','same-session','late-error-persistence']){
  test('late pad failure origin: '+reconnect,async()=>{
    const epoch=deviceRuntime.getSnapshot().connection.epoch+1;
    deviceRuntime.dispatch({type:'OWNERSHIP_ACQUIRED'});
    const connect=(connectionEpoch,deviceKey='synthetic-A')=>deviceRuntime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch,
      device:{sku:'TE032AS001',firmware:'2.5.1',deviceKey,identityVerified:true}});
    connect(epoch);deviceRuntime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:epoch});
    const coordinator=createDeviceOperationCoordinator({runtime:deviceRuntime});
    const h=harness({coordinator,publish:publishPadRecoveryEvent});
    let rejectSet,started;const dispatched=new Promise(resolve=>{started=resolve;});
    h.fileOps.setFileMetadata=async fid=>{h.actions.push(['SET',fid]);started();return new Promise((_,reject)=>{rejectSet=reject;});};
    let releasePersistence,persisting;const persistenceStarted=new Promise(resolve=>{persisting=resolve;});
    if(reconnect==='late-error-persistence'){
      const update=h.store.update;h.store.update=async(...args)=>{
        if(sets(h).length&&args[1].status==='requires-recovery'){persisting();await new Promise(resolve=>{releasePersistence=resolve;});}
        return update(...args);
      };
    }
    const pending=assert.rejects(()=>h.apply(),/recovery/i);await dispatched;
    const original=(await h.store.list())[0];
    if(reconnect==='late-error-persistence'){rejectSet(new Error('SET before disconnect'));await persistenceStarted;}
    if(reconnect!=='same-session'){
      deviceRuntime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:epoch+1});
      h.token='new-session';
      if(reconnect==='different-device')h.device={sku:'TE032AS001',metadata:{serial:'OTHER-DEVICE',os_version:'2.5.1'}};
      connect(epoch+2,reconnect==='different-device'?'synthetic-B':'synthetic-A');
      // Preserve the existing generic disconnect blocker; do not claim B is ready.
      deviceRuntime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:epoch+2});
      assert.equal(deviceRuntime.getSnapshot().recovery.transaction.source,'operation');
    }
    if(reconnect==='late-error-persistence')releasePersistence();else rejectSet(new Error('ambiguous synthetic SET'));await pending;
    assert.equal(sets(h).length,1);
    assert.equal((await h.store.get(original.id)).status,'requires-recovery');
    const observed={events:h.events.length,transaction:deviceRuntime.getSnapshot().recovery.transaction};
    if(reconnect==='different-device'){
      const foreign=await syncDeviceRuntimeRecovery({runtime:deviceRuntime,deviceInfo:{sku:'TE032AS001',metadata:{serial:'OTHER-DEVICE',os_version:'2.5.1'}},listSampleTransactions:async()=>[],listProjectCheckpoints:async()=>[],listPadTransactions:()=>h.store.list()});
      assert.equal(foreign.count,0);observed.foreignTransaction=deviceRuntime.getSnapshot().recovery.transaction;
      await assert.rejects(()=>h.runtime.acknowledge(original.id),/different physical device/i);
    }
    // Original device reconnect hydration still finds its durable pad record.
    const returnEpoch=deviceRuntime.captureEpoch()+1;
    deviceRuntime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:returnEpoch});
    h.token='origin-return-session';h.device={sku:'TE032AS001',metadata:{serial:'PRIVATE-SERIAL',os_version:'2.5.1'}};
    connect(returnEpoch+1);
    const result=await syncDeviceRuntimeRecovery({runtime:deviceRuntime,
      deviceInfo:{sku:'TE032AS001',metadata:{serial:'PRIVATE-SERIAL',os_version:'2.5.1'}},
      listSampleTransactions:async()=>[],listProjectCheckpoints:async()=>[],listPadTransactions:()=>h.store.list()});
    assert.equal(result.count,1);assert.equal(result.blocker.id,original.id);
    assert.equal(sets(h).length,1);
    // Resolve this test's actual record through real verification/acknowledgement.
    await h.runtime.acknowledge(original.id);
    deviceRuntime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:deviceRuntime.captureEpoch()});
    if(reconnect==='same-session'){
      assert.equal(observed.transaction.id,original.id);assert.equal(observed.transaction.source,'pad');
    }else{
      assert.equal(observed.events,0,'old session must not publish under the new connection');
      assert.equal(observed.transaction.source,'operation');
      if(reconnect==='different-device')assert.equal(observed.foreignTransaction.source,'operation');
    }
  });
}
