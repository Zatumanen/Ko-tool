import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');

const openMyEp=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect.poll(()=>page.evaluate(()=>{
    const status=document.querySelector('#ep133-status')?.textContent||'';
    const overlay=document.querySelector('#ep133-connection-overlay')?.textContent||'';
    return status.startsWith('SYNCED ·')&&!status.includes('LOADING')&&overlay===''?'SYNCED':status;
  }),{timeout:7000}).toBe('SYNCED');
};

test('missing native scene pattern no longer prevents deleting an unreferenced sample',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(()=>{
    window.__fakeEp.seedSamples(15);
    window.__fakeEp.setProjectMissingPattern(2);
  });
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 15 SAMPLES',{timeout:12000});

  const result=await page.evaluate(async()=>{
    const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
    const before=window.__fakeEp.requestLog.length;
    const action=async ops=>ops.deleteFile(10);
    Object.defineProperty(action,'sampleDependencyGuard',{
      value:{slots:[10],operation:'delete'}
    });
    let error=null;
    try{await fs.withFileTransaction('delete test with implicit scene pattern',action,{strict:true});}
    catch(e){error=String(e.message||e);}
    return{
      error,
      requests:window.__fakeEp.requestLog.slice(before),
      sample10Exists:window.__fakeEp.snapshot().some(s=>s.id===10)
    };
  });
  expect(result.error).toBeNull();
  expect(result.requests.some(r=>r.command===5&&r.sub===6)).toBe(true);
  expect(result.sample10Exists).toBe(false);
});

test('27-byte EP-133 project pads permit unreferenced sample delete but block assigned slots',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(()=>{
    window.__fakeEp.seedSamples(15);
    window.__fakeEp.setProject27BytePads(1);
  });
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 15 SAMPLES',{timeout:12000});

  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:15000});
  const projectRow=page.locator('.ep-project-row').first();
  await projectRow.click();
  await expect(page.locator('#ep133-project-inspector')).toContainText('P01',{timeout:15000});
  await expect(page.locator('#ep133-project-edit')).toBeDisabled();
  await expect(page.locator('#ep133-project-sequencer')).toBeDisabled();

  const result=await page.evaluate(async()=>{
    const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
    const run=async id=>{
      const start=window.__fakeEp.requestLog.length;
      const action=async ops=>ops.deleteFile(id);
      Object.defineProperty(action,'sampleDependencyGuard',{value:{slots:[id],operation:'delete'}});
      let error=null;
      try{await fs.withFileTransaction('27-byte guard',action,{strict:true});}
      catch(e){error=String(e?.message||e);}
      return{error,deleted:window.__fakeEp.requestLog.slice(start).some(x=>x.command===5&&x.sub===6)};
    };
    return{used:await run(7),unused:await run(10),stillThere:window.__fakeEp.snapshot().some(s=>s.id===7),deleted10:!window.__fakeEp.snapshot().some(s=>s.id===10)};
  });
  expect(result.used.error).toMatch(/slot 007 is used by P01 A01/i);
  expect(result.used.deleted).toBe(false);
  expect(result.stillThere).toBe(true);
  expect(result.unused.error).toBeNull();
  expect(result.unused.deleted).toBe(true);
  expect(result.deleted10).toBe(true);
});

test('missing scene pattern still blocks deleting a pad-referenced sample',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(()=>window.__fakeEp.setProjectMissingPattern(2));
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 2 SAMPLES',{timeout:7000});
  const result=await page.evaluate(async()=>{
    const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
    const start=window.__fakeEp.requestLog.length;
    const action=async ops=>ops.deleteFile(8);
    Object.defineProperty(action,'sampleDependencyGuard',{value:{slots:[8],operation:'delete'}});
    let error='';
    try{await fs.withFileTransaction('referenced pad protected',action,{strict:true});}
    catch(e){error=String(e.message||e);}
    return{error,requests:window.__fakeEp.requestLog.slice(start),present:window.__fakeEp.snapshot().some(s=>s.id===8)};
  });
  expect(result.error).toMatch(/sample dependency safety lock.*slot 008.*P01 B01/i);
  expect(result.requests.some(r=>r.command===5&&r.sub===6)).toBe(false);
  expect(result.present).toBe(true);
});

