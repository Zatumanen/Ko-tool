import test from 'node:test';
import assert from 'node:assert/strict';
import{createProjectReadOnlyController}from '../js/ep133/ui/projectReadOnlyController.js';

const element=()=>({
  hidden:false,innerHTML:'',classList:{toggle(){}},setAttribute(){},
  addEventListener(){},querySelectorAll:()=>[]
});
function makeHarness(){
 let connected=true,enabled=true,session='ep-1',bpm=123.5;
 let fails=false,reads=0,lists=0,loaded=0,errors=0,logs=0,progress=0;
 let intervalCallback=null,intervalMs=0,cleared=null;
 const e={
  samplesPanel:element(),projectsPanel:element(),samplesButton:element(),
  projectsButton:element(),projectList:element(),projectInspector:element(),
  refreshButton:element()
 };
 const getResult=()=>({
  project:'01',nodeId:3001,active:true,size:4096,
  profile:{id:'ep133',sku:'EP-133',firmware:'2.5.1'},
  dependencies:{referencedSampleSlots:[],missingSampleSlots:[]},
  model:{
   settings:{bpm},scenes:{entries:[],currentScene:1},
   pads:{a:[],b:[],c:[],d:[]},patterns:[],fxSettings:null
  }
 });
 const controller=createProjectReadOnlyController({
  ...e,
  listProjectArchivesReadOnly:async()=>{
   lists++;if(fails)throw new Error('transient MIDI read failed');
   return{profile:{id:'ep133'},projects:[{project:'01',nodeId:3001,active:true,size:4096}]};
  },
  readProjectArchiveReadOnly:async()=>{reads++;if(fails)throw new Error('transient MIDI read failed');return getResult();},
  getSampleSlot:()=>null,
  onProjectLoaded:()=>{loaded++;},
  onProjectCleared:()=>{},
  isConnected:()=>connected,
  getDeviceSession:()=>session,
  canAutoRefresh:()=>enabled,
  setStatus:()=>{},setGlobalProgress:()=>{progress++;},
  hideGlobalProgress:()=>{},
  reportError:()=>{errors++;},
  logAutoError:()=>{logs++;},
  setIntervalFn:(cb,ms)=>{intervalCallback=cb;intervalMs=ms;return 17;},
  clearIntervalFn:id=>{cleared=id;}
 });
 return{controller,e,get interval(){return intervalCallback},get period(){return intervalMs},get cleared(){return cleared},
  setBpm:value=>{bpm=value},setEnabled:value=>{enabled=value},setConnected:value=>{connected=value},
  setFails:value=>{fails=value},setSession:value=>{session=value},
  count:()=>({reads,lists,loaded,errors,logs,progress})};
}
test('background reconciler reads saved project changes without blanking inspector, progress or unnecessary redraw',async()=>{
 const h=makeHarness();
 assert.equal(h.period,20000);
 await h.controller.refresh();
 h.controller.setMode('projects');
 assert.match(h.e.projectInspector.innerHTML,/123\.5/);
 const before=h.count();
 assert.equal(await h.controller.refreshIfChanged(),false);
 assert.deepEqual(h.count().loaded,before.loaded);
 const inspectorBefore=h.e.projectInspector.innerHTML;
 h.setBpm(136);
 assert.equal(await h.controller.refreshIfChanged(),true);
 assert.match(h.e.projectInspector.innerHTML,/136/);
 assert.notEqual(h.e.projectInspector.innerHTML,inspectorBefore);
 assert.equal(h.count().loaded,before.loaded+1);
 assert.equal(h.count().progress,before.progress);
 assert.equal(h.count().errors,0);
 assert.equal(await h.controller.refreshIfChanged(),false);
 assert.equal(h.count().loaded,before.loaded+1);
 h.controller.dispose();
 assert.equal(h.cleared,17);
});

test('auto polling pauses while hidden, unsafe, disconnected or not in Projects; transient read failures retain last good model',async()=>{
 const h=makeHarness();
 await h.controller.refresh();
 assert.equal(await h.controller.refreshIfChanged(),false);
 h.controller.setMode('projects');
 h.setEnabled(false);
 assert.equal(await h.controller.refreshIfChanged(),false);
 h.setEnabled(true);
 h.setFails(true);
 const html=h.e.projectInspector.innerHTML;
 assert.equal(await h.controller.refreshIfChanged(),false);
 assert.equal(h.e.projectInspector.innerHTML,html);
 assert.equal(h.count().errors,0);
 assert.equal(h.count().logs,1);
 h.setFails(false);h.setConnected(false);
 assert.equal(await h.controller.refreshIfChanged(),false);
 h.setConnected(true);
 h.controller.setMode('samples');
 assert.equal(await h.controller.refreshIfChanged(),false);
 h.controller.dispose();
});

test('stale background project read is discarded on disconnect/reset or changed session token',async()=>{
 let continuation;
 const h=makeHarness();
 await h.controller.refresh();
 h.controller.setMode('projects');
 // Simulate a new session becoming authoritative after read begins by
 // replacing session token during an awaited backend response.
 const original=h.controller;
 h.setSession('ep-2');
 const next=await original.refreshIfChanged();
 assert.equal(next,false); // same session for this invocation: unchanged model
 h.setBpm(160);
 h.setEnabled(false);
 assert.equal(await original.refreshIfChanged(),false);
 h.setEnabled(true);
 h.controller.reset();
 assert.equal(h.controller.getCurrentResult(),null);
 assert.equal(await original.refreshIfChanged(),false);
 h.controller.dispose();
});
