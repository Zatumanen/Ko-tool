import test from 'node:test';
import assert from 'node:assert/strict';
import{createFileScheduler}from '../js/ep133/fileScheduler.js';
import{getPadReadAvailability,createPadMetadataReader}from '../js/ep133/padMetadataReadOnly.js';

// Injected synthetic leases exercise identity guards independently of production evidence.
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const harness=({sku='TE032AS001',production=false,deviceInfo=null}={})=>{
  let session='one',permission=true,current=true,beforeRead=null,beforeLease=null,infoOverride=null;
  let device=deviceInfo||{sku,metadata:{os_version:'2.5.1',serial:'synthetic-device'}};
  const scheduler=createFileScheduler(),traffic=[];
  const nodes=[{nodeId:1800,parentId:0,fileName:'projects',flags:6},
    {nodeId:2101,parentId:1800,fileName:'01',flags:6},
    {nodeId:3900,parentId:2101,fileName:'groups',flags:6},
    {nodeId:4001,parentId:3900,fileName:'A',flags:6},
    {nodeId:6107,parentId:4001,fileName:'01',flags:5},
    {nodeId:6209,parentId:4001,fileName:'02',flags:5}];
  const metadata=new Map([[6107,{sym:7,'sound.pitch':-2.25,'sound.playmode':'key','time.mode':'bpm',unknown:'retained'}],
    [6209,{sym:'7','sound.pitch':4,'sound.playmode':'oneshot','time.mode':'off'}]]);
  const ops={
    async listDirectory(fid,path){traffic.push(['LIST',fid]);return nodes.filter(n=>n.parentId===fid).map(n=>({nodeId:n.nodeId,fileName:(path==='/'?'':path)+'/'+n.fileName,fileType:(n.flags&3)===2?'folder':'file'}));},
    async getFileInfo(fid){traffic.push(['INFO',fid]);const info=structuredClone(nodes.find(n=>n.nodeId===fid));return infoOverride?infoOverride(info):info;},
    async getFileMetadata(fid){traffic.push(['GET',fid,session]);const result=structuredClone(metadata.get(fid));
      if(beforeRead){const gate=beforeRead;beforeRead=null;gate.entered.resolve();await gate.release.promise;}return result;},
    setFileMetadata(){traffic.push(['SET']);throw Error('Forbidden mutation');},
    putFile(){traffic.push(['PUT']);throw Error('Forbidden mutation');},
    deleteFile(){traffic.push(['DELETE']);throw Error('Forbidden mutation');},
    startPlayback(){traffic.push(['PLAY']);throw Error('Forbidden playback');}
  };
  const reader=createPadMetadataReader({
    withFileTransaction:(label,operation,options)=>scheduler.run(label,async()=>{
      assert.equal(options.strict,false);
      if(beforeLease){const gate=beforeLease;beforeLease=null;gate.entered.resolve();await gate.release.promise;}
      return operation(ops);
    }),getConnectedDeviceInfo:()=>device,captureSession:()=>session,
    assertSession:token=>{if(!current||session!==token)throw Error('Device session changed.');},
    ...(production?{}:{getAvailability:()=>({read:permission,reason:'Synthetic READ denied'})})
  });
  const target={project:'01',group:'A',pad:'01',sampleSlot:7,projectFid:2101,groupFid:4001,padFid:6107};
  const options={sessionToken:session,isCurrent:()=>current};
  return{reader,target,options,nodes,metadata,traffic,scheduler,
    changeSession:()=>{session='two';},revoke:()=>{permission=false;},cancel:()=>{current=false;},
    setOs:os=>{device.metadata.os_version=os;},
    replaceDevice:()=>{device={...device,metadata:{...device.metadata,serial:'replacement'}};},
    overrideInfo:fn=>{infoOverride=fn;},
    deferRead:()=>{const gate={entered:deferred(),release:deferred()};beforeRead=gate;return gate;},
    deferLease:()=>{const gate={entered:deferred(),release:deferred()};beforeLease=gate;return gate;}
  };
};
const noMutations=h=>assert.deepEqual(h.traffic.filter(([type])=>!['LIST','INFO','GET'].includes(type)),[]);

