import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('shared device runtime facade is core-only and exposes the authoritative snapshot API',async()=>{
  const runtimeModule=await import('../js/ep133/deviceRuntime.js');
  assert.equal(typeof runtimeModule.deviceRuntime?.getSnapshot,'function');
  assert.equal(typeof runtimeModule.getDeviceRuntimeSnapshot,'function');
  assert.equal(typeof runtimeModule.onDeviceRuntimeChange,'function');
  assert.equal(typeof runtimeModule.dispatchDeviceRuntimeEvent,'function');
  assert.equal(runtimeModule.getDeviceRuntimeSnapshot().status,'disconnected');

  const source=await fs.readFile(new URL('../js/ep133/deviceRuntime.js',import.meta.url),'utf8');
  assert.match(source,/deviceRuntimeState\.js/);
  assert.doesNotMatch(source,/from ['"]\.\/device\.js/);
  assert.doesNotMatch(source,/fileTransport|document|window|navigator/);
});

test('device transport mirrors physical lifecycle and safety into runtime without removing legacy APIs',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/deviceRuntime\.js/);
  for(const event of [
    'CONNECT_STARTED','DEVICE_CONNECTED','DEVICE_DISCONNECTED',
    'FIRMWARE_DEBUG_DETECTED','DEVICE_MARKED_UNSAFE'
  ])assert.match(source,new RegExp(event));

  const device=await import('../js/ep133/device.js');
  for(const name of ['isConnected','isDeviceUnsafe','getDeviceSessionToken','onConnectionChange'])
    assert.equal(typeof device[name],'function');
});

test('runtime device identity summary is intentionally serial-free',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/identityVerified:true/);
  const match=source.match(/dispatchDeviceRuntimeEvent\(\{type:'DEVICE_CONNECTED'[\s\S]*?\}\);/);
  assert.ok(match,'DEVICE_CONNECTED runtime publication must exist');
  assert.doesNotMatch(match[0],/serialNumber|\bserial\b/);
});

test('filesystem translates sample recovery evidence into authoritative runtime events',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(source,/deviceRuntime\.js/);
  assert.match(source,/onRecoveryEvent/);
  assert.match(source,/RECOVERY_REQUIRED/);
  assert.match(source,/RECOVERY_VERIFIED/);
  assert.match(source,/RECOVERY_ACKNOWLEDGED/);
  assert.doesNotMatch(source,/recoveryDetail.*data|recoveryDetail.*pcm/);
});
