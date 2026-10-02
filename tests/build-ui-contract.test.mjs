import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('Pages deploy builds a commit-versioned dist artifact',async()=>{
  const [workflow,pkg,index]=await Promise.all([
    read('.github/workflows/deploy-pages.yml'),read('package.json'),read('index.html')
  ]);
  assert.match(workflow,/SPEEDUPPERCUT_BUILD_VERSION:\s*\$\{\{ github\.sha \}\}/);
  assert.match(workflow,/run: npm run build:pages/);
  assert.match(workflow,/path: dist/);
  assert.doesNotMatch(workflow,/path: \./);
  assert.equal(JSON.parse(pkg).scripts['build:pages'],'node scripts/build-pages.mjs');
  const base=index.indexOf('css/base.css');
  const core=index.indexOf('css/my-ep.css');
  const projects=index.indexOf('css/my-ep-projects.css');
  assert.ok(base>=0&&core>base&&projects>core);
});

test('My EP core and project CSS are physically separated',async()=>{
  const [core,projects]=await Promise.all([read('css/my-ep.css'),read('css/my-ep-projects.css')]);
  assert.doesNotMatch(core,/My EP Projects read-only view/);
  assert.doesNotMatch(core,/\.ep-project-editor-dialog/);
  assert.doesNotMatch(core,/\.ep-sequencer-dialog/);
  assert.match(projects,/My EP Projects read-only view/);
  assert.match(projects,/\.ep-project-editor-dialog/);
  assert.match(projects,/\.ep-sequencer-dialog/);
});

test('My EP composition root delegates DOM registry and window shell behavior',async()=>{
  const source=await read('js/ep133/ui.js');
  assert.match(source,/from '\.\/ui\/domRegistry\.js'/);
  assert.match(source,/from '\.\/ui\/windowShell\.js'/);
  assert.match(source,/const dom=getEpBrowserDom\(document\)/);
  assert.match(source,/makeDraggableWindow\(panel\.querySelector\('\.ep133-browser-window'\)/);
  assert.doesNotMatch(source,/const makeDraggable=/);
  assert.doesNotMatch(source,/const isMobileDevice=/);
  assert.doesNotMatch(source,/const open=document\.getElementById\('my-ep-icon'\)/);
});
