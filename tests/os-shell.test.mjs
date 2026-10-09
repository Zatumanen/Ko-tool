import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {WORKSPACES,PAGES,normalizeWorkspace,normalizeTheme,renderPage} from '../os/app.js';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('OS shell exposes seven accessible navigation spaces without replacing original index',async()=>{
  const [newPage,legacy]=await Promise.all([read('os/index.html'),read('index.html')]);
  assert.equal(WORKSPACES.length,7);
  for(const workspace of WORKSPACES){
    assert.match(newPage,new RegExp('data-view="'+workspace+'"'));
    assert.equal(typeof PAGES[workspace].title,'string');
    assert.match(renderPage(workspace),/EARLY ACCESS/);
  }
  assert.match(newPage,/<main class="os-main" id="os-main"/);
  assert.match(newPage,/<nav id="os-navigation"/);
  assert.match(newPage,/href="\.\.\/index\.html"/);
  assert.match(legacy,/id="main-window"/);
  assert.match(legacy,/id="ep133-browser"/);
  assert.match(legacy,/href="os\/index\.html"/);
});

test('OS shell distinguishes actual operations from preview-only features',async()=>{
  const [html,js]=await Promise.all([read('os/index.html'),read('os/app.js')]);
  assert.match(html,/NO DEVICE SESSION/);
  assert.match(html,/DEMO SIGNAL \/ NOT DEVICE AUDIO/);
  assert.match(html,/\.\.\/index\.html#my-ep/);
  assert.match(js,/No WebMIDI requests or device writes/);
  assert.match(renderPage('samples'),/OPEN CONVERTER/);
  assert.match(renderPage('device'),/OPEN DEVICE MANAGER/);
  assert.match(renderPage('community'),/not an active public database/);
  assert.doesNotMatch(js,/requestMIDIAccess\s*\(/);
  assert.doesNotMatch(js,/sendSysex\s*\(/i);
  assert.doesNotMatch(js,/showSaveFilePicker\s*\(/);
});

test('Workspace and appearance inputs are normalized conservatively',()=>{
  assert.equal(normalizeWorkspace('#os-device'),'device');
  assert.equal(normalizeWorkspace('garbage'),'samples');
  assert.equal(normalizeWorkspace(null),'samples');
  assert.equal(normalizeTheme('classic'),'classic');
  assert.equal(normalizeTheme('Classic'),'studio');
});

test('Pages deployment ships OS preview without moving original app',async()=>{
  const build=await read('scripts/build-pages.mjs');
  const html=await read('os/index.html');
  const css=await read('os/styles.css');
  assert.match(build,/STATIC_ROOT_ENTRIES=\['index\.html','css','js','os'\]/);
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(html,/src="\.\/app\.js"/);
  assert.match(css,/\[data-os-theme=classic\]/);
  assert.match(css,/\.os-meters/);
});
