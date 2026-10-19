import test from 'node:test';
import assert from 'node:assert/strict';
import{createPadPropertiesController}from '../js/ep133/ui/padPropertiesController.js';
import{createPadRecoveryController}from '../js/ep133/ui/padRecoveryController.js';
import{TE_SYSEX_FILE_EVENT_METADATA_UPDATED as UPDATED}from '../js/ep133/constants.js';

class Element{
  handlers=new Map();hidden=true;disabled=false;value='';innerHTML='';textContent='';
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);}
  removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);}
  async fire(type,event={}){for(const fn of this.handlers.get(type)||[])await fn({target:this,...event});}
}
const metadata=()=>({sym:7,'sound.pitch':0,'sound.playmode':'oneshot','time.mode':'off','sample.start':0,'sample.end':500,'envelope.attack':0,'envelope.release':42,'sound.amplitude':100,'sound.pan':0,'sound.mutegroup':0,'midi.channel':1});
const target=(pad='01',sampleSlot=7)=>({project:'01',group:'A',pad,projectFid:3001,groupFid:4500,padFid:pad==='01'?6107:6111,sampleSlot});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const build=({write=true,meta=metadata(),applyResult,readResult}={})=>{
  const dom=Object.fromEntries(['padDialog','padClose','padProject','padGroup','padSelect','padAssignment','padSource','padGrid','padApply','padStatus','padReason','padRecoveryList','padRecoveryDetail','padRecoveryVerify','padRecoveryRestore','padRecoveryAcknowledge','padRecoveryRefresh'].map(key=>[key,new Element()]));
  const doc=new Element(),writes=[],errors=[],reads=[];let session='first',timers=[],device={...meta};
  const controller=createPadPropertiesController({dom,documentRef:doc,
    getAvailability:()=>({read:true,write,reason:write?'':'Pad writes lack physical evidence.'}),
    captureSession:()=>session,assertSession:value=>{if(value!==session)throw Error('Session changed');},reportError:(...args)=>errors.push(args),
    readTargets:async options=>({projects:[{project:'01',projectFid:3001}],groups:options.project?[{project:'01',group:'A',groupFid:4500}]:[],pads:options.group?[target('01',options.sampleSlot),target('02',options.sampleSlot)]:[]}),
    readTarget:async selected=>{reads.push(selected);const result={target:{...selected},metadata:{...device,sym:selected.sampleSlot},fingerprint:JSON.stringify(device)};return readResult?readResult(selected,result):result;},
    applyPadMetadata:async args=>{writes.push(structuredClone(args));if(applyResult)return applyResult(args);device={...device,...args.changes};return{metadata:{...device},verification:{ok:true}};},
    setTimeoutFn:fn=>{timers.push(fn);return fn;},clearTimeoutFn:fn=>{timers=timers.filter(item=>item!==fn);}
  });
  const source={'sound.pitch':-5,'sound.playmode':'legato','time.mode':'bpm','envelope.release':99};
  const open=async()=>{await controller.openFromSample({id:7},{confirmedLibraryMetadata:source});};
  const choose=async(pad='01')=>{dom.padProject.value='01';await dom.padProject.fire('change');dom.padGroup.value='A';await dom.padGroup.fire('change');dom.padSelect.value=pad;await dom.padSelect.fire('change');};
  const step=async key=>dom.padGrid.fire('click',{target:{closest:()=>({dataset:{property:key,direction:'1'}})}});
  return{controller,dom,doc,writes,errors,reads,source,open,choose,step,setDevice:value=>{device=value;},changeSession:()=>{session='second';},flush:async()=>{const queue=timers;timers=[];for(const fn of queue)await fn();await tick();}};
};

