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