for(const sku of ['TE032AS001','TE032AS006']){
  test(sku+': synthetic READ discovers two assignments via authoritative LIST/INFO and exact GET FID',async()=>{
    const h=harness({sku});const result=await h.reader.listTargets({sampleSlot:7,project:'01',group:'A'},h.options);
    assert.deepEqual(result.pads.map(p=>p.padFid),[6107,6209]);
    assert.deepEqual(result.pads.map(p=>p.pad),['01','02']);
    const snapshot=await h.reader.readTarget(h.target,h.options);
    assert.deepEqual(snapshot.target,h.target);assert.equal(snapshot.metadata['sound.pitch'],-2.25);
    assert.equal(snapshot.metadata.unknown,'retained');assert.equal(snapshot.assignment.status,'VERIFIED');
    assert.ok(h.traffic.some(a=>a[0]==='INFO'&&a[1]===6107));noMutations(h);
    assert.deepEqual(Object.keys(h.reader).sort(),['listTargets','readTarget']);
  });
  if(sku!=='TE032AS001')test(sku+': production has no pad READ evidence and dispatches nothing',async()=>{
    const h=harness({sku,production:true});
    await assert.rejects(()=>h.reader.listTargets({sampleSlot:7},h.options),/READ|evidence|permission/i);
    assert.deepEqual(h.traffic,[]);
  });
}

test('existing sample/project rights and FILE flags never supply absent pad READ permission',()=>{
  for(const sku of ['TE032AS001','TE032AS006','TE032AS005','UNKNOWN'])
    for(const firmware of ['2.5.1','2.5.2','','junk','0.0.1']){
      const p=getPadReadAvailability({sku,firmware,fileCapabilities:255});
      assert.equal(p.read,false);assert.equal(p.write,false);assert.ok(p.reason);
    }
});

for(const sym of [0,'0',undefined,'sample7',null,[],true,1000])
test('unverified assignment '+JSON.stringify(sym)+' is never replaced with the source sample',async()=>{
  const h=harness();const meta=h.metadata.get(6107);if(sym===undefined)delete meta.sym;else meta.sym=sym;
  const list=await h.reader.listTargets({sampleSlot:7,project:'01',group:'A'},h.options);
  assert.deepEqual(list.pads.map(p=>p.pad),['02']);assert.equal(list.unverifiedPads.length,1);
  const result=await h.reader.readTarget(h.target,h.options);
  assert.equal(result.assignment.status,'UNVERIFIED');assert.equal(result.assignment.sampleSlot,null);noMutations(h);
});

test('assignment changed to a different known sample refuses the selected target',async()=>{
  const h=harness();h.metadata.get(6107).sym=8;
  await assert.rejects(()=>h.reader.readTarget(h.target,h.options),/assignment/i);noMutations(h);
});

for(const [field,value]of [['project','../01'],['group','E'],['pad','13'],['sampleSlot',0],['padFid',6209],['projectFid',2102],['groupFid',4002]])
test('invalid or changed target '+field+' fails closed',async()=>{
  const h=harness();await assert.rejects(()=>h.reader.readTarget({...h.target,[field]:value},h.options));noMutations(h);
});

test('ambiguous LIST identity and missing INFO READ are refused',async()=>{
  for(const change of [h=>h.nodes.push({...h.nodes.at(-1),fileName:'01'}),h=>h.nodes.at(-1).nodeId=6107,
    h=>h.nodes.at(-1).flags=1]){
    const h=harness();change(h);await assert.rejects(()=>h.reader.listTargets({sampleSlot:7,project:'01',group:'A'},h.options));noMutations(h);
  }
});

for(const [field,value]of [['parentId',4002],['nodeId',9999],['fileName','02']])
test('pad INFO '+field+' mismatch with LIST prevents metadata GET',async()=>{
  const h=harness();h.overrideInfo(info=>info.nodeId===6107?{...info,[field]:value}:info);
  await assert.rejects(()=>h.reader.readTarget(h.target,h.options),/INFO.*match/i);
  assert.equal(h.traffic.some(([type,fid])=>type==='GET'&&fid===6107),false);noMutations(h);
});

