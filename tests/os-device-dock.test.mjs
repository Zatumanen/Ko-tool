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

test('theme sync updates only the embedded visual document and survives iframe load',()=>{
 const dock={hidden:true};
 const attrs={osTheme:''};
 const doc={documentElement:{classList:{contains:name=>name==='os-embedded'},dataset:attrs}};
 const handlers=new Map();
 const frame={src:'',contentDocument:null,addEventListener:(name,fn)=>handlers.set(name,fn)};
 const controller=createDeviceDockController({dock,frame});
 controller.setTheme('classic');
 controller.open();
 assert.equal(frame.src,'../index.html?os-embed=1');
 frame.contentDocument=doc;
 handlers.get('load')();
 assert.equal(attrs.osTheme,'classic');
 controller.setTheme('studio');
 assert.equal(attrs.osTheme,'studio');
 controller.setTheme('unsupported');
 assert.equal(attrs.osTheme,'studio');
 assert.equal(controller.isLoaded(),true);
 assert.equal(frame.src,'../index.html?os-embed=1');
});

test('the embedded visual skin is scoped and retains device safety classes',async()=>{
 const fs=await import('node:fs/promises');
 const css=await fs.readFile(new URL('../css/os-my-ep-skin.css',import.meta.url),'utf8');
 const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/href="css\/os-my-ep-skin\.css"/);
 assert.match(css,/html\.os-embedded\[data-os-theme="classic"\]/);
 assert.match(css,/\.ep133-sample-row\.selected/);
 assert.match(css,/\.ep-project-row\.selected/);
 assert.match(css,/\.ep133-confirm-window/);
 assert.match(css,/\.ep133-global-progress/);
 assert.doesNotMatch(css,/pointer-events:\s*none\s*!important/);
});
