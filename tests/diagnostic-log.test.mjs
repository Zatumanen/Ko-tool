import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnosticLog,downloadDiagnosticJson} from '../js/ep133/ui/diagnosticLog.js';

const PRIVATE=[
  'EPEXY1C6','/Users/example/Private/music.wav','secret-token-123',
  'c:/Users/user/Desktop/ko2_project.pak','Project 01',
  'MIDI F0 00 20 76 01 F7','PCM SAMPLE BYTES'
];
const malicious={
  code:'EP_FILE_OPERATION_FAILED',category:'transport',
  message:PRIVATE.join(' '),stack:'Error: '+PRIVATE.join('\n'),
  details:{rawSysEx:PRIVATE[5],deviceKey:PRIVATE[0],project:PRIVATE[4]},
  cause:new Error('cause '+PRIVATE[2]),serialNumber:PRIVATE[0]
};
const privateState={
  status:'mutating', connection:{status:'connected',device:{sku:'EP-133',deviceKey:PRIVATE[0],firmware:'2.5.1'}},
  operation:{phase:'mutating',active:{id:PRIVATE[0],label:PRIVATE[1],data:PRIVATE[6]}},
  safety:{status:'safe',reason:PRIVATE[2]},ownership:{status:'owned'},
  recovery:{transaction:{project:PRIVATE[4],metadata:PRIVATE[6]}}
};

test('fixed allowlist includes only minimal categories and states, never secrets',()=>{
  let ms=125;
  const d=createDiagnosticLog({now:()=>ms});
  d.logRuntime(privateState);ms=325;
  d.logError('UPLOAD QUEUE '+PRIVATE[1],malicious);
  const o=d.report();
  assert.equal(o.schema,'ko-tool-myep-diagnostics');
  assert.equal(o.version,1);
  assert.deepEqual(o.entries,[
    {seq:1,elapsedMs:0,type:'runtime',status:'mutating',connection:'connected',operation:'mutating',ownership:'owned',safety:'safe'},
    {seq:2,elapsedMs:200,type:'error',stage:'upload',code:'EP_FILE_OPERATION_FAILED',category:'transport'}
  ]);
  const exported=d.exportJson();
  for(const secret of PRIVATE)assert.equal(exported.includes(secret),false,secret);
  for(const field of ['message','stack','details','cause','deviceKey','serialNumber','label','url'])
    assert.equal(Object.keys(o.entries[1]).includes(field),false,field);
});

test('unrecognized and fake EP_ codes cannot inject arbitrary strings into export',()=>{
  const d=createDiagnosticLog({now:()=>20});
  d.logError(PRIVATE[1],{code:'EP_HACK_ '+PRIVATE[2],category:PRIVATE[3],message:PRIVATE[0]});
  d.logError(PRIVATE[1],{code:'EP_NOT_IN_ALLOWLIST',category:'transport',stack:PRIVATE[4]});
  const report=d.report();
  for(const event of report.entries){
    assert.equal(event.code,'EP_UNKNOWN');
    assert.equal(event.category,'internal');
    assert.equal(event.stage,'unknown');
  }
  for(const secret of PRIVATE)assert.equal(d.exportJson().includes(secret),false);
});

test('real FILE and connection labels map to fixed stages without disclosing label suffixes',()=>{
  const cases=[
    ['AUTO CONNECT','connect'],
    ['EP SESSION LOCK','connect'],
    ['COULD NOT UPLOAD SAMPLE.','upload'],
    ['SAMPLE LIBRARY LAST FILE_LIST PAGE','library'],
    ['COULD NOT READ EP SAMPLE LIBRARY.','library'],
    ['METADATA SLOT '+PRIVATE[0],'library'],
    ['MOVE SAFETY LOCK FAILED','move'],
    ['RESYNC AFTER DELETE ERROR','recovery'],
    ['TRANSFER ROLLBACK SLOT '+PRIVATE[1],'recovery'],
    ['PROJECT EDIT FAILED.','project'],
    ['SEQUENCER WRITE FAILED.','project'],
    ['COULD NOT READ RECOVERY CHECKPOINTS.','recovery'],
    ['FILE EVENT','file'],
    ['UNEXPECTED LABEL '+PRIVATE[2],'unknown']
  ];
  const d=createDiagnosticLog({now:()=>0});
  for(const [label] of cases)d.logError(label,{code:'EP_UNKNOWN',message:PRIVATE.join(' ')});
  assert.deepEqual(d.report().entries.map(e=>e.stage),cases.map(([,stage])=>stage));
  const json=d.exportJson();
  for(const secret of PRIVATE)assert.ok(!json.includes(secret),secret);
});

test('runtime metadata is restricted to exact known enum values with no unknown status strings',()=>{
  const d=createDiagnosticLog({now:()=>1});
  d.logRuntime({status:PRIVATE[0],connection:{status:PRIVATE[1]},operation:{phase:PRIVATE[2]},ownership:{status:PRIVATE[3]},safety:{status:PRIVATE[4]}});
  assert.deepEqual(d.report().entries[0],{
    seq:1,elapsedMs:0,type:'runtime',status:'blocked',connection:'disconnected',operation:'idle',ownership:'none',safety:'unsafe'
  });
  for(const secret of PRIVATE)assert.ok(!d.exportJson().includes(secret));
});

