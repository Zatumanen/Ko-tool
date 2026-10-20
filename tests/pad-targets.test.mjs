import test from 'node:test';
import assert from 'node:assert/strict';
import * as service from '../js/ep133/padMetadata.js';

// Synthetic FILE tree: deliberately unrelated FIDs; no physical evidence.
const selection={project:'07',group:'B',pad:'09',sampleSlot:27};
const target={...selection,projectFid:612,groupFid:914,padFid:317};
const snapshot=()=>({sym:27,'sound.pitch':-2,'sound.playmode':1,'time.mode':0,extra:'raw'});
function device(){
  const nodes=new Map([
    [89,{parentId:0,fileName:'projects',flags:6}],
    [612,{parentId:89,fileName:'07',flags:6}],
    [48,{parentId:612,fileName:'groups',flags:6}],
    [914,{parentId:48,fileName:'B',flags:6}],
    [317,{parentId:914,fileName:'09',flags:5}],
    [42,{parentId:914,fileName:'02',flags:13}]
  ].map(([nodeId,node])=>[nodeId,{nodeId,...node}]));
  const metadata=new Map([[317,snapshot()],[42,{...snapshot(),sym:'027','sound.pitch':5}]]);
  const calls=[];
  let connected=true;
  const active=()=>{if(!connected)throw new Error('Disconnected FILE session.');};
  const fileOps={
    async listDirectory(parentId,path){
      active();calls.push(['LIST',parentId,path]);
      return[...nodes.values()].filter(node=>node.parentId===parentId).map(node=>({
        nodeId:node.nodeId,fileName:(path==='/'?'':path)+'/'+node.fileName,
        fileType:node.flags&1?'file':'folder',flags:node.flags,isReadable:!!(node.flags&4)
      }));
    },
    async getFileInfo(fid){active();calls.push(['INFO',fid]);return{...nodes.get(fid)};},
    async getFileMetadata(fid){active();calls.push(['META',fid]);return structuredClone(metadata.get(fid));}
  };
  return{nodes,metadata,calls,fileOps,disconnect:()=>{connected=false;}};
}

test('lists selectors and both pads reusing a sample using discovered FIDs',async()=>{
  const d=device();
  const result=await service.listPadTargets(d.fileOps,selection);
  assert.deepEqual(result,{
    projects:[{project:'07',projectFid:612}],
    groups:[{project:'07',group:'B',projectFid:612,groupFid:914}],
    pads:[target,{...target,pad:'02',padFid:42}]
  });
  assert.deepEqual(d.calls.filter(call=>call[0]==='LIST'),[
    ['LIST',0,'/'],['LIST',89,'/projects'],['LIST',612,'/projects/07'],
    ['LIST',48,'/projects/07/groups'],['LIST',914,'/projects/07/groups/B']
  ]);
});

test('selection advances one level at a time without implicit project or group',async()=>{
  const d=device();
  assert.deepEqual(await service.listPadTargets(d.fileOps,{sampleSlot:27}),{
    projects:[{project:'07',projectFid:612}],groups:[],pads:[]
  });
  const result=await service.listPadTargets(d.fileOps,{project:'07',sampleSlot:27});
  assert.equal(result.groups[0].group,'B');
  assert.deepEqual(result.pads,[]);
});

test('read preserves authoritative raw encodings and fingerprints every value',async()=>{
  const d=device();
  const first=await service.readPadTarget(d.fileOps,selection);
  assert.deepEqual(first.target,target);
  assert.deepEqual(first.metadata,snapshot());
  assert.equal(typeof first.fingerprint,'string');
  assert.ok(first.fingerprint.length>0);
  d.metadata.set(317,Object.fromEntries(Object.entries(snapshot()).reverse()));
  assert.equal((await service.readPadTarget(d.fileOps,selection)).fingerprint,first.fingerprint);
  d.metadata.get(317)['sound.pitch']=4;
  assert.notEqual((await service.readPadTarget(d.fileOps,selection)).fingerprint,first.fingerprint);
  assert.equal(d.calls.filter(call=>call[0]==='META'&&call[1]===42).length,0);
});

test('read fails when assignment changed and discovery does not offer the wrong sample',async()=>{
  const d=device();d.metadata.get(317).sym=28;
  await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/assignment|sample/i);
  assert.deepEqual((await service.listPadTargets(d.fileOps,selection)).pads.map(p=>p.pad),['02']);
});

test('sym zero and absent or ambiguous assignment refuse targeted reads',async()=>{
  for(const sym of [0,'0',undefined,null,'27 28',27.5,{},'']){
    const d=device();d.metadata.get(317).sym=sym;
    await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/assignment|sym|sample/i);
  }
  const d=device();d.metadata.get(317).sym=0;
  const listing=await service.listPadTargets(d.fileOps,selection);
  assert.deepEqual(listing.pads.map(p=>p.pad),['02']);
  assert.equal(listing.unverifiedPadCount,1,'sym:0 must be reported as ambiguous without inferring TAR assignments');
});

