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

test('official-style MOVE trusts hardware remap rather than reading project TAR',async({page})=>{
  await open(page,'native');
  await page.evaluate(()=>window.__fakeEp.setFirmwareProjectRemapEnabled(false));
  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drag(page,7,20);
  await expect(page.locator('[data-slot="20"]')).toHaveClass(/occupied/);
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),pads:window.__fakeEp.projectPadSlots()
  }),start);
  expect(mutations(result.requests).map(x=>x.sub)).toEqual([12]);
  expect(result.requests.some(x=>x.command===5&&x.sub===3&&x.type===0)).toBe(false);
  // Deliberate scope limit: broken fake firmware cannot be detected by this
  // official-style path. Real EP-133 2.5.1 HIL proved firmware remapping.
  expect(result.pads.filter(x=>x.slot===7)).toHaveLength(2);
});

test('a malformed saved project does not trigger a project TAR read on verified firmware',async({page})=>{
  await open(page,'malformed');
  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drag(page,10,20);
  await expect(page.locator('[data-slot="20"]')).toHaveClass(/occupied/);
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),samples:window.__fakeEp.snapshot()
  }),start);
  expect(mutations(result.requests).map(x=>x.sub)).toEqual([12]);
  expect(result.requests.some(x=>x.command===5&&x.sub===3&&x.type===0)).toBe(false);
  expect(result.samples.some(x=>x.id===10)).toBe(false);
});

test('unreferenced native MOVE skips project scans and still verifies destination CRC',async({page})=>{
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
  expect(mutations(result.requests).map(r=>r.sub)).toEqual([12]);
  expect(result.requests.some(r=>r.command===5&&r.sub===3&&r.type===0)).toBe(false);
  expect(result.requests.some(r=>r.command===5&&r.sub===7&&r.type===2&&
    ((r.raw[2]<<8)|r.raw[3])===20)).toBe(true);
  expect(result.bytes).toEqual(before.bytes);
  expect(result.projects).toEqual(before.projects);
});

test('native cross-tab drag opens LOOP on hover and moves only on empty slot drop',async({page})=>{
  await open(page,'native');
  const source=page.locator('[data-slot="7"]');
  await expect(source).toHaveAttribute('draggable','true');
  const from=await source.boundingBox();
  const tab=page.locator('.ep133-sample-tab', {hasText:'LOOP'});
  const destinationTab=await tab.boundingBox();
  expect(from).toBeTruthy();expect(destinationTab).toBeTruthy();
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);

  await page.mouse.move(from.x+60,from.y+from.height/2);
  await page.mouse.down();
  await page.mouse.move(destinationTab.x+destinationTab.width/2,
    destinationTab.y+destinationTab.height/2,{steps:18});

  await expect(page.locator('.ep133-sample-tab.selected')).toHaveText('LOOP');
  await expect(page.locator('[data-slot="600"]')).toHaveClass(/empty/);
  expect(await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).some(
    r=>r.command===5&&r.sub===12
  ),before)).toBe(false);

  const target=page.locator('[data-slot="600"]');
  await target.scrollIntoViewIfNeeded();
  const to=await target.boundingBox();
  await page.mouse.move(to.x+60,to.y+to.height/2,{steps:16});
  await page.mouse.up();
  await expect(page.locator('[data-slot="600"]')).toHaveClass(/occupied/);
  await expect(page.locator('#ep133-global-progress')).toBeHidden();

  const result=await page.evaluate(start=>({
    requests:window.__fakeEp.requestLog.slice(start),
    pads:window.__fakeEp.projectPadSlots()
  }),before);
  expect(mutations(result.requests).map(x=>x.sub)).toEqual([12]);
  expect(result.pads.filter(x=>x.slot===600)).toHaveLength(2);
  // Native EP-133 2.5.1 firmware updates pad references itself; no TAR GET.
  expect(result.requests.filter(x=>x.command===5&&x.sub===3&&x.type===0)).toEqual([]);
});

test('dragging onto a tab alone never dispatches native FILE_MOVE',async({page})=>{
  await open(page,'native');
  const from=await page.locator('[data-slot="7"]').boundingBox();
  const tab=await page.locator('.ep133-sample-tab',{hasText:'LOOP'}).boundingBox();
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.mouse.move(from.x+60,from.y+from.height/2);
  await page.mouse.down();
  await page.mouse.move(tab.x+tab.width/2,tab.y+tab.height/2,{steps:16});
  await expect(page.locator('.ep133-sample-tab.selected')).toHaveText('LOOP');
  await page.mouse.up();
  const moves=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).filter(
    x=>x.command===5&&x.sub===12
  ),before);
  expect(moves).toEqual([]);
});