test('unchanged runtime is deduplicated and buffered events are capped',()=>{
  let n=0;const d=createDiagnosticLog({now:()=>n++,maxEvents:3});
  d.logRuntime(privateState);d.logRuntime({...privateState});
  assert.equal(d.report().entries.length,1);
  for(let i=0;i<12;i++)d.logError('FILE EVENT',{code:'EP_REQUEST_TIMEOUT'});
  assert.deepEqual(d.report().entries.map(x=>x.seq),[11,12,13]);
});

test('error with no structured code is kept as unknown even when its message embeds an allowed code',()=>{
  const d=createDiagnosticLog({now:()=>0});
  d.logError('EP FILE SAFETY LOCK',new Error('EP_FILE_SAFETY_LOCK '+PRIVATE[0]));
  assert.deepEqual(d.report().entries[0],{
    seq:1,elapsedMs:0,type:'error',stage:'recovery',code:'EP_UNKNOWN',category:'internal'
  });
});

test('local browser helper uses Blob URL only and revokes it',async()=>{
  const json=createDiagnosticLog({now:()=>0}).exportJson();
  let captured,clicked=0,appended=0,removed=0,revoked,delayed;
  const link={click:()=>{clicked++},remove:()=>{removed++}};
  const documentRef={body:{append:arg=>{assert.equal(arg,link);appended++}},createElement:name=>{
    assert.equal(name,'a');return link;
  }};
  const urlRef={createObjectURL:blob=>{captured=blob;return 'blob:local'},revokeObjectURL:url=>{revoked=url}};
  downloadDiagnosticJson(json,{documentRef,urlRef,setTimeoutFn:cb=>{delayed=cb}});
  assert.equal(clicked,1);assert.equal(appended,1);assert.equal(removed,1);
  assert.equal(link.download,'ko-tool-myep-diagnostics.json');
  assert.equal(link.href,'blob:local');
  assert.equal(captured.type,'application/json;charset=utf-8');
  assert.equal(await captured.text(),json);
  delayed();assert.equal(revoked,'blob:local');
});

test('failed local download never performs a retry and still cleans up URL',()=>{
  let calls=0,revoked=0;
  const link={click:()=>{calls++;throw Error('blocked')},remove:()=>{}};
  assert.throws(()=>downloadDiagnosticJson('{}',{
    documentRef:{body:{append:()=>{}},createElement:()=>link},
    urlRef:{createObjectURL:()=> 'blob:local',revokeObjectURL:()=>{revoked++}},
    setTimeoutFn:cb=>cb()
  }),/blocked/);
  assert.equal(calls,1);assert.equal(revoked,1);
});

const {installMyEpDiagnosticExport}=await import('../js/ep133/ui/diagnosticLog.js');
const fakeDom=()=>{
  const actions=[];
  const button={listeners:new Map(),disabled:false,removeEventListener(k){this.listeners.delete(k)},
    addEventListener(k,fn){this.listeners.set(k,fn)},setAttribute(){} };
  const toolbar={append:el=>{assert.equal(el,button)},remove:()=>actions.push('removed')};
  const tabs={insertAdjacentElement:(position,node)=>{
    assert.equal(position,'afterend');assert.equal(node,toolbar);actions.push('inserted');
  }};
  const documentRef={createElement:tag=>tag==='div'?toolbar:tag==='button'?button:null};
  const panel={querySelector:query=>query==='.ep133-view-tabs'?tabs:null};
  return {documentRef,panel,button,actions};
};

test('diagnostic export cancellation does not create a Blob or trigger download',async()=>{
  const ui=fakeDom();let saves=0,confirms=0;
  const dispose=installMyEpDiagnosticExport({...ui,
    diagnostics:createDiagnosticLog({now:()=>1}),
    confirmAction:async(message,{confirmLabel})=>{confirms++;assert.match(message,/Nothing is uploaded/);assert.equal(confirmLabel,'DOWNLOAD JSON');return false;},
    download:()=>{saves++;}
  });
  await ui.button.listeners.get('click')();
  assert.equal(confirms,1);assert.equal(saves,0);
  assert.equal(ui.button.disabled,false);
  dispose();assert.deepEqual(ui.actions,['inserted','removed']);
});

test('diagnostic export requires consent and refuses duplicate pending actions',async()=>{
  const ui=fakeDom();let approve,saves=0,confirms=0;
  const approved=new Promise(resolve=>approve=resolve);
  installMyEpDiagnosticExport({...ui,
    diagnostics:createDiagnosticLog({now:()=>1}),
    confirmAction:()=>{confirms++;return approved;},
    download:(json)=>{saves++;assert.equal(JSON.parse(json).schema,'ko-tool-myep-diagnostics');}
  });
  const click=ui.button.listeners.get('click');
  const pending=click();await click();assert.equal(confirms,1);
  assert.equal(saves,0);assert.equal(ui.button.disabled,true);
  approve(true);await pending;
  assert.equal(saves,1);assert.equal(ui.button.disabled,false);
});

test('diagnostic export download failure does not retry, reports one error and releases UI',async()=>{
  const ui=fakeDom();let saves=0,reports=0;
  installMyEpDiagnosticExport({...ui,
    diagnostics:createDiagnosticLog({now:()=>0}),confirmAction:async()=>true,
    download:()=>{saves++;throw Error('blocked')},
    onError:(label,error)=>{reports++;assert.equal(label,'COULD NOT EXPORT DIAGNOSTICS.');assert.equal(error.message,'blocked')}
  });
  await ui.button.listeners.get('click')();
  assert.equal(saves,1);assert.equal(reports,1);assert.equal(ui.button.disabled,false);
});
