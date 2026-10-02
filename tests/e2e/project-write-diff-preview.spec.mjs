import{test,expect}from'@playwright/test';
import path from'node:path';
import{fileURLToPath}from'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');
const installFake=page=>page.addInitScript({path:fakeEpScript});
const openMyEp=async page=>{
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect.poll(()=>page.evaluate(()=>{
    const status=document.querySelector('#ep133-status')?.textContent||'';
    const overlay=document.querySelector('#ep133-connection-overlay')?.textContent||'';
    return status.startsWith('SYNCED ·')&&!status.includes('LOADING')&&overlay===''?'SYNCED':status+'|'+overlay;
  }),{timeout:7000}).toBe('SYNCED');
};
const projectPutsSince=async(page,start)=>page.evaluate(index=>window.__fakeEp.requestLog.slice(index).filter(item=>
  item.command===5&&item.sub===2&&item.type===0
).length,start);

test('Verified Project Editor shows live TAR diff before PUT and cancellation is mutation-free',async({page})=>{
  await installFake(page);
  await openMyEp(page);
  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
  await page.locator('[data-project="02"]').click();
  await expect(page.locator('#ep133-project-edit')).toBeEnabled();
  await page.locator('#ep133-project-edit').click();
  await expect(page.locator('#ep133-project-editor-dialog')).toBeVisible();
  await page.locator('[data-editor-bpm]').fill('132');
  await expect(page.locator('#ep133-project-editor-save')).toBeEnabled();

  const beforePreview=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-project-editor-save').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible({timeout:10000});
  const message=page.locator('#ep133-confirm-message');
  await expect(message).toContainText('VERIFIED EDIT DIFF · P02');
  await expect(message).toContainText('MOD settings');
  await expect(message).toContainText('UNKNOWN 0/0 PRESERVED');
  await expect(message).toContainText('CRC ');
  expect(await projectPutsSince(page,beforePreview)).toBe(0);

  await page.locator('#ep133-confirm-cancel').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  await expect(page.locator('#ep133-project-editor-dialog')).toBeVisible();
  await expect(page.locator('#ep133-status')).toContainText('EDIT CANCELLED');
  expect(await projectPutsSince(page,beforePreview)).toBe(0);

  const beforeApproved=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-project-editor-save').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible({timeout:10000});
  await expect(page.locator('#ep133-confirm-message')).toContainText('MOD settings');
  expect(await projectPutsSince(page,beforeApproved)).toBe(0);
  await page.locator('#ep133-confirm-ok').click();
  await expect(page.locator('#ep133-project-editor-dialog')).toBeHidden({timeout:15000});
  await expect(page.locator('#ep133-status')).toContainText('PROJECT P02 · VERIFIED EDIT SAVED',{timeout:15000});
  expect(await projectPutsSince(page,beforeApproved)).toBe(1);
});
