import{test,expect}from '@playwright/test';
import fs from 'node:fs/promises';
async function open(page,channels=2,{denied=false}={}){
 await page.addInitScript(({channels,denied})=>{
  const t=window.__recordTest={requests:0};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:Object.assign(new EventTarget(),{
   enumerateDevices:async()=>[{kind:'audioinput',deviceId:'record-source',label:'Selected recording input'}],
   getUserMedia:async c=>{
    t.requests++;if(denied)throw Object.assign(Error('Denied'),{name:'NotAllowedError'});if(c.audio.deviceId.exact!=='record-source')throw Error('wrong source');
    const ctx=new AudioContext(),dest=ctx.createMediaStreamDestination(),left=ctx.createConstantSource(),right=ctx.createConstantSource();dest.channelCount=channels;dest.channelCountMode='explicit';left.offset.value=.5;right.offset.value=-.25;left.start();right.start();
    if(channels===2){const merge=ctx.createChannelMerger(2);left.connect(merge,0,0);right.connect(merge,0,1);merge.connect(dest);}else left.connect(dest);
    await ctx.resume();Object.assign(t,{ctx,dest,left,right,stream:dest.stream});const until=performance.now()+3000;
    while(dest.stream.getAudioTracks()[0].getSettings().channelCount!==channels){if(performance.now()>until)throw Error('channel negotiation timeout');await new Promise(requestAnimationFrame);}return dest.stream;
   }
  })});
 },{channels,denied});
 await page.goto('/');await page.locator('#visuals-icon').click();await page.getByRole('button',{name:'WAV Recorder',exact:true}).click();
 await expect(page.locator('[data-rec-limit]')).toContainText('64 MiB');
 await page.locator('[data-source]').selectOption('record-source');await page.locator('.vis-toolbar [data-action="start"]').click();
}
const command=(page,cmd)=>page.locator('[data-rec-command="'+cmd+'"]');
test('24-bit selected-input recorder excludes paused audio and downloads validated stereo WAV',async({page})=>{
 await open(page);await expect(page.locator('[data-audio-status]')).toContainText('LIVE');await page.locator('[data-rec-bits]').selectOption('24');await command(page,'start').click();
 const panel=page.locator('[data-recorder]');await expect(panel).toHaveAttribute('data-rec-state','recording');await expect.poll(async()=>Number(await panel.getAttribute('data-rec-frames'))).toBeGreaterThan(4096);
 await command(page,'pause').click();await expect(panel).toHaveAttribute('data-rec-state','paused');const paused=await panel.getAttribute('data-rec-frames');
 await page.evaluate(()=>window.__recordTest.left.offset.value=-1.1);await expect.poll(async()=>Number(await panel.getAttribute('data-rec-left-peak'))).toBeGreaterThan(.99);expect(await panel.getAttribute('data-rec-frames')).toBe(paused);await expect(page.locator('[data-rec-level]')).toContainText('CLIP');
 await page.evaluate(()=>window.__recordTest.left.offset.value=.25);await expect.poll(async()=>Number(await panel.getAttribute('data-rec-left-peak'))).toBeLessThan(.26);
 await command(page,'resume').click();await expect(panel).toHaveAttribute('data-rec-state','recording');await expect.poll(async()=>Number(await panel.getAttribute('data-rec-frames'))).toBeGreaterThan(Number(paused)+4096);
 await command(page,'stop').click();await expect(panel).toHaveAttribute('data-rec-state','done');const frames=Number(await panel.getAttribute('data-rec-frames'));
 await expect(page.locator('[data-rec-preview]')).toBeVisible();await expect.poll(()=>page.locator('[data-rec-preview]').evaluate(a=>a.readyState)).toBeGreaterThan(0);
 const pending=page.waitForEvent('download');await command(page,'save').click();const download=await pending,bytes=await fs.readFile(await download.path());
 expect(download.suggestedFilename()).toMatch(/\.wav$/);expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.readUInt16LE(20)).toBe(1);expect(bytes.readUInt16LE(22)).toBe(2);expect(bytes.readUInt16LE(34)).toBe(24);expect(bytes.readUInt32LE(40)).toBe(frames*6);expect(bytes.readUInt32LE(4)+8).toBe(bytes.length);
 expect(bytes.readUInt32LE(24)).toBe(await page.evaluate(()=>window.__recordTest.ctx.sampleRate));
 const l=[];for(let p=44;p<44+frames*6;p+=6)l.push(bytes.readIntLE(p,3));expect(l.some(x=>Math.abs(x-4194304)<16)).toBe(true);expect(l.some(x=>Math.abs(x-2097152)<16)).toBe(true);expect(l.every(x=>x>-100)).toBe(true);
 expect(await page.evaluate(()=>window.__recordTest.requests)).toBe(1);
 await command(page,'discard').click();await expect(panel).toHaveAttribute('data-rec-state','idle');await expect(page.locator('[data-rec-preview]')).toBeHidden();await expect(command(page,'save')).toBeDisabled();
 await page.locator('[data-rec-bits]').selectOption('16');await command(page,'start').click();await expect(panel).toHaveAttribute('data-rec-state','recording');await expect.poll(async()=>Number(await panel.getAttribute('data-rec-frames'))).toBeGreaterThan(0);
 await page.locator('.vis-toolbar [data-action="stop"]').click();await expect(panel).toHaveAttribute('data-rec-state','done');expect(await page.evaluate(()=>window.__recordTest.stream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);expect(await page.evaluate(()=>window.__recordTest.requests)).toBe(1);await command(page,'discard').click();await page.evaluate(()=>window.__recordTest.ctx.close());
});
test('16-bit mono capture loss preserves only an explicitly interrupted recording',async({page})=>{
 await open(page,1);await expect(page.locator('[data-audio-status]')).toContainText('LIVE');await command(page,'start').click();const panel=page.locator('[data-recorder]');await expect(panel).toHaveAttribute('data-rec-state','recording');await expect.poll(async()=>Number(await panel.getAttribute('data-rec-frames'))).toBeGreaterThan(4096);
 await page.evaluate(()=>{const track=window.__recordTest.stream.getAudioTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
 await expect(panel).toHaveAttribute('data-rec-state','interrupted');await expect(page.locator('[data-rec-status]')).toContainText('ПРЕРВАНА');await expect(command(page,'save')).toBeEnabled();
 const pending=page.waitForEvent('download');await command(page,'save').click();const bytes=await fs.readFile(await (await pending).path());expect(bytes.readUInt16LE(22)).toBe(1);expect(bytes.readUInt16LE(34)).toBe(16);expect(bytes.readUInt32LE(40)).toBe(Number(await panel.getAttribute('data-rec-frames'))*2);
 page.once('dialog',d=>d.dismiss());await page.locator('[data-action="close"]').click();await expect(page.locator('.vis-dock')).toBeVisible();
 await command(page,'discard').click();await page.locator('[data-action="close"]').click();await expect(page.locator('.vis-dock')).toHaveCount(0);await page.evaluate(()=>window.__recordTest.ctx.close());
});
test('permission denial never enables recording or silently chooses a different source',async({page})=>{
 await open(page,2,{denied:true});await expect(page.locator('[data-audio-status]')).toContainText('запрещён');await expect(command(page,'start')).toBeDisabled();expect(await page.evaluate(()=>window.__recordTest.requests)).toBe(1);
});