test('chooser and selecting an assigned target only read; copy source is explicit and detached',async()=>{
  const s=build();await s.open();assert.match(s.dom.padSource.textContent,/-5/);s.source['sound.pitch']=12;await s.choose();assert.deepEqual(s.writes,[]);assert.match(s.dom.padAssignment.textContent,/01.*A.*01.*7/);await s.dom.padApply.fire('click');assert.equal(s.writes.length,1);assert.deepEqual(s.writes[0].changes,{'sound.pitch':-5,'sound.playmode':'legato','time.mode':'bpm','envelope.release':99});assert.equal(s.writes[0].target.padFid,6107);assert.equal(s.writes[0].before.metadata['sound.pan'],0);
});
test('pad-owned editing preserves canonical values pending readback and affects one reused assignment',async()=>{
 const s=build();await s.open();await s.choose();await s.step('sound.pitch');assert.equal(s.writes.length,0);assert.match(s.dom.padGrid.innerHTML,/pending/);await s.flush();assert.equal(s.writes.length,1);assert.deepEqual(s.writes[0].changes,{'sound.pitch':1});assert.equal(s.writes[0].target.padFid,6107);assert.match(s.dom.padStatus.textContent,/SAVED/);
});
for(const action of ['close','reset','dispose'])test(`${action} cancels queued writes and releases all gesture listeners`,async()=>{
 const s=build();await s.open();await s.choose();await s.step('sound.pitch');await s.dom.padGrid.fire('pointerdown',{clientY:100,preventDefault(){},target:{closest:()=>({})}});s.controller[action]();await s.doc.fire('pointerup');await s.flush();assert.equal(s.writes.length,0);assert.equal([...s.doc.handlers.values()].reduce((n,set)=>n+set.size,0),0);
});
test('switching explicit target cancels queued work instead of redirecting it',async()=>{
 const s=build();await s.open();await s.choose();await s.step('sound.pitch');s.dom.padSelect.value='02';await s.dom.padSelect.fire('change');await s.flush();assert.deepEqual(s.writes,[]);
});
test('matching FILE events and hardware selection do not overwrite pending drafts',async()=>{
 const s=build();await s.open();await s.choose();await s.step('sound.pitch');s.setDevice({...metadata(),'sound.pitch':-9});const n=s.reads.length;await s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});await s.controller.handleActivePad({padId:6111,sym:7});assert.equal(s.reads.length,n);assert.match(s.dom.padStatus.textContent,/pending|PENDING/i);await s.flush();assert.equal(s.writes[0].target.padFid,6107);assert.equal(s.writes[0].changes['sound.pitch'],1);
});
test('pitch gesture only sends its final release value; cancel sends nothing',async()=>{
 const s=build();await s.open();await s.choose();const down=()=>s.dom.padGrid.fire('pointerdown',{clientY:100,preventDefault(){},target:{closest:()=>({})}});await down();await s.doc.fire('pointermove',{clientY:91});await s.flush();assert.equal(s.writes.length,0);await s.doc.fire('pointerup');await s.flush();assert.equal(s.writes[0].changes['sound.pitch'],3);await down();await s.doc.fire('pointermove',{clientY:60});await s.doc.fire('pointercancel');await s.flush();assert.equal(s.writes.length,1);
});
test('session replacement refuses queued work',async()=>{const s=build();await s.open();await s.choose();await s.step('sound.pitch');s.changeSession();await s.flush();assert.deepEqual(s.writes,[]);assert.match(s.dom.padStatus.textContent,/Session changed/);});
for(const meta of [{sym:7},{...metadata(),'sound.playmode':1}])test('incomplete or unknown metadata is shown raw and refuses synthetic writable service',async()=>{
 const s=build({meta});await s.open();await s.choose();assert.equal(s.dom.padApply.disabled,true);await s.dom.padApply.fire('click');await s.step('sound.pitch');await s.flush();assert.deepEqual(s.writes,[]);assert.match(s.dom.padReason.textContent,/snapshot|enum/i);
});
test('production-style denied writes display the concrete reason',async()=>{const s=build({write:false});await s.open();await s.choose();assert.match(s.dom.padReason.textContent,/physical evidence/);assert.equal(s.dom.padApply.disabled,true);});
test('matching pad event rereads metadata without rebuilding selector options',async()=>{const s=build();await s.open();await s.choose();s.dom.padSelect.innerHTML='stable options';s.setDevice({...metadata(),'sound.pitch':-8});await s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});assert.equal(s.dom.padSelect.innerHTML,'stable options');assert.match(s.dom.padGrid.innerHTML,/-8/);});
test('hardware follow uses authoritative discovery and clears old library copy source across samples',async()=>{
 const s=build();await s.open();await s.choose();await s.controller.handleActivePad({padId:6107,sym:8});assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padSource.textContent,/unavailable|choose|cleared/i);
});
test('recovery is independently reachable, verification is read-only and restore requires confirmation',async()=>{
 const s=build(),calls=[];let approved=false;const record={id:'r1',target:target(),before:metadata(),desired:{...metadata(),'sound.pitch':5},status:'requires-recovery'};
 const r=createPadRecoveryController({dom:s.dom,listRecords:async()=>[record],verify:async id=>{calls.push(['verify',id]);return{metadata:record.desired,classification:'desired'};},restore:async(...args)=>calls.push(['restore',...args]),acknowledge:async id=>calls.push(['ack',id]),confirmAction:async()=>approved,reportError:()=>{}});
 await r.refresh();s.dom.padRecoveryList.value='r1';await s.dom.padRecoveryList.fire('change');assert.match(s.dom.padRecoveryDetail.textContent,/ORIGINAL.*CURRENT.*DESIRED/s);await s.dom.padRecoveryVerify.fire('click');assert.deepEqual(calls,[['verify','r1']]);await s.dom.padRecoveryRestore.fire('click');assert.equal(calls.length,1);approved=true;await s.dom.padRecoveryRestore.fire('click');assert.deepEqual(calls[1],['restore','r1',{confirmed:true}]);await s.dom.padRecoveryAcknowledge.fire('click');assert.deepEqual(calls[2],['ack','r1']);r.dispose();assert.equal([...s.dom.padRecoveryVerify.handlers.values()].reduce((n,set)=>n+set.size,0),0);
});

