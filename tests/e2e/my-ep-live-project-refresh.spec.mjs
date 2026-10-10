import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEp=path.join(here,'fake-ep-browser.js');
const setup=async page=>{
  await page.addInitScript({path:fakeEp});
  // Trigger the real controller's 20s callback deterministically without
  // burning extra 20-second windows in a fake-browser integration test.
  await page.addInitScript(()=>{
    const original=window.setInterval.bind(window);
    window.setInterval=(callback,delay,...args)=>{
      if(delay===20000){
        window.__projectAutoRefreshTick=callback;
        return original(()=>{},2147483647);
      }
      return original(callback,delay,...args);
    };
  });
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('#ep133-project-inspector')).toContainText('123.5',{timeout:12000});
  expect(await page.evaluate(()=>typeof window.__projectAutoRefreshTick)).toBe('function');
};

test('saved on-device project changes appear automatically without pressing Refresh',async({page})=>{
 await setup(page);
 const oldSize=await page.evaluate(()=>window.__fakeEp.projectSnapshot()[0].size);
 const oldRequests=await page.evaluate(()=>window.__fakeEp.requestLog.length);
 await page.evaluate(()=>window.__fakeEp.changeProjectBpm(1,147.25));
 expect(await page.evaluate(()=>window.__fakeEp.projectSnapshot()[0].size)).toBe(oldSize);
 await expect(page.locator('#ep133-project-inspector')).toContainText('123.5');
 await page.evaluate(()=>window.__projectAutoRefreshTick());
 await expect(page.locator('#ep133-project-inspector')).toContainText('147.25',{timeout:16000});
 await expect(page.locator('#ep133-status')).toContainText('UPDATED FROM EP');
 const delta=await page.evaluate(before=>window.__fakeEp.requestLog.slice(before),oldRequests);
 expect(delta.length).toBeGreaterThan(0);
 expect(delta.some(x=>x.command===5&&[3,6,7,8,9,10].includes(x.sub))).toBe(false);
});

test('automatic project reads stop on Samples tab and resume when Projects tab is active',async({page})=>{
 await setup(page);
 await page.locator('#ep133-view-samples').click();
 const baseline=await page.evaluate(()=>window.__fakeEp.requestLog.length);
 await page.evaluate(()=>window.__fakeEp.changeProjectBpm(1,155));
 await page.evaluate(()=>window.__projectAutoRefreshTick());
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>window.__fakeEp.requestLog.length)).toBe(baseline);
 await page.locator('#ep133-view-projects').click();
 await page.evaluate(()=>window.__projectAutoRefreshTick());
 await expect(page.locator('#ep133-project-inspector')).toContainText('155',{timeout:16000});
});

test('auto refresh retains last known project on transient MIDI read failures',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.__fakeEp.disconnect());
 await page.evaluate(()=>window.__projectAutoRefreshTick());
 await expect(page.locator('#ep133-project-inspector')).not.toContainText('COULD NOT READ PROJECT');
 // Reconnection remains subject to the original session/permission safeguards.
});
