import test from 'node:test';
import assert from 'node:assert/strict';
import {formatBytes,storageDelta,createSampleWorkspaceController} from '../os/sampleWorkspace.js';
import fs from 'node:fs/promises';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('OS prepared audio storage reporting uses measured result rather than a fixed x2 estimate',()=>{
 assert.equal(formatBytes(512),'512 B');
 assert.equal(formatBytes(2048),'2.0 KB');
 assert.equal(formatBytes(-1),'—');
 assert.equal(storageDelta({bytes:20000},{bytes:10000}),50);
 assert.equal(storageDelta({bytes:20000},{bytes:30000}),-50);
 assert.equal(storageDelta(null,{bytes:10000}),null);
});

test('Samples in OS import actual reference processing and do not issue hardware writes',async()=>{
 const [module,processor,app,style,html]=await Promise.all([
  read('os/sampleWorkspace.js'),read('js/audio/processor.js'),read('os/app.js'),
  read('os/workspace.css'),read('os/index.html')
 ]);
 assert.match(module,/processAudioInputs\(/);
 assert.match(module,/result\.epStorage/);
 assert.match(module,/storageDelta\(result\.sourceEpStorage,result\.epStorage\)/);
 assert.match(module,/download\(\)/);
 assert.match(module,/NO DEVICE WRITES/);
 assert.match(processor,/EP_REPITCH_FACTOR=2/);
 assert.match(processor,/EP_REPITCH_COMPENSATION=-12/);
 assert.doesNotMatch(module,/requestMIDIAccess|sendSysex|writeProject|writeSample/);
 assert.match(app,/createSampleWorkspaceController/);
 assert.match(app,/sampleWorkspace\.mount\(view,meters\)/);
 assert.match(style,/\.os-file-entry/);
 assert.match(html,/workspace\.css/);
 assert.match(style,/wallpaper\.svg/);
});

test('Sample UI controller starts empty and exposes a stable lifecycle',()=>{
 const workspace=createSampleWorkspaceController();
 assert.equal(workspace.getFileCount(),0);
 assert.equal(typeof workspace.mount,'function');
 assert.equal(typeof workspace.dispose,'function');
});