test('workspace composition forwards its single FILE subscription and owns pad dialog/recovery lifecycle',async()=>{
 const fs=await import('node:fs/promises');const source=await fs.readFile(new URL('../js/ep133/ui/createEpWorkspace.js',import.meta.url),'utf8');
 assert.match(source,/padPropertiesController\.handleFileEvent\(event\)/);assert.match(source,/onActivePad:.*padPropertiesController\.handleActivePad/);
 assert.match(source,/unsubscribeFileEvents\?\.\(\)/);assert.match(source,/padPropertiesController\.dispose\(\)/);assert.match(source,/padRecoveryController\.dispose\(\)/);
 assert.match(source,/\[confirmDialog,padDialog,/);assert.match(source,/padRecoveryController\.refresh\(\)/);
 const registry=await fs.readFile(new URL('../js/ep133/ui/domRegistry.js',import.meta.url),'utf8');assert.match(registry,/padDialog:'ep133-pad-dialog'/);
 const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="ep133-pad-dialog"/);assert.match(html,/id="ep133-pad-recovery-verify"/);
});

test('a second pad edit uses a fresh authoritative snapshot/fingerprint after apply',async()=>{
 const s=build();await s.open();await s.choose();const n=s.reads.length;await s.step('sound.pitch');await s.flush();assert.ok(s.reads.length>n,'runtime result is reread to retain its authoritative fingerprint');await s.step('sound.pitch');await s.flush();assert.equal(s.writes[1].before.metadata['sound.pitch'],1);assert.equal(s.writes[1].changes['sound.pitch'],2);
});
test('closing during target read ignores the late response',async()=>{
 const s=build();await s.open();await s.choose();const promise=s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});s.controller.close();await promise;assert.equal(s.dom.padDialog.hidden,true);assert.deepEqual(s.writes,[]);
});
test('pad time editing never creates library BPM or bars fields',async()=>{
 const s=build();await s.open();await s.choose();await s.step('time.mode');await s.flush();assert.deepEqual(s.writes[0].changes,{'time.mode':'bpm'});assert.doesNotMatch(s.dom.padGrid.innerHTML,/data-property="sound\.(bpm|bars)"/);
});
test('pad time mode reaches BAR without requiring or inventing library timing values',async()=>{
 const s=build();await s.open();await s.choose();
 for(const mode of ['bpm','bar','off']){await s.step('time.mode');await s.flush();assert.deepEqual(s.writes.at(-1).changes,{'time.mode':mode});}
 assert.equal(s.writes.length,3);assert.doesNotMatch(s.dom.padGrid.innerHTML,/data-property="sound\.(bpm|bars)"/);
});

