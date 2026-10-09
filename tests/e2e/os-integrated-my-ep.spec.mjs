import {test,expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');
async function openIntegratedEp(page){
 await page.addInitScript({path:fakeEpScript});
 await page.goto('/os/index.html');
 await page.locator('[data-view=device]').click();
 const frame=page.frameLocator('#os-embedded-my-ep');
 await expect(frame.locator('#os-embedded-launch-button')).toBeVisible();
 expect(await frame.locator('body').evaluate(()=>window.__fakeEp?.midiAccessRequests.length)).toBe(0);
 await frame.locator('#os-embedded-launch-button').click();
 await expect(frame.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
 await expect.poll(()=>frame.locator('#ep133-status').textContent(),{timeout:18000}).toContain('SYNCED');
 await expect(page.locator('#os-runtime-label')).toContainText('READY',{timeout:12000});
 return frame;
}

test('My EP connects and keeps its actual browser and session inside the single OS tab',async({page,context})=>{
 const frame=await openIntegratedEp(page);
 await expect(frame.locator('.ep133-sample-row.occupied')).toHaveCount(2);
 await expect(page.locator('#os-diag-model')).toHaveText('TE032AS001');
 await expect(page.locator('#os-diag-firmware')).toHaveText('2.5.1');
 await expect(frame.locator('[data-slot="7"]')).toHaveClass(/occupied/);
 await frame.locator('#ep133-view-projects').click();
 await expect(frame.locator('#ep133-projects-panel')).toBeVisible();
 await expect(frame.locator('.ep-project-row')).toHaveCount(2,{timeout:16000});
 await expect(page.locator('#os-runtime-label')).toContainText('READY',{timeout:20000});
 await page.locator('[data-view=samples]').click();
 await expect(page.locator('#os-device-dock')).toBeHidden();
 await page.locator('[data-view=device]').click();
 await expect(page.locator('#os-device-dock')).toBeVisible();
 await expect(frame.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
 await expect(frame.locator('#ep133-view-projects')).toHaveAttribute('aria-selected','true');
 expect(await frame.locator('body').evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(1);
 expect(context.pages().length).toBe(1);
});

test('embedded My EP keeps guarded operations and prevents navigation while FILE mutation is active',async({page})=>{
 const frame=await openIntegratedEp(page);
 await frame.locator('#ep133-browser').evaluate(async()=>{
  const {deviceRuntime}=await import('/js/ep133/deviceRuntime.js');
  deviceRuntime.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:deviceRuntime.captureEpoch(),operationId:'e2e-ui-guard',mode:'mutation',label:'Sample transfer in progress'});
 });
 await expect(page.locator('#os-runtime-label')).toContainText('WRITING',{timeout:6000});
 await page.locator('[data-view=samples]').click();
 await expect(page).toHaveURL(/#os-device$/);
 await expect(page.locator('#os-device-dock')).toBeVisible();
 await frame.locator('#ep133-browser').evaluate(async()=>{
  const {deviceRuntime}=await import('/js/ep133/deviceRuntime.js');
  deviceRuntime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:deviceRuntime.captureEpoch(),operationId:'e2e-ui-guard'});
 });
 await expect(page.locator('#os-runtime-label')).toContainText('READY',{timeout:6000});
 await page.locator('[data-view=samples]').click();
 await expect(page.locator('#os-device-dock')).toBeHidden();
 await expect(page.getByRole('heading',{name:'Sample laboratory'})).toBeVisible();
});


test('original verified sample upload works from the embedded My EP without leaving OS',async({page,context})=>{
 const frame=await openIntegratedEp(page);
 const frames=140;
 const data=Buffer.alloc(44+frames*2);
 data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
 data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(46875,24);data.writeUInt32LE(93750,28);
 data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)data.writeInt16LE(Math.round(Math.sin(i/8)*10000),44+i*2);
 await frame.locator('[data-slot="9"]').evaluate((row,bytes)=>{
  const file=new File([new Uint8Array(bytes)],'integrated-test.wav',{type:'audio/wav'});
  const dt=new DataTransfer();dt.items.add(file);
  row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
 },[...data]);
 await expect.poll(()=>frame.locator('body').evaluate(()=>
  window.__fakeEp.snapshot().some(s=>s.id===9)),{timeout:15000}).toBe(true);
 await expect(frame.locator('[data-slot="9"]')).toHaveClass(/occupied/);
 await expect(page.locator('#os-runtime-label')).toContainText('READY',{timeout:12000});
 expect(context.pages().length).toBe(1);
});
