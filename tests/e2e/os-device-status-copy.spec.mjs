import {test,expect} from '@playwright/test';

const base={connection:'connected',ownership:'owned',safety:'safe',
 phase:'idle',sku:'TE032AS001',firmware:'2.5.1',operation:null,
 reason:null,recoveryHydrated:true,status:'ready'};

async function report(page,override={}){
 await page.evaluate(data=>{
  window.__osCopySource ||= new BroadcastChannel('speeduppercut-os-device-status-v1');
  window.__osCopySeq=(window.__osCopySeq||0)+1;
  window.__osCopySource.postMessage({
   version:1,type:'status',source:'z18-e2e-status',seq:window.__osCopySeq,data
  });
 },{...base,...override});
}

test('U1 status copy explains unsafe and recovery states without surfacing raw device text',async({page})=>{
 await page.goto('/os/index.html#os-device');
 await expect(page.locator('#os-diag-heading')).toHaveText('Device status unavailable');
 await expect(page.locator('#os-diag-next')).toContainText('connect explicitly');
 const marker='private FID/CRC diagnostic details should not be global';
 await report(page,{status:'unsafe',safety:'unsafe',reason:marker});
 await expect(page.locator('#os-diag-heading')).toHaveText('Device state uncertain');
 await expect(page.locator('#os-diag-next')).toContainText('Do not reconnect or repeat a write blindly');
 await expect(page.locator('#assistant-heading')).toHaveText('Device state uncertain');
 await expect(page.locator('#os-runtime-label')).toContainText('UNSAFE');
 await expect(page.locator('#os-diag-reason')).not.toContainText('FID/CRC');
 await expect(page.locator('#assistant-copy')).not.toContainText('FID/CRC');
 await expect(page.locator('#os-runtime-subtitle')).not.toContainText('FID/CRC');
 await expect(page.locator('.os-diagnostic-technical')).not.toHaveAttribute('open');
 await expect(page.locator('#os-diag-technical')).toBeHidden();
 await page.locator('.os-diagnostic-technical summary').click();
 await expect(page.locator('#os-diag-technical')).toHaveText(marker);
 await report(page,{status:'recovery-required',safety:'recovery-required',reason:'recovery transaction 21'});
 await expect(page.locator('#os-diag-heading')).toHaveText('Device recovery needed');
 await expect(page.locator('#os-diag-next')).toContainText('Follow only the actions it explicitly offers');
 await page.locator('[data-view=samples]').click();
 await expect(page.locator('#assistant-heading')).toHaveText('Device recovery needed');
 await expect(page.locator('#assistant-copy')).not.toContainText('transaction 21');
 await expect(page.locator('#os-runtime-label')).toContainText('RECOVERY REQUIRED');
});

test('U1 status copy represents ready, busy and stale status without claiming write approval',async({page})=>{
 await page.goto('/os/index.html#os-device');
 await report(page);
 await expect(page.locator('#os-diag-heading')).toHaveText('Device session ready');
 await expect(page.locator('#os-diag-next')).toContainText('its own compatibility checks and confirmation');
 await report(page,{status:'mutating',phase:'mutating',operation:'Transfer 8 / 30'});
 await expect(page.locator('#os-diag-heading')).toHaveText('Changing device data');
 await expect(page.locator('#os-diag-next')).toContainText('Do not disconnect');
 await expect(page.locator('#os-diag-operation')).toHaveText('Transfer 8 / 30');
 await report(page,{status:'verifying',phase:'verifying'});
 await expect(page.locator('#os-diag-heading')).toHaveText('Checking device changes');
 await expect(page.locator('#os-diag-next')).toContainText('until My EP confirms success');
 await report(page,{status:'blocked',ownership:'blocked',safety:'blocked',reason:'FILE ownership internal'});
 await expect(page.locator('#os-diag-heading')).toHaveText('Device access restricted');
 await expect(page.locator('#os-diag-reason')).not.toContainText('FILE ownership internal');
});
