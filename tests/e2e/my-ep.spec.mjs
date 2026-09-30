import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');

const installFake=async page=>{
  await page.addInitScript({path:fakeEpScript});
};

const openMyEp=async page=>{
  await page.goto('/');
  expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.midiAccessRequests.length),{
    message:'My EP should request Web MIDI after acquiring the device session'
  }).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.requestCount),{
    message:'Fake EP should receive GREET after identity discovery'
  }).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>{
    const status=document.querySelector('#ep133-status')?.textContent||'';
    const overlay=document.querySelector('#ep133-connection-overlay')?.textContent||'';
    if(status.startsWith('SYNCED ·')&&!status.includes('LOADING')&&overlay==='')return'SYNCED';
    return JSON.stringify({
      status,
      overlay,
      error:document.querySelector('#error-message')?.textContent||document.querySelector('.error-message')?.textContent||'',
      requests:window.__fakeEp.requestLog,
      snapshot:window.__fakeEp.snapshot()
    });
  }),{message:'My EP should finish GREET and sample-library bootstrap',timeout:7000}).toBe('SYNCED');
  await expect(page.locator('.ep133-sample-row.occupied')).toHaveCount(2);
};

const wav16Mono=(sampleRate=46875,frames=64)=>{
  const dataSize=frames*2;
  const buffer=Buffer.alloc(44+dataSize);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataSize,4);buffer.write('WAVE',8);
  buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);
  buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(dataSize,40);
  for(let i=0;i<frames;i++)buffer.writeInt16LE(Math.round(Math.sin(i/5)*12000),44+i*2);
  return [...buffer];
};

test('My EP connects, syncs, searches, renames, uploads, moves and deletes through the real DOM',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick808');
  await expect(page.locator('[data-slot="8"] [data-name-input]')).toHaveValue('snare');

  await page.locator('#ep133-sample-search').fill('snare');
  await expect(page.locator('[data-slot="8"]')).toHaveClass(/search-match/);
  await page.locator('#ep133-search-clear').click();

  const name=page.locator('[data-slot="7"] [data-name-input]');
  await name.dblclick();
  await expect(page.locator('[data-slot="7"] [data-name-input]')).not.toHaveAttribute('readonly','');
  await page.locator('[data-slot="7"] [data-name-input]').fill('kick-new');
  await page.locator('[data-slot="7"] [data-name-input]').press('Enter');
  await expect.poll(()=>page.evaluate(()=>{
    const mutation=window.__fakeEp.requestLog.find(item=>item.command===5&&item.sub===7&&item.type===1);
    const error=document.querySelector('#error-message')?.textContent||'';
    const technical=document.querySelector('#log-tab')?.textContent||'';
    return mutation?{sent:true,id:(mutation.raw[2]<<8)|mutation.raw[3],raw:mutation.raw}:{
      sent:false,error,technical,requests:window.__fakeEp.requestLog
    };
  }),{message:'Rename should send FILE METADATA SET',timeout:7000}).toMatchObject({sent:true,id:7});
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(x=>x.id===7)?.meta?.name),{
    message:'Fake EP should commit renamed metadata after METADATA SET'
  }).toBe('kick-new');
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick-new');

  const wav=wav16Mono();
  await page.evaluate(bytes=>{
    const file=new File([new Uint8Array(bytes)],'hat.wav',{type:'audio/wav'});
    const dt=new DataTransfer();dt.items.add(file);
    const row=document.querySelector('[data-slot="9"]');
    row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },wav);
  await expect.poll(()=>page.evaluate(()=>{
    const snapshot=window.__fakeEp.snapshot();
    if(snapshot.some(x=>x.id===9))return'uploaded';
    return JSON.stringify({
      error:document.querySelector('#error-message')?.textContent||document.querySelector('.error-message')?.textContent||'',
      technical:document.querySelector('#log-tab')?.textContent||'',
      requests:window.__fakeEp.requestLog,
      snapshot
    });
  }),{message:'WAV drop should complete FILE PUT into slot 9',timeout:10000}).toBe('uploaded');
  await expect(page.locator('[data-slot="9"]')).toHaveClass(/occupied/);

  await page.locator('[data-slot="8"]').dragTo(page.locator('[data-slot="10"]'));
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===10))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===8))).toBe(false);
  await expect(page.locator('[data-slot="10"]')).toHaveClass(/occupied/);
  await expect(page.locator('[data-slot="8"]')).toHaveClass(/empty/);

  await page.locator('[data-slot="10"]').click();
  await page.locator('[data-slot="10"] [data-delete-row]').click();
  await expect(page.locator('#ep133-confirm-dialog')).not.toHaveAttribute('hidden','');
  await page.locator('#ep133-confirm-ok').click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===10))).toBe(false);
  await expect(page.locator('[data-slot="10"]')).toHaveClass(/empty/);

  expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests)).toEqual([{sysex:true}]);
});

test('a second Ko-tool tab is blocked while the first tab owns the EP session',async({context})=>{
  const first=await context.newPage();
  const second=await context.newPage();
  await installFake(first);
  await installFake(second);
  await openMyEp(first);

  await second.goto('/');
  await second.locator('#my-ep-icon').click();
  await expect(second.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(second.locator('#ep133-connection-overlay')).toHaveText('OPEN IN ANOTHER KO-TOOL TAB');
  expect(await second.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);

  await first.close();
  await second.locator('#ep133-close').click();
  await second.locator('#my-ep-icon').click();
  await expect(second.locator('#ep133-connection-overlay')).toHaveText('');
  await expect(second.locator('#ep133-status')).toContainText('SYNCED');
  expect(await second.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(1);
});

test('strict mutation firmware debug enters the unsafe recovery state in the browser',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await page.evaluate(()=>window.__fakeEp.debugNextMutation());
  const input=page.locator('[data-slot="7"] [data-name-input]');
  await input.dblclick();
  await page.locator('[data-slot="7"] [data-name-input]').fill('unsafe-test');
  await page.locator('[data-slot="7"] [data-name-input]').press('Enter');
  await expect.poll(()=>page.evaluate(()=>{
    const sent=window.__fakeEp.requestLog.some(item=>item.command===5&&item.sub===7&&item.type===1);
    return sent?'sent':JSON.stringify({
      error:document.querySelector('#error-message')?.textContent||'',
      technical:document.querySelector('#log-tab')?.textContent||'',
      requests:window.__fakeEp.requestLog
    });
  }),{
    message:'Unsafe scenario should reach the strict METADATA SET mutation',
    timeout:7000
  }).toBe('sent');

  await expect(page.locator('#ep133-connection-overlay')).toHaveText('POWER CYCLE EP · THEN RELOAD');
  await expect(page.locator('#ep133-status')).toContainText('EP FILE SAFETY LOCK');
  await expect(page.locator('#ep133-browser')).toHaveClass(/device-disconnected/);
});