test('missing nodes or incomplete selectors refuse without fallback',async()=>{
  for(const fid of [89,612,48,914,317]){
    const d=device();d.nodes.delete(fid);
    await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/missing|available|found/i);
  }
  for(const key of ['project','group','pad','sampleSlot']){
    const incomplete={...selection};delete incomplete[key];
    await assert.rejects(()=>service.readPadTarget(device().fileOps,incomplete),/selector|sample|project|group|pad/i);
  }
});

test('INFO read rights control reads; absence of WRITE alone permits read-only snapshots',async()=>{
  const d=device();assert.deepEqual((await service.readPadTarget(d.fileOps,selection)).metadata,snapshot());
  for(const fid of [89,612,48,914,317]){
    const denied=device();const info=denied.fileOps.getFileInfo;
    denied.fileOps.getFileInfo=async id=>({...await info(id),...(id===fid?{flags:denied.nodes.get(id).flags&~4}:{})});
    await assert.rejects(()=>service.readPadTarget(denied.fileOps,selection),/read|capabilit/i);
    assert.equal(denied.calls.some(call=>call[0]==='META'),false);
  }
});

test('INFO identity parent name and node type must agree with the listed chain',async()=>{
  for(const patch of [{parentId:1},{fileName:'other'},{nodeId:777},{flags:6}]){
    const d=device();const info=d.fileOps.getFileInfo;
    d.fileOps.getFileInfo=async fid=>({...await info(fid),...(fid===317?patch:{})});
    await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/identity|parent|name|type|chain/i);
  }
});

test('duplicate names/FIDs and escaping child paths refuse ambiguous trees',async()=>{
  for(const patch of [{fileName:'/projects/07/groups/B/09',nodeId:322},
    {fileName:'/projects/07/groups/B/03',nodeId:317},
    {fileName:'/projects/07/groups/B/../09',nodeId:322}]){
    const d=device();const list=d.fileOps.listDirectory;
    d.fileOps.listDirectory=async(fid,path)=>{
      const entries=await list(fid,path);
      return fid===914?[...entries,{...entries[0],...patch}]:entries;
    };
    await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/ambiguous|duplicate|child|path|identity/i);
  }
});

test('directory traversal is bounded before reading oversized tree metadata',async()=>{
  const d=device();const list=d.fileOps.listDirectory;
  d.fileOps.listDirectory=async(fid,path)=>fid===914
    ?Array.from({length:1025},(_,i)=>({nodeId:i+1000,fileName:path+'/'+i,fileType:'file',flags:5}))
    :list(fid,path);
  await assert.rejects(()=>service.listPadTargets(d.fileOps,selection),/limit|bound/i);
  assert.equal(d.calls.some(call=>call[0]==='META'),false);
});

test('disconnected bound lease rejects discovery and reads without cached fallback',async()=>{
  const d=device();await service.readPadTarget(d.fileOps,selection);d.disconnect();
  await assert.rejects(()=>service.readPadTarget(d.fileOps,selection),/disconnected/i);
  await assert.rejects(()=>service.listPadTargets(d.fileOps,selection),/disconnected/i);
  const interrupted=device();const read=interrupted.fileOps.getFileMetadata;
  interrupted.fileOps.getFileMetadata=async fid=>{interrupted.disconnect();return read(fid);};
  await assert.rejects(()=>service.readPadTarget(interrupted.fileOps,selection),/disconnected/i);
});

test('incremental LIST callback stops oversized streams before collection completes',async()=>{
  const d=device();const list=d.fileOps.listDirectory;
  let delivered=0;
  d.fileOps.listDirectory=async(fid,path,onPage,onEntry)=>{
    if(fid!==914)return list(fid,path);
    for(let i=0;i<5000;i++){
      delivered++;
      onEntry({nodeId:i+1000,fileName:path+'/'+i,fileType:'file',flags:5});
    }
    assert.fail('Oversized streaming listing must be interrupted.');
  };
  await assert.rejects(()=>service.listPadTargets(d.fileOps,selection),/limit/i);
  assert.equal(delivered,1025);
});

test('raw partial snapshots remain readable and are detached from transport data',async()=>{
  const d=device();const raw={sym:'027',nested:{values:[1,2]}};
  d.fileOps.getFileMetadata=async()=>raw;
  const read=await service.readPadTarget(d.fileOps,selection);
  assert.deepEqual(read.metadata,raw);
  read.metadata.nested.values.push(3);
  assert.deepEqual(raw.nested.values,[1,2]);
});

test('fresh resolution exposes relocated nodes and changes identity fingerprint',async()=>{
  const d=device();const before=await service.readPadTarget(d.fileOps,selection);
  const moved={...d.nodes.get(317),nodeId:318};
  d.nodes.delete(317);d.nodes.set(318,moved);d.metadata.set(318,snapshot());
  const after=await service.readPadTarget(d.fileOps,before.target);
  assert.equal(after.target.padFid,318);
  assert.notEqual(after.fingerprint,before.fingerprint);
});

test('selectors require literal child names and a numeric library sample slot',async()=>{
  for(const changes of [{project:7},{group:'../B'},{pad:'/09'},{sampleSlot:'27'},{sampleSlot:0},{sampleSlot:1000}])
    await assert.rejects(()=>service.readPadTarget(device().fileOps,{...selection,...changes}),/selector|sample/i);
});
