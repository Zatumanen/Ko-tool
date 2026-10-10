import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');
const STORAGE_KEY='speeduppercut-my-ep-workspace-v1';

const openWorkspace=async page=>{
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#ep133-workspace-status')).toBeVisible();
  await expect.poll(()=>page.locator('[data-workspace-connection]').textContent(),{timeout:7000}).toContain('CONNECTED');
};

test('My EP workspace persists safe UI state while live coordinator and recovery state stay authoritative',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.addInitScript(key=>{
    localStorage.setItem(key,JSON.stringify({
      version:1,
      viewMode:'projects',
      lastDevice:{sku:'TE032AS002',firmware:'2.5.1'},
      lastOperation:{label:'previous upload',status:'succeeded',at:1},
      connection:{status:'connected'},
      coordinator:{state:'mutating',active:{label:'stale mutation'}}
    }));
  },STORAGE_KEY);

  await page.goto('/');
  await openWorkspace(page);
  await expect(page.locator('#ep133-view-projects')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-workspace-last]')).toContainText('PREVIOUS UPLOAD');

  await page.evaluate(()=>{
    window.__workspaceHold=import('./js/ep133/fileTransport.js?v=20261001-1').then(module=>
      module.withFileTransportTransaction('workspace hold',()=>new Promise(resolve=>setTimeout(resolve,700)),{strict:true})
    );
  });
  await expect(page.locator('[data-workspace-operation]')).toContainText('MUTATING');
  await expect(page.locator('[data-workspace-operation]')).toContainText('WORKSPACE HOLD');
  await page.evaluate(()=>window.__workspaceHold);
  await expect(page.locator('[data-workspace-operation]')).toHaveText('READY');
  await expect(page.locator('[data-workspace-last]')).toContainText('WORKSPACE HOLD');

  await page.evaluate(async()=>{
    const recovery=await import('./js/ep133/sampleRecovery.js?v=20261001-1');
    const device=await import('./js/ep133/device.js?v=20261001-1');
    const store=recovery.createBrowserSampleRecoveryStore();
    const transaction=recovery.createSampleRecoveryTransaction({
      device:device.getConnectedDeviceInfo(),
      operation:'delete',
      label:'sample delete transaction',
      slots:[7]
    });
    await store.saveTransaction(transaction);
    await store.updateTransaction(transaction.id,{
      status:'requires-recovery',
      transactionStatus:'requires-recovery',
      recoveryDetail:{requiresRecovery:true}
    });
  });
  await expect(page.locator('[data-workspace-recovery]'),{timeout:6000}).toContainText('RECOVERY REQUIRED');
  await expect(page.locator('[data-workspace-recovery]')).toContainText('SAMPLE 1');

  const persisted=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  expect(persisted).not.toContain('coordinator');
  expect(persisted).not.toContain('connected');
  expect(persisted).not.toContain('serial');

  await page.reload();
  await openWorkspace(page);
  await expect(page.locator('#ep133-view-projects')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-workspace-operation]')).not.toContainText('MUTATING');
  await expect(page.locator('[data-workspace-recovery]'),{timeout:6000}).toContainText('RECOVERY REQUIRED');
});


test('My EP hides last-operation protocol details behind disclosure and never enables recovery blindly',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await openWorkspace(page);
  await expect(page.locator('[data-workspace-guidance-title]')).toHaveText('Device connected');
  await expect(page.locator('[data-workspace-review-recovery]')).toBeHidden();
  await page.evaluate(()=>{
    window.__speeduppercutMyEpWorkspace.recordOperation({
      label:'sample transfer',status:'requires-recovery',at:Date.now(),
      error:{code:'EP_FILE_OPERATION_FAILED',category:'protocol',recovery:'Technical CRC data requires inspection'}
    });
  });
  await expect(page.locator('[data-workspace-last]')).toContainText('SAMPLE TRANSFER');
  await expect(page.locator('[data-workspace-last]')).not.toContainText('EP_FILE_OPERATION_FAILED');
  await expect(page.locator('[data-workspace-guidance]')).not.toContainText('Technical CRC');
  await expect(page.locator('[data-workspace-details]')).not.toHaveAttribute('open');
  await expect(page.locator('[data-workspace-technical]')).toBeHidden();
  await page.locator('[data-workspace-details] summary').click();
  await expect(page.locator('[data-workspace-technical]')).toContainText('EP_FILE_OPERATION_FAILED');
  await expect(page.locator('[data-workspace-technical]')).toContainText('Technical CRC data requires inspection');
  await expect(page.locator('[data-workspace-review-recovery]')).toBeHidden();
});
