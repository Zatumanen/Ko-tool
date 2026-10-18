import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const open=async(page,{corrupt=false}={})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(corrupt=>{
    window.__fakeEp.seedSamples(15);
    if(corrupt)window.__fakeEp.setProjectMalformedPad(2);
  },corrupt);
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 15 SAMPLES',{timeout:12000});
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
};

// Exercise the production MOVE controller with the real filesystem transaction,
// scheduler, dependency parser, journal, CRC transport and fake MIDI device.
const move=async(page,sources)=>page.evaluate(async sources=>{
  const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
  const device=await import('./js/ep133/device.js?v=20261001-1');
  const{createSampleStore}=await import('./js/ep133/sampleStore.js');
  const{createSampleMoveController}=await import('./js/ep133/ui/sampleMoveController.js');
  const store=createSampleStore();
  store.replaceFiles(await fs.listDeviceFiles());
  for(const id of sources)store.setMetadata(id,await fs.getFileMetadata(id));
  const projectBefore=await Promise.all([3001,3002].map(async id=>[...(await fs.getFile(id)).data]));
  const before=window.__fakeEp.requestLog.length;
  const controller=createSampleMoveController({
    sampleStore:store,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    fileItemFromInfo:info=>({...info,fileName:'/sounds/'+info.fileName,fileType:'file'}),
    withFileTransaction:fs.withFileTransaction,
    captureBatchSession:device.getDeviceSessionToken,
    assertBatchSession:token=>{if(token!==device.getDeviceSessionToken())throw new Error('Session changed');},
    getDeviceSessionToken:device.getDeviceSessionToken,isConnected:device.isConnected,
    remapCurrentPropertySlot(){},renderDeviceStats(){},setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:()=>()=>{},clearNativeMoveSuppression(){},
    readDevice:async()=>{},logTechnical(){}
  });
  let error=null;
  try{await controller.nativeMoveTransfer(sources.map((sourceId,index)=>({sourceId,targetId:20+index})),
    new Map(sources.map(id=>[id,store.getSlot(id)])));}
  catch(e){error=String(e.message||e);}
  const requests=window.__fakeEp.requestLog.slice(before);
  const projectAfter=await Promise.all([3001,3002].map(async id=>[...(await fs.getFile(id)).data]));
  return{error,requests,snapshot:window.__fakeEp.snapshot(),projectBefore,projectAfter};
},sources);
const moves=result=>result.requests.filter(r=>r.command===5&&r.sub===12);
const expectNoMove=result=>{
  expect(moves(result)).toHaveLength(0);
  expect(result.snapshot.some(s=>s.id===10)).toBe(true);
  expect(result.snapshot.some(s=>s.id===8)).toBe(true);
  expect(result.projectAfter).toEqual(result.projectBefore);
};

test('unreferenced MOVE scans both projects, verifies destination CRC and preserves projects',async({page})=>{
  await open(page);
  const result=await move(page,[10]);
  expect(result.error).toBeNull();
  expect(moves(result)).toHaveLength(1);
  const firstMove=result.requests.findIndex(r=>r.command===5&&r.sub===12);
  for(const id of [3001,3002])expect(result.requests.slice(0,firstMove).some(r=>
    r.command===5&&r.sub===3&&r.raw[1]===0&&((r.raw[2]<<8)|r.raw[3])===id)).toBe(true);
  expect(result.requests.some(r=>r.command===5&&r.sub===7&&r.type===2&&((r.raw[2]<<8)|r.raw[3])===20)).toBe(true);
  expect(result.snapshot.some(s=>s.id===10)).toBe(false);
  expect(result.snapshot.find(s=>s.id===20).meta.crc).toBe(10010);
  expect(result.projectAfter).toEqual(result.projectBefore);
});

test('project-referenced MOVE sends no FILE_MOVE',async({page})=>{
  await open(page);
  const result=await move(page,[8]);
  expect(result.error).toMatch(/slot 008.*P01 B01.*MOVE would break/);
  expectNoMove(result);
});

test('one referenced source blocks the whole MOVE batch before its first FILE_MOVE',async({page})=>{
  await open(page);
  const result=await move(page,[10,8]);
  expect(result.error).toMatch(/slot 008.*MOVE would break/);
  expectNoMove(result);
});

test('malformed second project blocks otherwise unreferenced MOVE',async({page})=>{
  await open(page,{corrupt:true});
  const result=await move(page,[10]);
  expect(result.error).toMatch(/pad-record size 3/);
  expectNoMove(result);
});
