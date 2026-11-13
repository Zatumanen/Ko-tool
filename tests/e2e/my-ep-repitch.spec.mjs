import {test,expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const encoder=new TextEncoder();
const chunk=(id,payload)=>{
  const bytes=new Uint8Array(8+payload.length+(payload.length&1));
  bytes.set(encoder.encode(id));new DataView(bytes.buffer).setUint32(4,payload.length,true);
  bytes.set(payload,8);return bytes;
};
const wav=(pitch=-12, extra={}, frames=12)=>{
  const fmt=new Uint8Array(16),f=new DataView(fmt.buffer);
  f.setUint16(0,1,true);f.setUint16(2,1,true);f.setUint32(4,32000,true);
  f.setUint32(8,64000,true);f.setUint16(12,2,true);f.setUint16(14,16,true);
  const json=encoder.encode(JSON.stringify({'sound.pitch':pitch,'sound.playmode':'oneshot',...extra}));
  const tng=new Uint8Array(12+json.length);tng.set(encoder.encode('INFO'));
  tng.set(encoder.encode('TNGE'),4);new DataView(tng.buffer).setUint32(8,json.length,true);
  tng.set(json,12);
  const chunks=[chunk('fmt ',fmt),chunk('LIST',tng),chunk('data',new Uint8Array(frames*2))];
  const bytes=new Uint8Array(12+chunks.reduce((n,b)=>n+b.length,0));
  bytes.set(encoder.encode('RIFF'));new DataView(bytes.buffer).setUint32(4,bytes.length-8,true);
  bytes.set(encoder.encode('WAVE'),8);
  let at=12;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  return [...bytes];
};
const putRequests=requests=>requests.filter(r=>r.command===5&&r.sub===2);
const open=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
};
const dropBatch=async(page,slot,files)=>{
  await page.locator(`[data-slot="${slot}"]`).scrollIntoViewIfNeeded();
  await page.evaluate(({slot,files})=>{
    const target=document.querySelector(`[data-slot="${slot}"]`);
    if(!target)throw Error('Expected empty device slot');
    const dt=new DataTransfer();
    files.forEach(({name,bytes})=>dt.items.add(new File([new Uint8Array(bytes)],name,{type:'audio/wav'})));
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },{slot,files});
};
const drop=(page,slot,bytes)=>dropBatch(page,slot,[{name:'incoming.wav',bytes}]);

test('My EP REPITCH starts ON and user can switch it OFF without FILE mutation',async({page})=>{
  await open(page);
  const checkbox=page.locator('#ep133-repitch-enabled');
  await expect(checkbox).toBeChecked();
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  const requests=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start),before);
  expect(putRequests(requests)).toEqual([]);
});

test('unverified legacy -12 WAV requires explicit consent; cancellation causes zero PUT',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drop(page,50,wav(-12));
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await expect(page.locator('#ep133-confirm-message')).toContainText('no verified');
  await page.locator('#ep133-confirm-cancel').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  const requests=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start),before);
  expect(putRequests(requests)).toEqual([]);
});

test('damaged RIFF/TNGE fails before FILE PUT or user confirmation',async({page})=>{
  await open(page);
  const broken=wav(-12),pos=broken.findIndex((v,i)=>v===84&&broken[i+1]===78&&broken[i+2]===71&&broken[i+3]===69);
  expect(pos).toBeGreaterThan(0);
  // Change the metadata JSON length but leave the outer RIFF envelope intact.
  broken[pos+4]=0xff;broken[pos+5]=0xff;broken[pos+6]=0xff;broken[pos+7]=0x7f;
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drop(page,51,broken);
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const requests=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start),before);
  expect(putRequests(requests)).toEqual([]);
});


test('batch with a later unsupported loop refuses all files before FILE PUT',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await dropBatch(page,52,[
    {name:'old.wav',bytes:wav(-12)},
    {name:'unsafe.wav',bytes:wav(0,{'sound.loopstart':5})}
  ]);
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  const changes=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),before);
  expect(putRequests(changes)).toEqual([]);
});

test('content-verified SpeedUpperCut WAV is uploaded without a legacy prompt',async({page})=>{
  await open(page);
  const marked=await page.evaluate(async source=>{
    const {markSpeedUppercutWav}=await import('/js/ep133/repitchProvenance.js?v=20261113-1');
    return [...new Uint8Array(await (await markSpeedUppercutWav(new Blob([new Uint8Array(source)]))).arrayBuffer())];
  },wav(-12,{},4096));
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drop(page,54,marked);
  await expect(page.locator('[data-slot="54"]')).toHaveClass(/occupied/);
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  const changes=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),before);
  expect(putRequests(changes).length).toBeGreaterThan(0);
});

test('raw WAV REPITCH uploads compensation metadata through the fake EP transport',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await drop(page,55,wav(0,{},4096));
  await expect(page.locator('[data-slot="55"]')).toHaveClass(/occupied/);
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),
    sample:window.__fakeEp.snapshot().find(sample=>sample.id===55)
  }),before);
  expect(putRequests(result.requests).length).toBeGreaterThan(0);
  expect(result.sample?.meta?.['sound.pitch']).toBe(-12);
});
