import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

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
  assert.match(source,/export function initEp133Browser/);
});
