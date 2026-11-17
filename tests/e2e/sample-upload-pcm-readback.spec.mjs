import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const pcm=Array.from({length:384},(_,i)=>(i*37+13)&255);
const wav=()=>{
  const b=Buffer.alloc(44+pcm.length);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(46875,24);b.writeUInt32LE(93750,28);
  b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);
  b.set(pcm,44);return [...b];
};
const open=async(page,{repitch=false}={})=>{
  await page.addInitScript({path:fakeEpScript});await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  if(!repitch)await page.locator('#ep133-repitch-enabled').uncheck();
  await page.evaluate(()=>{window.__uploadReadbackStart=window.__fakeEp.requestLog.length;});
};
const drop=async(page,count=1)=>{
  await page.locator('[data-slot="50"]').scrollIntoViewIfNeeded();
  await page.evaluate(({bytes,count})=>{
    const dt=new DataTransfer();
    for(let i=0;i<count;i++)dt.items.add(new File([new Uint8Array(bytes)],`incoming-${i}.wav`,{type:'audio/wav'}));
    document.querySelector('[data-slot="50"]').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },{bytes:wav(),count});
  if(count>1){
    await expect(page.locator('.ep133-upload-choice-dialog')).toBeVisible();
    await page.locator('[data-upload-mode="sequential"]').click();
  }
};
const requests=page=>page.evaluate(()=>window.__fakeEp.requestLog.slice(window.__uploadReadbackStart).filter(r=>r.command===5));
const puts=log=>log.filter(r=>r.sub===2&&r.type===0);
const gets=log=>log.filter(r=>r.sub===3&&r.type===0);
const id=r=>(r.raw[2]<<8)|r.raw[3];

test('Upload holds VERIFY until PCM GET completes, then starts the next file',async({page})=>{
  await open(page);
  await page.evaluate(()=>window.__fakeEp.holdNextGet(50));
  await drop(page,2);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.hasHeldGet)).toBe(true);
  const partial=await requests(page);
  expect(puts(partial)).toHaveLength(1);expect(gets(partial).map(id)).toEqual([50]);
  await expect(page.locator('#ep133-global-progress')).toBeVisible();
  await expect(page.locator('#ep133-global-progress-label')).toContainText('VERIFY');
  await expect(page.locator('[data-slot="50"] [title="WRITTEN"]')).toHaveCount(0);
  await page.evaluate(()=>window.__fakeEp.releaseHeldGet());
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  await expect(page.locator('[data-slot="51"]')).toHaveAttribute('draggable','true');
  const log=await requests(page);
  expect(gets(log).map(id)).toEqual([50,51]);
  const secondPut=log.findIndex(r=>r.sub===2&&r.type===0&&((r.raw[3]<<8)|r.raw[4])===51);
  // The first stream has four 96-byte pages and must finish before the second PUT.
  expect(log.slice(0,secondPut).filter(r=>r.sub===3&&r.type===1)).toHaveLength(4);
  expect(secondPut).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__fakeEp.sampleBytes(50))).toEqual(pcm);
  expect(await page.evaluate(()=>window.__fakeEp.sampleBytes(51))).toEqual(pcm);
  expect(log.some(r=>r.sub===6)).toBe(false);
});

for(const fault of ['corruptNextGet','truncateNextGet','rejectNextGet']){
  test('Upload '+fault+' cannot announce success, DELETE, retry or continue the batch',async({page})=>{
    await open(page);
    await page.evaluate(method=>window.__fakeEp[method](50),fault);
    await drop(page,2);
    await expect(page.locator('#ep133-status')).toContainText('SAFETY LOCK');
    await expect(page.locator('#ep133-global-progress')).toBeHidden();
    const log=await requests(page);
    expect(puts(log)).toHaveLength(1);expect(gets(log).map(id)).toEqual([50]);
    expect(log.some(r=>r.sub===6)).toBe(false);
    expect(await page.evaluate(()=>window.__fakeEp.sampleBytes(50))).toEqual(pcm);
    expect(await page.evaluate(()=>window.__fakeEp.sampleBytes(51))).toBeNull();
    await expect(page.locator('[data-slot="50"] [title="WRITTEN"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="50"]')).toHaveClass(/occupied/);
    await expect(page.locator('[data-slot="50"] [title="UNVERIFIED"]')).toHaveCount(1);
    const recovery=await page.evaluate(async()=>{
      const{listSampleRecoveryTransactions}=await import('/js/ep133/filesystem.js?v=20261001-1');
      return(await listSampleRecoveryTransactions()).filter(t=>t.operation==='upload').map(t=>({status:t.status,affected:t.recoveryDetail?.affectedSlots}));
    });
    expect(recovery).toContainEqual({status:'requires-recovery',affected:[50]});
  });
}

test('REPITCH Upload reads back the transformed PCM actually sent in PUT pages',async({page})=>{
  await open(page,{repitch:true});await drop(page);
  await expect(page.locator('[data-slot="50"]')).toHaveAttribute('draggable','true');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const log=await requests(page);
  const sent=log.filter(r=>r.sub===2&&r.type===1&&r.raw.length>4).flatMap(r=>r.raw.slice(4));
  expect(sent).not.toEqual(pcm);expect(sent.length).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__fakeEp.sampleBytes(50))).toEqual(sent);
  expect(gets(log).map(id)).toEqual([50]);
  expect(await page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===50).meta['sound.pitch'])).toBe(-12);
});
