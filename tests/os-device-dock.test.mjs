import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceDockController,isEpSessionBusy} from '../os/deviceDock.js';

test('device dock opens in this tab without a hash-triggered MIDI connection and never remounts',()=>{
 const dock={hidden:true},frame={src:''};
 const controller=createDeviceDockController({dock,frame});
 assert.equal(controller.isLoaded(),false);
 controller.open();
 assert.equal(frame.src,'../index.html?os-embed=1');
 assert.equal(dock.hidden,false);
 frame.src='../index.html?os-embed=1#internal-view';
 controller.open();
 assert.equal(frame.src,'../index.html?os-embed=1#internal-view');
 assert.equal(controller.isLoaded(),true);
});
test('active hardware operations cannot be hidden by OS navigation',()=>{
 const dock={hidden:false},frame={src:'embedded'};
 const controller=createDeviceDockController({dock,frame});
 for(const phase of ['reading','mutating','verifying']){
  assert.equal(isEpSessionBusy({phase}),true);
  assert.equal(controller.hide({phase}),false);
  assert.equal(dock.hidden,false);
 }
 assert.equal(controller.hide({status:'ready',phase:'idle'}),true);
 assert.equal(dock.hidden,true);
 assert.equal(isEpSessionBusy({status:'unsafe',phase:'idle'}),false);
});
