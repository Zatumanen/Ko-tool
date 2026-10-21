import test from 'node:test';
import assert from 'node:assert/strict';
import{createReadOnlyPadPropertiesController}from '../js/ep133/ui/padPropertiesReadOnlyController.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const setup=()=>{
  const documentRef={activeElement:null,listeners:new Map(),
    addEventListener(type,fn,options){assert.equal(options,true);this.listeners.set(type,fn);},
    removeEventListener(type){this.listeners.delete(type);}};
  const element=()=>({hidden:true,disabled:false,value:'',textContent:'',innerHTML:'',listeners:new Map(),
    focus(){documentRef.activeElement=this;},
    addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type){this.listeners.delete(type);},
    fire(type){return this.listeners.get(type)?.({target:this});}});
  const dom=Object.fromEntries(['padDialog','padClose','padProject','padGroup','padSelect','padAssignment','padKeys','padGrid','padStatus','padSource'].map(k=>[k,element()]));
  let permission=true,session='one',nextRead=null,targetOverride=null;
  const calls=[],target={project:'01',group:'A',pad:'01',sampleSlot:7,projectFid:2101,groupFid:4001,padFid:6107};
  let metadata={'sound.pitch':-2.25,'sound.playmode':'key','time.mode':'bpm'},assignment={status:'VERIFIED',sampleSlot:7};
  const reader={
    async listTargets(options,context){calls.push(['LIST',options]);assert.equal(context.sessionToken,'one');
      return{projects:[{project:'01'}],groups:[{group:'A'}],
        pads:[{...target,assignment:{...assignment}},
          {...target,pad:'02',padFid:6209,assignment:{status:'VERIFIED',sampleSlot:8}}],
        unverifiedPads:[]};},
    async readTarget(selected,context){calls.push(['GET',selected]);const gate=nextRead;nextRead=null;
      const result={target:targetOverride||{...selected},metadata:{...metadata,'sound.pitch':selected.pad==='02'?4:metadata['sound.pitch']},assignment:{...assignment}};
      if(gate){gate.entered.resolve();await gate.release.promise;}return result;}
  };
  const controller=createReadOnlyPadPropertiesController({dom,reader,documentRef,getAvailability:()=>({read:permission,reason:'READ denied by firmware evidence'}),
    captureSession:()=>session,assertSession:token=>{if(token!==session)throw Error('Device session changed.');}});
  const open=()=>controller.openFromSample({id:7,meta:{'sound.pitch':99,'sound.playmode':'LIBRARY'}});
  const choose=async(key,value)=>{dom[key].value=value;await dom[key].fire('change');};
  const selectPad=async()=>{await open();await choose('padProject','01');await choose('padGroup','A');await choose('padSelect','01');};
  return{controller,dom,calls,target,open,choose,selectPad,documentRef,
    changeSession:()=>{session='two';},deny:()=>{permission=false;},
    setMetadata:value=>{metadata=value;},setAssignment:value=>{assignment=value;},
    overrideTarget:value=>{targetOverride=value;},
    deferRead:()=>{const gate={entered:deferred(),release:deferred()};nextRead=gate;return gate;}
  };
};