test('malformed pad in any project still blocks sample deletion before MIDI FILE_DELETE',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(()=>{
    window.__fakeEp.seedSamples(15);
    window.__fakeEp.setProjectMalformedPad(2);
  });
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED · 15 SAMPLES',{timeout:12000});
  const result=await page.evaluate(async()=>{
    const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
    const start=window.__fakeEp.requestLog.length;
    const action=async ops=>ops.deleteFile(10);
    Object.defineProperty(action,'sampleDependencyGuard',{value:{slots:[10],operation:'delete'}});
    let error='';
    try{await fs.withFileTransaction('malformed pad protected',action,{strict:true});}
    catch(e){error=String(e.message||e);}
    return{error,requests:window.__fakeEp.requestLog.slice(start),present:window.__fakeEp.snapshot().some(s=>s.id===10)};
  });
  expect(result.error).toMatch(/pad-record size 3/i);
  expect(result.requests.some(r=>r.command===5&&r.sub===6)).toBe(false);
  expect(result.present).toBe(true);
});

test('My EP warns about project pad references and deletes only after explicit second consent',async({page})=>{
  await openMyEp(page);
  const slot=page.locator('[data-slot="7"]');
  const deleteCommands=()=>page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>
    item.command===5&&item.sub===6&&((item.raw[1]<<8)|item.raw[2])===7).length);
  const initial=await deleteCommands();
  await slot.click();
  await expect(slot).toHaveClass(/selected/);
  await slot.locator('[data-delete-row]').click();
  await expect(page.locator('#ep133-confirm-message')).toContainText('DELETE');
  await page.locator('#ep133-confirm-ok').click();
  await expect(page.locator('#ep133-confirm-message')).toContainText('P01 A01');
  await expect(page.locator('#ep133-confirm-message')).toContainText('WITHOUT THEIR SOUND');
  await expect(page.locator('#ep133-confirm-ok')).toHaveText('DELETE ANYWAY');
  await page.locator('#ep133-confirm-cancel').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  expect(await deleteCommands()).toBe(initial);
  expect(await page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===7))).toBe(true);

  await slot.click();
  await slot.locator('[data-delete-row]').click();
  await page.locator('#ep133-confirm-ok').click();
  await expect(page.locator('#ep133-confirm-ok')).toHaveText('DELETE ANYWAY');
  await page.locator('#ep133-confirm-ok').click();
  await expect.poll(async()=>await deleteCommands()).toBe(initial+1);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===7))).toBe(false);
  await expect(slot).toHaveClass(/empty/);
  // Deleting a sample must never silently rewrite its projects.
  expect(await page.evaluate(()=>window.__fakeEp.requestLog.some(item=>
    item.command===5&&item.sub===2))).toBe(false);
});

test('project-referenced sample is blocked before FILE_DELETE and reports project group pad locations',async({page})=>{
  await openMyEp(page);
  const result=await page.evaluate(async()=>{
    const filesystem=await import('./js/ep133/filesystem.js?v=20261001-1');
    const start=window.__fakeEp.requestLog.length;
    const operation=async fileOps=>fileOps.deleteFile(7);
    Object.defineProperty(operation,'sampleDependencyGuard',{
      value:{slots:[7],operation:'delete'}
    });
    let error='';
    try{await filesystem.withFileTransaction('dependency guard e2e',operation,{strict:true});}
    catch(reason){error=String(reason?.message||reason);}
    return{
      error,
      requests:window.__fakeEp.requestLog.slice(start),
      present:window.__fakeEp.snapshot().some(item=>item.id===7)
    };
  });

  expect(result.error).toMatch(/sample dependency safety lock.*slot 007.*P01 A01/i);
  expect(result.requests.some(item=>item.command===5&&item.sub===6)).toBe(false);
  expect(result.present).toBe(true);
});
