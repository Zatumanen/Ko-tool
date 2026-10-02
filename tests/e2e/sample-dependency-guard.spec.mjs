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
  await page.locator('[data-slot="7"]').click();
  await page.locator('[data-slot="7"] [data-delete-row]').click();
  await expect(page.locator('#ep133-confirm-dialog')).not.toHaveAttribute('hidden','');
  await page.locator('#ep133-confirm-ok').click();

  await expect.poll(()=>page.evaluate(()=>document.querySelector('#log-tab')?.textContent||''),{
    timeout:10000
  }).toMatch(/sample dependency safety lock.*slot 007.*P01 A01/i);
  expect(await page.evaluate(()=>window.__fakeEp.snapshot().some(item=>item.id===7))).toBe(true);
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/occupied/);
});