test('explicit project/group/pad navigation displays only the pad GET values, never library defaults',async()=>{
  const s=setup();await s.selectPad();
  assert.match(s.dom.padGrid.innerHTML,/-2.25/);assert.match(s.dom.padGrid.innerHTML,/key/);assert.match(s.dom.padGrid.innerHTML,/bpm/);
  assert.doesNotMatch(s.dom.padGrid.innerHTML,/99|LIBRARY|<button|<input|data-property=/);
  assert.match(s.dom.padAssignment.textContent,/PROJECT 01.*A.*01.*007/);
  assert.match(s.dom.padStatus.textContent,/READ ONLY/);
  assert.deepEqual(Object.keys(s.controller).sort(),['close','dispose','invalidate','openFromSample']);
  assert.match(s.dom.padSource.textContent,/ALL 12 PADS/);
  assert.match(s.dom.padKeys.innerHTML,/data-pad-key="01"/);
  assert.match(s.dom.padKeys.innerHTML,/data-pad-key="10"/);
  assert.match(s.dom.padKeys.innerHTML,/ep-pad-key-legend">\./);
  assert.match(s.dom.padKeys.innerHTML,/SMP 007/);
});

test('missing and unsupported metadata render UNVERIFIED plus escaped raw GET data',async()=>{
  const s=setup();s.setMetadata({'sound.pitch':null,'sound.playmode':2,unknown:'<script>bad</script>'});await s.selectPad();
  assert.match(s.dom.padGrid.innerHTML,/UNVERIFIED/);assert.doesNotMatch(s.dom.padGrid.innerHTML,/<script>/);
  assert.match(s.dom.padGrid.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(s.dom.padGrid.innerHTML,/oneshot|off/);
});

test('sym zero is displayed as UNVERIFIED assignment instead of the source library slot',async()=>{
  const s=setup();s.setAssignment({status:'UNVERIFIED',sampleSlot:null,reason:'sym zero'});await s.selectPad();
  assert.match(s.dom.padAssignment.textContent,/UNVERIFIED/);assert.doesNotMatch(s.dom.padAssignment.textContent,/ASSIGNED SAMPLE 007/);
});

test('all twelve physical keys render in hardware order and unavailable nodes are disabled',async()=>{
  const s=setup();await s.open();await s.choose('padProject','01');await s.choose('padGroup','A');
  const html=s.dom.padKeys.innerHTML;
  assert.equal((html.match(/data-pad-key=/g)||[]).length,12);
  assert.match(html,/data-pad-key="01"/);
  assert.match(html,/data-pad-key="02"/);
  assert.match(html,/data-pad-key="10"/);
  assert.match(html,/data-pad-key="12" disabled/);
  assert.ok(html.indexOf('data-pad-key="01"')<html.indexOf('data-pad-key="02"'));
  assert.ok(html.indexOf('data-pad-key="09"')<html.indexOf('data-pad-key="10"'));
});
test('pad keyboard selection updates existing buttons and preserves focused element',async()=>{
  const s=setup();await s.open();await s.choose('padProject','01');await s.choose('padGroup','A');
  const markup=s.dom.padKeys.innerHTML;
  const button=pad=>{
    const state=new Set(),attrs=new Map();
    return{
      dataset:{padKey:pad},disabled:false,
      classList:{toggle:(name,enabled)=>enabled?state.add(name):state.delete(name)},
      setAttribute:(name,value)=>attrs.set(name,value),
      closest:()=>null,
      focus(){s.documentRef.activeElement=this;},
      active:()=>state.has('is-selected'),
      pressed:()=>attrs.get('aria-pressed')
    };
  };
  const first=button('01'),second=button('02');
  first.closest=()=>first;second.closest=()=>second;
  s.dom.padKeys.querySelectorAll=selector=>{
    assert.equal(selector,'[data-pad-key]');return[first,second];
  };
  s.dom.padKeys.contains=element=>element===first||element===second;
  first.focus();
  await s.choose('padSelect','01');
  assert.equal(first.active(),true);assert.equal(first.pressed(),'true');
  await s.choose('padSelect','02');
  assert.equal(first.active(),false);assert.equal(first.pressed(),'false');
  assert.equal(second.active(),true);assert.equal(second.pressed(),'true');
  assert.equal(s.dom.padKeys.innerHTML,markup,'no keycap subtree replacement on selection');
  assert.equal(s.documentRef.activeElement,first,'focused button remains attached');
  second.focus();
  let prevented=0,stopped=0;
  s.documentRef.listeners.get('keydown')({
    key:'Enter',target:second,
    stopImmediatePropagation(){stopped++;},
    preventDefault(){prevented++;}
  });
  assert.equal(stopped,1);assert.equal(prevented,1);
  assert.equal(s.documentRef.activeElement,second);
  assert.equal(s.dom.padKeys.innerHTML,markup);
  assert.equal(s.calls.at(-1)[0],'GET');
});

test('rapid pad switching discards a late answer for the previous pad',async()=>{
  const s=setup();await s.open();await s.choose('padProject','01');await s.choose('padGroup','A');
  const gate=s.deferRead(),old=s.choose('padSelect','01');await gate.entered.promise;
  await s.choose('padSelect','02');gate.release.resolve();await old;
  assert.match(s.dom.padAssignment.textContent,/PAD 02/);assert.match(s.dom.padGrid.innerHTML,/>4</);
  assert.doesNotMatch(s.dom.padGrid.innerHTML,/-2.25/);
});

for(const action of ['close','invalidate','dispose'])test(action+' during GET prevents a late repaint',async()=>{
  const s=setup();await s.open();await s.choose('padProject','01');await s.choose('padGroup','A');
  const gate=s.deferRead(),old=s.choose('padSelect','01');await gate.entered.promise;
  s.controller[action]();gate.release.resolve();await old;
  assert.doesNotMatch(s.dom.padGrid.innerHTML,/-2.25/);
  if(action==='invalidate'){assert.match(s.dom.padStatus.textContent,/STALE/);assert.equal(s.dom.padProject.disabled,true);}
  else assert.equal(s.dom.padDialog.hidden,true);
});

test('reopening starts with empty target and no previous snapshot',async()=>{
  const s=setup();await s.selectPad();s.controller.close();await s.open();
  assert.doesNotMatch(s.dom.padGrid.innerHTML,/-2.25/);assert.equal(s.dom.padSelect.value,'');
  assert.equal(s.dom.padSelect.disabled,true);assert.match(s.dom.padAssignment.textContent,/NO PAD/);
});

test('READ denial disables navigation and performs no discovery',async()=>{
  const s=setup();s.deny();await s.open();assert.deepEqual(s.calls,[]);
  assert.match(s.dom.padStatus.textContent,/READ.*denied/i);
  for(const key of ['padProject','padGroup','padSelect'])assert.equal(s.dom[key].disabled,true);
});

for(const change of ['changeSession','deny'])test(change+' clears previously displayed values and stops further requests',async()=>{
  const s=setup();await s.selectPad();const count=s.calls.length;s[change]();await s.choose('padSelect','02');
  assert.equal(s.calls.length,count);assert.doesNotMatch(s.dom.padGrid.innerHTML,/-2.25/);
  assert.equal(s.dom.padProject.disabled,true);
});

test('a changed response target is rejected before display',async()=>{
  const s=setup();s.overrideTarget({...s.target,padFid:9999});await s.selectPad();
  assert.match(s.dom.padStatus.textContent,/identity|target/i);assert.doesNotMatch(s.dom.padGrid.innerHTML,/-2.25/);
});

for(const key of ['Delete','F2','ArrowDown','ArrowUp','Enter'])test('read-only modal captures '+key+' before background library handlers',async()=>{
  const s=setup();await s.open();let background=0,stopped=false;
  const event={key,stopImmediatePropagation(){stopped=true;},preventDefault(){}};
  s.documentRef.listeners.get('keydown')?.(event);if(!stopped)background++;
  assert.equal(background,0);assert.equal(s.documentRef.activeElement,s.dom.padClose);
  s.controller.close();stopped=false;s.documentRef.listeners.get('keydown')?.(event);
  assert.equal(stopped,false,'normal keyboard behavior resumes after close');
});

for(const type of ['paste','drop'])test('read-only modal blocks background '+type+' and disposes capture listeners',async()=>{
  const s=setup();await s.open();let stopped=false,prevented=false;
  s.documentRef.listeners.get(type)?.({stopImmediatePropagation(){stopped=true;},preventDefault(){prevented=true;}});
  assert.equal(stopped,true);assert.equal(prevented,true);s.controller.dispose();assert.equal(s.documentRef.listeners.size,0);
});

test('Tab cycles within read-only controls, Escape closes and restores focus',async()=>{
  const s=setup(),previous={focus(){s.documentRef.activeElement=this;}};s.documentRef.activeElement=previous;await s.open();
  let prevented=0;const event={key:'Tab',shiftKey:true,stopImmediatePropagation(){},preventDefault(){prevented++;}};
  s.documentRef.listeners.get('keydown')?.(event);assert.equal(prevented,1);assert.equal(s.documentRef.activeElement,s.dom.padProject);
  s.documentRef.listeners.get('keydown')?.({...event,key:'Escape'});
  assert.equal(s.dom.padDialog.hidden,true);assert.equal(s.documentRef.activeElement,previous);
});

test('Tab also reaches the raw metadata disclosure after a permitted pad read',async()=>{
  const s=setup();await s.selectPad();
  const summary={focus(){s.documentRef.activeElement=this;}};
  s.dom.padDialog.querySelectorAll=()=>[s.dom.padClose,s.dom.padProject,s.dom.padGroup,s.dom.padSelect,summary];
  s.dom.padSelect.focus();
  const event={key:'Tab',stopImmediatePropagation(){},preventDefault(){}};
  s.documentRef.listeners.get('keydown')(event);assert.equal(s.documentRef.activeElement,summary);
  s.documentRef.listeners.get('keydown')(event);assert.equal(s.documentRef.activeElement,s.dom.padClose);
});