test('partial snapshots retain only real values and unknown fields, without fabricated defaults',async()=>{
  const h=harness();h.metadata.set(6107,{sym:7,'sound.pitch':null,extra:{a:'unknown'}});
  const result=await h.reader.readTarget(h.target,h.options);
  assert.deepEqual(result.metadata,{sym:7,'sound.pitch':null,extra:{a:'unknown'}});noMutations(h);
});

for(const malformed of [null,[],false,'bad'])test('malformed metadata '+JSON.stringify(malformed)+' refuses',async()=>{
  const h=harness();h.metadata.set(6107,malformed);
  await assert.rejects(()=>h.reader.readTarget(h.target,h.options),/metadata/i);noMutations(h);
});

for(const transition of ['changeSession','replaceDevice','revoke','cancel'])
test(transition+' while queued prevents all FILE traffic',async()=>{
  const h=harness(),gate=h.deferLease();const read=h.reader.readTarget(h.target,h.options);
  await gate.entered.promise;h[transition]();gate.release.resolve();await assert.rejects(()=>read);assert.deepEqual(h.traffic,[]);
});

for(const transition of ['changeSession','replaceDevice','revoke','cancel'])
test(transition+' during GET discards the late result and sends no further reads',async()=>{
  const h=harness(),gate=h.deferRead();const read=h.reader.readTarget(h.target,h.options);
  await gate.entered.promise;const count=h.traffic.length;h[transition]();gate.release.resolve();await assert.rejects(()=>read);
  assert.equal(h.traffic.length,count);noMutations(h);
});

// Exercise the production gate, not the injected synthetic permission above.
test('production EP-133 metadata OS 2.5.1 authorizes only READ',async()=>{
  const device={sku:'TE032AS001',metadata:{os_version:'2.5.1'}};
  const permission=getPadReadAvailability(device);
  assert.equal(permission.read,true);assert.equal(permission.write,false);
  assert.equal(permission.evidence.firmwareMatch,true);
  const h=harness({production:true,deviceInfo:device});
  const snapshot=await h.reader.readTarget(h.target,h.options);
  assert.equal(snapshot.metadata['sound.pitch'],-2.25);noMutations(h);
});
for(const device of [
  ...['2.5.2','2.0.5','','unknown','2.5.1 '].map(os=>({sku:'TE032AS001',metadata:{os_version:os}})),
  {sku:'TE032AS001',firmware:'2.5.1'},
  {sku:'TE032AS001',metadata:{sw_version:'2.5.1'},firmware:'2.5.1'},
  ...['TE032AS006','TE032AS005','UNKNOWN'].map(sku=>({sku,metadata:{os_version:'2.5.1'}}))
])test('production fails before FILE for '+JSON.stringify(device),async()=>{
  const permission=getPadReadAvailability(device);
  assert.equal(permission.read,false);assert.equal(permission.write,false);assert.ok(permission.reason);
  const h=harness({production:true,deviceInfo:device});
  await assert.rejects(()=>h.reader.listTargets({sampleSlot:7},h.options),/READ|firmware|OS|unsupported/i);
  await assert.rejects(()=>h.reader.readTarget(h.target,h.options),/READ|firmware|OS|unsupported/i);
  assert.deepEqual(h.traffic,[]);
});

test('production queued READ cannot cross a reconnect',async()=>{
  const h=harness({production:true}),gate=h.deferLease();
  const pending=h.reader.readTarget(h.target,h.options);
  await gate.entered.promise;h.changeSession();gate.release.resolve();
  await assert.rejects(pending,/session/i);assert.deepEqual(h.traffic,[]);
});
test('production late GET is rejected after firmware metadata changes',async()=>{
  const h=harness({production:true}),gate=h.deferRead();
  const pending=h.reader.readTarget(h.target,h.options);
  await gate.entered.promise;h.setOs('2.5.2');gate.release.resolve();
  await assert.rejects(pending,/identity|READ/i);noMutations(h);
});
