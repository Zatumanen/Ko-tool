import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('shared device runtime facade exposes one DOM-free singleton',async()=>{
  const runtimeModule=await import('../js/ep133/deviceRuntime.js');
  assert.equal(runtimeModule.getDeviceRuntimeSnapshot(),runtimeModule.deviceRuntime.getSnapshot());
  assert.equal(typeof runtimeModule.onDeviceRuntimeChange,'function');
  assert.equal(typeof runtimeModule.dispatchDeviceRuntimeEvent,'function');
  const source=await fs.readFile(new URL('../js/ep133/deviceRuntime.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"].*device\.js/);
  assert.doesNotMatch(source,/fileTransport|document\.|window\.|localStorage|sessionStorage/);
});

test('device lifecycle mirrors connection and unsafe transitions into the shared runtime without removing legacy APIs',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/from ['"]\.\/deviceRuntime\.js/);
  assert.match(source,/CONNECT_STARTED/);
  assert.match(source,/DEVICE_CONNECTED/);
  assert.match(source,/DEVICE_DISCONNECTED/);
  assert.match(source,/DEVICE_MARKED_UNSAFE/);
  assert.match(source,/identityVerified:true/);
  assert.match(source,/export function isConnected\(\)/);
  assert.match(source,/export function isDeviceUnsafe\(\)/);
  assert.match(source,/export function getDeviceSessionToken\(\)/);
  assert.match(source,/export function onConnectionChange\(listener\)/);
});

test('runtime device summary is sanitized and never copies raw serial metadata',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  const start=source.indexOf('const deviceRuntimeSummary=');
  assert.notEqual(start,-1);
  const end=source.indexOf('\n',start);
  const declaration=source.slice(start,end<0?source.length:end);
  assert.match(declaration,/sku:/);
  assert.match(declaration,/firmware:/);
  assert.match(declaration,/deviceKey:/);
  assert.match(declaration,/identityVerified:true/);
  assert.doesNotMatch(declaration,/serial|metadata:/i);
});