test('authoritative hardware target follows across project/group and invalidates original copy source',async()=>{
 const s=build();await s.open();await s.choose();const selected={project:'02',group:'B',pad:'12',projectFid:3100,groupFid:4600,padFid:6207,sampleSlot:8};await s.controller.handleActivePad({padId:6207,sym:8,target:selected});assert.deepEqual(s.reads.at(-1),selected);assert.equal(s.dom.padProject.value,'02');assert.equal(s.dom.padGroup.value,'B');assert.equal(s.dom.padSelect.value,'12');assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padSource.textContent,/cleared/);await s.step('sound.pitch');await s.flush();assert.equal(s.writes[0].target.padFid,6207);assert.equal(s.writes[0].before.metadata.sym,8);
});
for(const outcome of ['success','failure'])test(`hardware follow blocks stale grid/apply during a delayed ${outcome} read`,async()=>{
 const selected={project:'02',group:'B',pad:'12',projectFid:3100,groupFid:4600,padFid:6207,sampleSlot:7};
 let settle,defer=true;
 const s=build({readResult:(target,result)=>target.padFid===selected.padFid&&defer?new Promise((resolve,reject)=>{settle=()=>{defer=false;outcome==='success'?resolve(result):reject(Error('Selected pad read failed'));};}):result});
 await s.open();await s.choose();const follow=s.controller.handleActivePad({padId:selected.padFid,sym:7,target:selected});await tick();
 assert.deepEqual(s.reads.at(-1),selected);assert.equal(s.dom.padProject.value,'02');assert.equal(s.dom.padSelect.value,'12');
 const attemptEdit=async()=>{await s.step('sound.pitch');await s.flush();await s.dom.padApply.fire('click');await s.dom.padGrid.fire('pointerdown',{clientY:100,preventDefault(){},target:{closest:()=>({})}});await s.doc.fire('pointermove',{clientY:91});await s.doc.fire('pointerup');await s.flush();};
 await attemptEdit();assert.deepEqual(s.writes,[],'new selectors must never dispatch changes to the old pad');assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padAssignment.textContent,/NO PAD SELECTED/);
 settle();await follow;
 if(outcome==='success'){assert.match(s.dom.padAssignment.textContent,/02.*B.*12/);await s.step('sound.pitch');await s.flush();assert.equal(s.writes.length,1);assert.equal(s.writes[0].target.padFid,selected.padFid);}
 else{await attemptEdit();assert.deepEqual(s.writes,[]);assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padStatus.textContent,/Selected pad read failed/);assert.match(s.dom.padAssignment.textContent,/NO PAD SELECTED/);}
 s.controller.dispose();
});
test('newest hardware selection supersedes a pending read and stale completion cannot unlock it',async()=>{
 const b={...target('02'),padFid:6111},c={...target('03'),padFid:6113},pending=new Map();let defer=true;
 const s=build({readResult:(selected,result)=>defer&&[b.padFid,c.padFid].includes(selected.padFid)?new Promise(resolve=>pending.set(selected.padFid,()=>resolve(result))):result});
 await s.open();await s.choose();const first=s.controller.handleActivePad({padId:b.padFid,sym:7,target:b});await tick();
 const newest=s.controller.handleActivePad({padId:c.padFid,sym:7,target:c});await tick();
 assert.deepEqual(s.reads.map(item=>item.padFid),[6107,b.padFid,c.padFid]);assert.equal(s.dom.padSelect.value,'03');
 pending.get(b.padFid)();await first;await s.step('sound.pitch');await s.flush();await s.dom.padApply.fire('click');assert.deepEqual(s.writes,[]);assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padAssignment.textContent,/NO PAD SELECTED/);
 defer=false;pending.get(c.padFid)();await newest;assert.match(s.dom.padAssignment.textContent,/01.*A.*03/);await s.step('sound.pitch');await s.flush();assert.equal(s.writes.length,1);assert.equal(s.writes[0].target.padFid,c.padFid);s.controller.dispose();
});
test('hardware follow accepts a fresh selection after the previous target read failed',async()=>{
 const b={...target('02'),padFid:6111},c={...target('03'),padFid:6113};
 const s=build({readResult:(selected,result)=>{if(selected.padFid===b.padFid)throw Error('Prior target read failed');return result;}});await s.open();await s.choose();
 await s.controller.handleActivePad({padId:b.padFid,sym:7,target:b});assert.equal(s.dom.padApply.disabled,true);await s.controller.handleActivePad({padId:c.padFid,sym:7,target:c});
 assert.equal(s.reads.at(-1).padFid,c.padFid);assert.equal(s.dom.padSelect.value,'03');assert.match(s.dom.padAssignment.textContent,/01.*A.*03/);await s.step('sound.pitch');await s.flush();assert.equal(s.writes.length,1);assert.equal(s.writes[0].target.padFid,c.padFid);s.controller.dispose();
});
for(const action of ['manual choose','close','reset'])test(`${action} clears hardware-follow loading context and ignores its late read`,async()=>{
 const b={...target('02'),padFid:6111},c={...target('03'),padFid:6113};let finish;
 const s=build({readResult:(selected,result)=>selected.padFid===b.padFid?new Promise(resolve=>{finish=()=>resolve(result);}):result});await s.open();await s.choose();
 const old=s.controller.handleActivePad({padId:b.padFid,sym:7,target:b});await tick();
 if(action==='manual choose'){s.dom.padProject.value='01';await s.dom.padProject.fire('change');}else{s.controller[action]();await s.open();}
 const n=s.reads.length;await s.controller.handleActivePad({padId:c.padFid,sym:7,target:c});assert.equal(s.reads.length,n);
 finish();await old;assert.equal(s.dom.padApply.disabled,true);assert.match(s.dom.padAssignment.textContent,/NO PAD SELECTED/);assert.deepEqual(s.writes,[]);s.controller.dispose();
});
test('recovery errors remain visible after action cleanup',async()=>{
 const s=build();const r=createPadRecoveryController({dom:s.dom,listRecords:async()=>[{id:'r',target:target(),before:metadata(),desired:metadata(),status:'requires-recovery'}],verify:async()=>{throw Error('Protected state is incomplete');},confirmAction:async()=>true,reportError:()=>{}});await r.refresh();s.dom.padRecoveryList.value='r';await s.dom.padRecoveryList.fire('change');await s.dom.padRecoveryVerify.fire('click');assert.match(s.dom.padRecoveryDetail.textContent,/Protected state is incomplete/);r.dispose();
});
test('an old recovery action settling after reset cannot unlock a newer action',async()=>{
 const s=build(),pending=[];let calls=0;
 const r=createPadRecoveryController({dom:s.dom,listRecords:async()=>[{id:'r',target:target(),before:metadata(),desired:metadata(),status:'requires-recovery'}],verify:()=>{calls++;return new Promise(resolve=>pending.push(resolve));},confirmAction:async()=>true,reportError:()=>{}});
 const choose=async()=>{await r.refresh();s.dom.padRecoveryList.value='r';await s.dom.padRecoveryList.fire('change');};
 await choose();const old=s.dom.padRecoveryVerify.fire('click');r.reset();await choose();const current=s.dom.padRecoveryVerify.fire('click');
 pending[0]({metadata:metadata()});await old;
 assert.equal(s.dom.padRecoveryVerify.disabled,true);assert.equal(calls,2);
 pending[1]({metadata:metadata()});await current;assert.equal(s.dom.padRecoveryVerify.disabled,false);r.dispose();
});
test('manual recovery refresh cannot invalidate a pending verification result',async()=>{
 const s=build();let rejectRead,lists=0;
 const r=createPadRecoveryController({dom:s.dom,listRecords:async()=>{lists++;return[{id:'r',target:target(),before:metadata(),desired:metadata(),status:'requires-recovery'}];},verify:()=>new Promise((resolve,reject)=>{rejectRead=reject;}),reportError:()=>{}});
 await r.refresh();s.dom.padRecoveryList.value='r';await s.dom.padRecoveryList.fire('change');const action=s.dom.padRecoveryVerify.fire('click');
 await s.dom.padRecoveryRefresh.fire('click');rejectRead(Error('Verification is incomplete'));await action;
 assert.equal(lists,1);assert.match(s.dom.padRecoveryDetail.textContent,/Verification is incomplete/);assert.equal(s.dom.padRecoveryVerify.disabled,false);r.dispose();
});
test('reset releases UI ownership while an old dispatched apply cannot unlock a newer apply',async()=>{
 const pending=[],s=build({applyResult:()=>new Promise(resolve=>pending.push(resolve))});await s.open();await s.choose();
 const old=s.dom.padApply.fire('click');s.controller.reset();await s.open();await s.choose();
 const current=s.dom.padApply.fire('click');assert.equal(s.writes.length,2);
 pending[0]({metadata:{...metadata(),...s.source},verification:{ok:true}});await old;
 assert.equal(s.dom.padApply.disabled,true);await s.step('sound.pitch');await s.flush();assert.equal(s.writes.length,2);
 s.setDevice({...metadata(),...s.source});pending[1]({metadata:{...metadata(),...s.source},verification:{ok:true}});await current;assert.match(s.dom.padStatus.textContent,/SAVED/);s.controller.dispose();
});

