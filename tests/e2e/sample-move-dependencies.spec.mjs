import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const mutations=requests=>requests.filter(r=>r.command===5&&
  ([2,6,12].includes(r.sub)||r.sub===7&&r.type===1));

const open=async(page,variant)=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(mode=>{
    window.__fakeEp.seedSample(10);
    if(mode==='27-byte')window.__fakeEp.setProject27BytePads(1);
    if(mode==='malformed')window.__fakeEp.setProjectMalformedPad(2);
    if(mode==='missing-pattern')window.__fakeEp.setProjectMissingPattern(2);
  },variant);
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 3 SAMPLES');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
};

const drag=async(page,from,to)=>{
  const source=page.locator(`[data-slot="${from}"]`);
  await expect(source).toHaveAttribute('draggable','true');
  await expect.poll(()=>source.evaluate(async row=>{
    const rect=()=>{const r=row.getBoundingClientRect();return[r.x,r.y,r.width,r.height];};
    const before=rect();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return row.isConnected&&rect().every((v,i)=>v===before[i]);
  })).toBe(true);
  await source.dragTo(page.locator(`[data-slot="${to}"]`));
};

for(const variant of ['native','27-byte','missing-pattern']){
  test(variant+': assigned native MOVE preserves every project pad using firmware remap',async({page})=>{
    await open(page,variant);
    const before=await page.evaluate(()=>({
      requests:window.__fakeEp.requestLog.length,
      bytes:window.__fakeEp.sampleBytes(7),
      pads:window.__fakeEp.projectPadSlots()
    }));
    await drag(page,7,20);
    await expect(page.locator('[data-slot="20"]')).toHaveClass(/occupied/);
    await expect(page.locator('[data-slot="7"]')).toHaveClass(/empty/);
    await expect(page.locator('#ep133-global-progress')).toBeHidden();
    const after=await page.evaluate(start=>({
      requests:window.__fakeEp.requestLog.slice(start),
      bytes:window.__fakeEp.sampleBytes(20),
      pads:window.__fakeEp.projectPadSlots()
    }),before.requests);
    expect(mutations(after.requests).map(x=>x.sub)).toEqual([12]);
    expect(after.bytes).toEqual(before.bytes);
    const beforeAffected=before.pads.filter(p=>p.slot===7);
    expect(beforeAffected.length).toBeGreaterThanOrEqual(2);
    for(const pad of beforeAffected){
      expect(after.pads.find(x=>x.project===pad.project&&x.pad===pad.pad)?.slot).toBe(20);
    }
    const beforeOthers=before.pads.filter(p=>p.slot!==7);
    for(const pad of beforeOthers){
      expect(after.pads.find(x=>x.project===pad.project&&x.pad===pad.pad)?.slot).toBe(pad.slot);
    }
    // Only the native FILE_MOVE may mutate device state; no project upload.
    expect(after.requests.filter(x=>x.command===5&&x.sub===2)).toEqual([]);
  });
}

test('firmware that does not remap a referenced project triggers a safety lock without retry',async({page})=>{
  await open(page,'native');
  await page.evaluate(()=>window.__fakeEp.setFirmwareProjectRemapEnabled(false));
  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drag(page,7,20);
  await expect(page.locator('#error-message')).toContainText('Native MOVE may have changed');
  const requests=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),start);
  expect(mutations(requests).map(x=>x.sub)).toEqual([12]);
});

test('an unreadable project pad blocks an unreferenced sample MOVE without mutation',async({page})=>{
  await open(page,'malformed');
  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drag(page,10,20);
  await expect(page.locator('#error-message')).toContainText('unsupported pad-record size');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),samples:window.__fakeEp.snapshot()
  }),start);
  expect(mutations(result.requests)).toEqual([]);
  expect(result.samples.some(s=>s.id===10)).toBe(true);
  expect(result.samples.some(s=>s.id===20)).toBe(false);
});

test('unreferenced native MOVE reads all projects first and verifies destination CRC',async({page})=>{
  await open(page,'native');
  const before=await page.evaluate(()=>({
    requests:window.__fakeEp.requestLog.length,bytes:window.__fakeEp.sampleBytes(10),
    projects:window.__fakeEp.projectSnapshot()
  }));
  await drag(page,10,20);
  await expect(page.locator('[data-slot="20"]')).toHaveClass(/occupied/);
  await expect(page.locator('[data-slot="10"]')).toHaveClass(/empty/);
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),bytes:window.__fakeEp.sampleBytes(20),
    projects:window.__fakeEp.projectSnapshot()
  }),before.requests);
  const move=result.requests.findIndex(r=>r.command===5&&r.sub===12);
  expect(move).toBeGreaterThan(-1);
  const projectReads=result.requests.slice(0,move).filter(r=>r.command===5&&r.sub===3&&r.type===0)
    .map(r=>(r.raw[2]<<8)|r.raw[3]);
  expect(projectReads).toEqual([3001,3002]);
  expect(result.requests.slice(move+1).some(r=>r.command===5&&r.sub===7&&r.type===2&&
    ((r.raw[2]<<8)|r.raw[3])===20)).toBe(true);
  expect(mutations(result.requests).map(r=>r.sub)).toEqual([12]);
  expect(result.bytes).toEqual(before.bytes);
  expect(result.projects).toEqual(before.projects);
});
