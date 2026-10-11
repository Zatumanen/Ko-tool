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