test('unchanged hardware echoes preserve verified saved status while changed metadata clears it',async()=>{
 const s=build();await s.open();await s.choose();await s.step('sound.pitch');await s.flush();
 assert.match(s.dom.padStatus.textContent,/SAVED ON EP/);
 await s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});
 assert.match(s.dom.padStatus.textContent,/SAVED ON EP/);
 await s.controller.handleActivePad({padId:6107,sym:7,target:target()});
 assert.match(s.dom.padStatus.textContent,/SAVED ON EP/);
 s.setDevice({...metadata(),'sound.pitch':-6});
 await s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});
 assert.match(s.dom.padStatus.textContent,/READY/);
 assert.doesNotMatch(s.dom.padStatus.textContent,/SAVED ON EP/);
});

test('hardware changes after verified apply are not retained as the saved snapshot',async()=>{
 let s;s=build({applyResult:async args=>{
  const confirmed={...args.before.metadata,...args.changes};
  s.setDevice({...confirmed,'sound.pitch':-6});
  return{metadata:confirmed,verification:{ok:true}};
 }});
 await s.open();await s.choose();await s.step('sound.pitch');await s.flush();
 assert.doesNotMatch(s.dom.padStatus.textContent,/SAVED ON EP/);
 await s.controller.handleFileEvent({type:UPDATED,data:{nodeId:6107}});
 assert.doesNotMatch(s.dom.padStatus.textContent,/SAVED ON EP/);
 assert.match(s.dom.padGrid.innerHTML,/-6/);
});
