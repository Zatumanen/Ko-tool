import {test,expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fakeScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');

test('live My EP status appears across OS workspaces and expires when publisher closes',async({context})=>{
 const os=await context.newPage();
 const ep=await context.newPage();
 await ep.addInitScript({path:fakeScript});
 await os.goto('/os/index.html');
 await expect(os.locator('#os-runtime-label')).toHaveText('NO DEVICE SESSION');
 await ep.goto('/');
 await ep.locator('#my-ep-icon').click();
 await expect(ep.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
 await expect.poll(()=>ep.locator('#ep133-status').textContent(),{timeout:16000}).toContain('SYNCED');
 await expect(os.locator('#os-runtime-label')).toContainText('EP-133 KO II',{timeout:15000});
 await expect(os.locator('#os-runtime-label')).toContainText('READY',{timeout:15000});
 await os.locator('[data-view=projects]').click();
 await expect(os.locator('#os-runtime-label')).toContainText('READY');
 await os.locator('#os-runtime-trigger').click();
 await expect(os).toHaveURL(/#os-device$/);
 await expect(os.locator('#os-diag-model')).toHaveText('TE032AS001');
 await expect(os.locator('#os-diag-firmware')).toHaveText('2.5.1');
 await expect(os.locator('#os-diag-recovery')).toHaveText('CHECKED');
 await expect(os.locator('#os-diag-connection')).toHaveText('READY');
 await ep.close();
 await expect(os.locator('#os-runtime-label')).toHaveText('NO DEVICE SESSION',{timeout:12000});
 await expect(os.locator('#os-diag-connection')).toHaveText('UNAVAILABLE');
 await expect(os.locator('#os-diag-model')).toHaveText('—');
});

test('unsafe and recovery-needed status are reflected without any OS device writes',async({context})=>{
 const os=await context.newPage(),ep=await context.newPage();
 await ep.addInitScript({path:fakeScript});
 await os.goto('/os/index.html');
 await ep.goto('/');
 await ep.locator('#my-ep-icon').click();
 await expect(os.locator('#os-runtime-label')).toContainText('READY',{timeout:18000});
 await ep.evaluate(async()=>{
  const {deviceRuntime}=await import('/js/ep133/deviceRuntime.js');
  deviceRuntime.dispatch({type:'RECOVERY_REQUIRED',connectionEpoch:deviceRuntime.captureEpoch(),transactionId:'demo-recovery',reason:'Verify interrupted sample transfer'});
 });
 await expect(os.locator('#os-runtime-label')).toContainText('RECOVERY REQUIRED');
 await os.locator('#os-runtime-trigger').click();
 await expect(os.locator('#os-diag-recovery')).toHaveText('REQUIRED');
 await expect(os.locator('#os-diag-reason')).toContainText('operation that needs review');
 await expect(os.locator('#os-diag-reason')).not.toContainText('Verify interrupted sample transfer');
 await expect(os.locator('#os-diag-technical')).toBeHidden();
 await os.locator('.os-diagnostic-technical summary').click();
 await expect(os.locator('#os-diag-technical')).toContainText('Verify interrupted sample transfer');
 await ep.evaluate(async()=>{
  const {deviceRuntime}=await import('/js/ep133/deviceRuntime.js');
  deviceRuntime.dispatch({type:'DEVICE_MARKED_UNSAFE',connectionEpoch:deviceRuntime.captureEpoch(),reason:'Session cannot be verified'});
 });
 await expect(os.locator('#os-runtime-label')).toContainText('UNSAFE');
 await expect(os.locator('#os-diag-recovery')).toHaveText('UNSAFE');
});
