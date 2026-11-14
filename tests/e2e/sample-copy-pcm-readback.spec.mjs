import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const open=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('#ep133-status')).not.toContainText('LOADING');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  await expect(page.locator('[data-slot="7"]')).toHaveAttribute('draggable','true');
};
const optionCopy=async page=>{
  await page.keyboard.down('Alt');
  try{await page.locator('[data-slot="7"]').dragTo(page.locator('[data-slot="10"]'));}
  finally{await page.keyboard.up('Alt');}
};
const destGets=page=>page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>
  item.command===5&&item.sub===3&&item.type===0&&((item.raw[2]<<8)|item.raw[3])===10
).length);
const fileRequests=page=>page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>item.command===5));

test.describe('COPY destination PCM readback',()=>{
  test.describe.configure({retries:2}); // Existing Option-drag gesture is flaky on Chromium CI.

  test('COPY reads destination after PUT and preserves source PCM',async({page})=>{
    await open(page);
    await optionCopy(page);
    await expect.poll(()=>destGets(page),{timeout:20000}).toBeGreaterThan(0);
    await expect(page.locator('#ep133-global-progress')).toBeHidden({timeout:20000});
    const requests=await fileRequests(page);
    const putIndex=requests.findIndex(x=>x.sub===2&&x.type===0&&((x.raw[3]<<8)|x.raw[4])===10);
    const getIndex=requests.findIndex(x=>x.sub===3&&x.type===0&&((x.raw[2]<<8)|x.raw[3])===10);
    expect(putIndex).toBeGreaterThanOrEqual(0);
    expect(getIndex).toBeGreaterThan(putIndex);
    const bytes=await page.evaluate(()=>({source:window.__fakeEp.sampleBytes(7),target:window.__fakeEp.sampleBytes(10)}));
    expect(bytes.target).toEqual(bytes.source);
    expect(requests.some(x=>x.sub===6)).toBe(false);
  });

  test('rejected destination GET does not DELETE or retry the new sample',async({page})=>{
    await open(page);
    await page.evaluate(()=>window.__fakeEp.rejectNextGet(10));
    await optionCopy(page);
    await expect.poll(()=>destGets(page),{timeout:20000}).toBe(1);
    await expect(page.locator('#ep133-global-progress')).toBeHidden({timeout:20000});
    const requests=await fileRequests(page);
    const puts=requests.filter(x=>x.sub===2&&x.type===0&&((x.raw[3]<<8)|x.raw[4])===10);
    expect(puts).toHaveLength(1);
    expect(requests.some(x=>x.sub===6)).toBe(false);
    const samples=await page.evaluate(()=>({source:window.__fakeEp.sampleBytes(7),target:window.__fakeEp.sampleBytes(10)}));
    expect(samples.source).not.toBeNull();
    expect(samples.target).not.toBeNull();
    await expect(page.locator('[data-slot="10"]')).not.toContainText('COPIED');
  });
});
