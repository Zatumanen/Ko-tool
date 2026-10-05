import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import{spawnSync}from'node:child_process';
import{fileURLToPath}from'node:url';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('My EP entry delegates workspace construction to createEpWorkspace',async()=>{
  const source=await read('js/ep133/ui.js');
  assert.match(source,/from '\.\/ui\/createEpWorkspace\.js/);
  assert.match(source,/createEpWorkspace\s*\(\s*\{/);
  assert.doesNotMatch(source,/const updateMutationAvailability=/);
  assert.doesNotMatch(source,/isConnected\(\)\s*&&\s*!deviceUnsafe/);
});

test('My EP entry retains DOM discovery and entry lifecycle only',async()=>{
  const source=await read('js/ep133/ui.js');
  assert.match(source,/const dom=getEpBrowserDom\(document\)/);
  assert.match(source,/hasRequiredEpBrowserDom\(dom\)/);
  assert.match(source,/window\.addEventListener\('paste',workspace\.handlePaste\)/);
  assert.match(source,/document\.addEventListener\('keydown',workspace\.handleKeyDown\)/);
  assert.match(source,/export function initEp133Browser/);
});

test('extracted EP workspace parses and shares the authoritative runtime singleton',async()=>{
  const url=new URL('../js/ep133/ui/createEpWorkspace.js',import.meta.url);
  const checked=spawnSync(process.execPath,['--check',fileURLToPath(url)],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
  const source=await read('js/ep133/ui/createEpWorkspace.js');
  assert.match(source,/from '\.\.\/deviceRuntime\.js'/);
  assert.doesNotMatch(source,/deviceRuntime\.js\?v=/);
  assert.match(source,/const handlePaste=/);
  assert.match(source,/export function createEpWorkspace/);
});
