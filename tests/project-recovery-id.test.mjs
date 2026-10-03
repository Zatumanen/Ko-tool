import test from 'node:test';
import assert from 'node:assert/strict';
import{
  createProjectRecoveryCheckpoint,
  hashDeviceIdentity,
  crc32Hex
}from '../js/ep133/projectRecovery.js';

const device={sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'RECOVERY-ID-TEST'}};
const createdAt=new Date('2026-10-03T12:00:00.123Z');
const archive=new Uint8Array(1024);

const makeCheckpoint=()=>createProjectRecoveryCheckpoint({
  device,
  projectNumber:'01',
  destinationFid:3001,
  parentFid:2000,
  backup:{name:'P01.tar',data:archive},
  candidate:archive,
  createdAt
});

test('project recovery checkpoints remain unique for identical same-millisecond writes',()=>{
  const first=makeCheckpoint();
  const second=makeCheckpoint();
  const prefix=[
    'project-write',
    hashDeviceIdentity(device),
    '01',
    createdAt.toISOString(),
    crc32Hex(archive)
  ].join(':')+':';

  assert.notEqual(first.id,second.id);
  assert.equal(first.id.startsWith(prefix),true);
  assert.equal(second.id.startsWith(prefix),true);
  assert.equal(first.id.includes('RECOVERY-ID-TEST'),false);
  assert.equal(second.id.includes('RECOVERY-ID-TEST'),false);
});
