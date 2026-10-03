import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');

const openMyEp=async page=>{
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect.poll(()=>page.locator('[data-workspace-connection]').textContent(),{timeout:7000}).toContain('CONNECTED');
};

test('sample recovery verifies authoritative device state and only clears warning after explicit acknowledgment',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  await openMyEp(page);
  await page.evaluate(async()=>{
    const recovery=await import('./js/ep133/sampleRecovery.js?v=20261001-1');
    const device=await import('./js/ep133/device.js?v=20261001-1');
    const store=recovery.createBrowserSampleRecoveryStore();
    const transaction=recovery.createSampleRecoveryTransaction({
      device:device.getConnectedDeviceInfo(),operation:'delete',label:'sample delete transaction',slots:[7]
    });
    await store.saveTransaction(transaction);
    await store.updateTransaction(transaction.id,{
      status:'requires-recovery',transactionStatus:'requires-recovery',
      recoveryDetail:{requiresRecovery:true,reason:'Delete state must be checked.'}
    });
  });
  await expect(page.locator('[data-workspace-recovery]'),{timeout:6000}).toContainText('RECOVERY REQUIRED');
  await page.locator('#ep133-view-projects').click();
  await page.locator('#ep133-project-recovery').click();
  await expect(page.locator('#ep133-sample-recovery-section')).toBeVisible();
  await expect(page.locator('#ep133-sample-recovery-list .ep-sample-recovery-row')).toHaveCount(1);
  await page.locator('#ep133-sample-recovery-verify').click();
  await expect(page.locator('#ep133-sample-recovery-detail')).toContainText('DELETE-NOT-VISIBLE');
  await expect(page.locator('#ep133-sample-recovery-detail')).toContainText('007');
  await expect(page.locator('#ep133-sample-recovery-detail')).toContainText('PRESENT');
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-sample-recovery-ack').click();
  await expect(page.locator('#ep133-sample-recovery-detail')).toContainText('ACKNOWLEDGED');
  await expect(page.locator('[data-workspace-recovery]'),{timeout:6000}).toHaveText('RECOVERY · NONE');
  const mutations=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).filter(item=>
    item.command===5&&(item.sub===2||item.sub===6||item.sub===12||(item.sub===7&&item.type===1))
  ),before);
  expect(mutations).toEqual([]);
});
