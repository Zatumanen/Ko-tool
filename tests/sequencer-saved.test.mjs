import{test}from 'node:test';
import assert from 'node:assert/strict';
import{buildStepPage,createSavedSequencer}from '../js/sequencer/saved.js';
import{renderSavedSteps}from '../js/sequencer/stepView.js';
const model={patterns:[{id:'A01',group:'a',bars:2,records:[{kind:'note',index:0,pad:1,tick:25,note:60,velocity:103,duration:391},{kind:'unknown',index:1,tick:401,recordType:7}]}],missingPatternReferences:['B02']};
test('Saved pages retain raw timing, off-grid events and unknown records without changing model',()=>{
 const before=structuredClone(model),page=buildStepPage(model,'a','A01',0);
 assert.equal(page.pages,2);assert.equal(page.notes[0].step,1);assert.equal(page.notes[0].offset,1);
 assert.equal(page.notes[0].duration,391);assert.equal(page.notes[0].velocity,103);
 assert.equal(buildStepPage(model,'a','A01',1).unknown[0].tick,401);
 assert.deepEqual(model,before);
 const html=renderSavedSteps({project:'01',model:{...model,pads:{},unknownMembers:[]}},{patternId:'A01'});
 assert.match(html,/25<\/td><td>2<\/td><td>1<\/td><td>60<\/td><td>103<\/td><td>391/);
 assert.match(html,/Missing pattern references:.*B02/);
 assert.deepEqual(model,before);
});
test('Saved reads are explicit, fail closed and discard stale session/project/close results',async()=>{
 let key=null,resolve,calls=0;
 const c=createSavedSequencer({getSession:()=>key,canRead:()=>!!key,list:async()=>{calls++;return{projects:[{project:'01'}]};},read:()=>{calls++;return new Promise(r=>resolve=r);}});
 assert.equal(calls,0);await c.loadList();assert.equal(calls,0);
 key='epoch1';c.sync();await c.loadList();c.select('01');
 const pending=c.refresh();key='epoch2';c.sync();resolve({project:'01',model});await pending;
 assert.equal(c.getState().result,null);
 c.select('01');const second=c.refresh();c.select('02');resolve({project:'01',model});await second;
 assert.equal(c.getState().result,null);
 const third=c.refresh();c.close();resolve({project:'02',model});await third;assert.equal(c.getState().result,null);
 key=null;c.sync();assert.deepEqual(c.getState().projects,[]);
});
test('Saved successful reads are retained during their own busy runtime and failures clear data',async()=>{
 let ready=true,fail=false,calls=0;
 const result={project:'01',model},before=structuredClone(model);
 const c=createSavedSequencer({getSession:()=> 'same-session',canRead:()=>ready,list:async()=>({projects:[{project:'01'}]}),read:async()=>{calls++;ready=false;c.sync();if(fail)throw Error('read failure');return result;}});
 await c.loadList();c.select('01');await c.refresh();assert.equal(c.getState().result,result);
 assert.deepEqual(model,before);await c.refresh();assert.equal(calls,1);
 ready=true;fail=true;await c.refresh();assert.equal(c.getState().result,null);assert.match(c.getState().message,/READ FAILED/);
});
