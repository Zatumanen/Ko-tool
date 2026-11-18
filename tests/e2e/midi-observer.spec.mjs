import{test,expect}from '@playwright/test';
import{fileURLToPath}from 'node:url';
const fake=fileURLToPath(new URL('./fake-ep-browser.js',import.meta.url));
const prepare=async page=>{
 await page.addInitScript({path:fake});await page.goto('/');
 await page.evaluate(async()=>{
  window.__midi=await import('./js/ep133/device.js?v=20261001-1');
  window.__observed=[];window.__resets=0;
  window.__subscribe=()=>window.__midi.subscribeMidiEvents(batch=>window.__observed.push(batch),{capacity:8,onReset:()=>window.__resets++});
  window.__subscription=window.__subscribe();window.__fakeEp.addForeignMidiInput();
 });
 // Merely subscribing does not request MIDI or send discovery traffic.
 expect(await page.evaluate(()=>({access:window.__fakeEp.midiAccessRequests.length,sent:window.__fakeEp.sentMidi().length}))).toEqual({access:0,sent:0});
 await page.locator('#my-ep-icon').click();await expect(page.locator('#ep133-status')).toContainText('SYNCED ·');
 await expect(page.locator('#ep133-global-progress')).toBeHidden();
};
const barrier=async(page)=>{
 const timestamp=await page.evaluate(()=>{window.__barrier=(window.__barrier||100000)+1;window.__fakeEp.emitMidi([0xFC],window.__barrier);return window.__barrier;});
 await expect.poll(()=>page.evaluate(t=>window.__observed.flatMap(b=>b.events).some(e=>e.timestamp===t),timestamp)).toBe(true);
};
test('passive MIDI batches only the selected EP input and remains silent during Clock and FILE traffic',async({page})=>{
 await prepare(page);
 const before=await page.evaluate(()=>({access:window.__fakeEp.midiAccessRequests.length,sent:window.__fakeEp.sentMidi().length}));
 await page.evaluate(()=>{
  const f=window.__fakeEp;
  f.emitForeignMidi([0x90,60,127],99);f.emitMidi([0x90,60],100);f.emitMidi([0xF8,0],101);
  for(let i=0;i<2000;i++)f.emitMidi([0xF8],i+1000);
  f.emitMidi([0x92,61,100],12.25);f.emitMidi([0x9F,61,0],13.25);f.emitMidi([0x81,60,73],14.25);
  f.emitMidi([0xFA],15);f.emitMidi([0xFB],16);f.emitMidi([0xF2,1,2],17);
 });
 await barrier(page);
 const batches=await page.evaluate(()=>window.__observed);
 expect(batches.flatMap(b=>b.events).map(e=>e.type)).toContain('song-position');
 expect(batches.every(b=>b.events.length<=8)).toBe(true);expect(batches.some(b=>b.dropped>0)).toBe(true);
 const events=batches.flatMap(b=>b.events);
 expect(events.find(e=>e.timestamp===12.25)).toMatchObject({type:'note-on',channel:3,note:61,velocity:100});
 expect(events.find(e=>e.timestamp===13.25)).toMatchObject({type:'note-off',channel:16,velocity:0});
 expect(events.find(e=>e.type==='song-position').position).toBe(257);
 expect(events.some(e=>[99,100,101].includes(e.timestamp))).toBe(false);
 expect(JSON.stringify(batches)).not.toMatch(/foreign-private|e2e-input|serial|deviceKey/);
 expect(await page.evaluate(()=>({access:window.__fakeEp.midiAccessRequests.length,sent:window.__fakeEp.sentMidi().length}))).toEqual(before);
 // Clock arrives while an actual guarded FILE_GET is held; it must not take its lease or disturb SysEx replies.
 await page.evaluate(async()=>{
  const fs=await import('./js/ep133/filesystem.js?v=20261001-1');
  window.__fakeEp.holdNextGet(7);window.__fileRead=fs.getFile(7);
 });
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.hasHeldGet)).toBe(true);
 await page.evaluate(()=>{for(let i=0;i<100;i++)window.__fakeEp.emitMidi([0xF8],4000+i);window.__fakeEp.releaseHeldGet();});
 expect(await page.evaluate(async()=>Array.from((await window.__fileRead).data))).toEqual(await page.evaluate(()=>window.__fakeEp.sampleBytes(7)));
 await barrier(page);
 expect(await page.evaluate(()=>window.__fakeEp.requestLog.filter(x=>x.command===5&&(x.sub===2||x.sub===6||x.sub===12||(x.sub===7&&x.type===1))))).toEqual([]);
});
test('epoch, ownership, identity, port replacement, disconnect and unsubscribe invalidate pending MIDI',async({page})=>{
 await prepare(page);
 await page.evaluate(async()=>{
  window.__fakeEp.captureMidiListeners();window.__fakeEp.emitMidi([0x90,1,1],1);
  window.__midi.disconnectEp133();await window.__midi.connectEp133();
 });
 await expect(page.locator('#ep133-status')).toContainText('SYNCED ·');await expect(page.locator('#ep133-global-progress')).toBeHidden();
 await page.evaluate(()=>{window.__fakeEp.emitStaleMidi([0x90,2,2],2);window.__fakeEp.emitMidi([0x91,3,3],3);});
 await barrier(page);
 expect(await page.evaluate(()=>window.__observed.flatMap(b=>b.events).filter(e=>e.timestamp<=3).map(e=>e.timestamp))).toEqual([3]);
 await page.evaluate(async()=>{
  const runtime=await import('./js/ep133/deviceRuntime.js');
  runtime.dispatchDeviceRuntimeEvent({type:'OWNERSHIP_LOST'});window.__fakeEp.emitMidi([0x90,4,4],4);
  runtime.dispatchDeviceRuntimeEvent({type:'OWNERSHIP_ACQUIRED'});
  window.__subscription.unsubscribe();window.__fakeEp.emitMidi([0x90,5,5],5);
  window.__subscription=window.__subscribe();window.__fakeEp.emitMidi([0x90,6,6],6);window.__subscription.clear();
  window.__midi.disconnectEp133();window.__fakeEp.replaceMidiInput();await window.__midi.connectEp133();
 });
 await expect(page.locator('#ep133-status')).toContainText('SYNCED ·');await expect(page.locator('#ep133-global-progress')).toBeHidden();
 await page.evaluate(()=>{window.__fakeEp.emitStaleMidi([0x90,7,7],7);window.__fakeEp.emitMidi([0x90,8,8],8);});
 await barrier(page);
 expect(await page.evaluate(()=>window.__observed.flatMap(b=>b.events).filter(e=>e.timestamp>=4&&e.timestamp<=8).map(e=>e.timestamp))).toEqual([8]);
 const seen=await page.evaluate(()=>window.__observed.flatMap(b=>b.events).filter(e=>e.timestamp===3||e.timestamp===8));
 expect(seen[0].session).not.toBe(seen[1].session);expect(seen[0].connectionEpoch).not.toBe(seen[1].connectionEpoch);
 await page.evaluate(async()=>{
  const rt=await import('./js/ep133/deviceRuntime.js'),s=rt.getDeviceRuntimeSnapshot(),epoch=s.connection.epoch,original=s.connection.device;
  for(const[device,timestamp]of [[{...original,sku:'TE032AS006'},40],[{...original,firmware:'9.9.9'},41],[original,42]]){
   rt.dispatchDeviceRuntimeEvent({type:'DEVICE_CONNECTED',connectionEpoch:epoch,device});
   rt.dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:epoch});
   window.__fakeEp.emitMidi([0x90,11,11],timestamp);
  }
 });
 await barrier(page);
 expect(await page.evaluate(()=>window.__observed.flatMap(b=>b.events).filter(e=>e.timestamp>=40&&e.timestamp<=42).map(e=>e.timestamp))).toEqual([42]);
 await page.evaluate(()=>{window.__fakeEp.emitMidi([0x90,9,9],9);window.__fakeEp.disconnect();window.__fakeEp.emitMidi([0x90,10,10],10);});
 await expect(page.locator('#ep133-connection-overlay')).not.toHaveText('');
 expect(await page.evaluate(()=>window.__resets)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__observed.flatMap(b=>b.events).some(e=>e.timestamp===9||e.timestamp===10))).toBe(false);
});
