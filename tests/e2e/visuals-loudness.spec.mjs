import{test,expect}from '@playwright/test';
async function start(page,worklet=true){
 await page.addInitScript(({worklet})=>{
  if(!worklet)Object.defineProperty(window,'AudioWorkletNode',{value:undefined,configurable:true});
  window.__lufsRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   enumerateDevices:async()=>[{kind:'audioinput',deviceId:'lufs-synthetic',label:'997Hz mono synthetic'}],addEventListener(){},
   getUserMedia:async()=>{
    window.__lufsRequests++;const context=new AudioContext(),source=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
    destination.channelCount=1;destination.channelCountMode='explicit';source.frequency.value=997;gain.gain.value=.1;source.connect(gain).connect(destination);source.start();await context.resume();
    // Chromium may briefly report the destination's default stereo format.
    // Grant this synthetic mono stream only after the settings describe its graph.
    const track=destination.stream.getAudioTracks()[0],deadline=performance.now()+1000;
    while(track.getSettings().channelCount!==1&&performance.now()<deadline)
      await new Promise(resolve=>setTimeout(resolve,10));
    if(track.getSettings().channelCount!==1){
      source.stop();await context.close();throw Error('Synthetic mono input did not settle');
    }
    window.__lufsSource={context,source,stream:destination.stream};return destination.stream;
   }
  }});
 },{worklet});
 await page.goto('/');await page.locator('#visuals-icon').click();await expect(page.locator('[data-source] option')).toHaveCount(2);
 await page.locator('[data-source]').selectOption('lufs-synthetic');await page.locator('[data-action="start"]').click();await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
}
const meter=page=>page.locator('[data-meter="loudness"] canvas');
test('actual LUFS worklet reports calibrated M/S/I and reset preserves capture',async({page})=>{
 await start(page);
 for(const key of ['momentary','short-term','integrated'])await expect.poll(async()=>Math.abs(Number(await meter(page).getAttribute('data-lufs-'+key))+23.01),{timeout:10000}).toBeLessThan(.2);
 const id=await page.evaluate(()=>window.__lufsSource.stream.id);
 await page.getByRole('button',{name:'Reset LUFS measurement'}).click();await expect(meter(page)).toHaveAttribute('data-lufs-short-term','pending');
 await expect.poll(async()=>Number(await meter(page).getAttribute('data-lufs-seconds'))).toBeLessThan(1);
 expect(await page.evaluate(()=>window.__lufsRequests)).toBe(1);expect(await page.evaluate(()=>window.__lufsSource.stream.id)).toBe(id);
 await page.locator('[data-action="stop"]').first().click();await expect(meter(page)).toHaveAttribute('data-lufs-state','stopped');
 expect(await page.evaluate(()=>window.__lufsSource.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await page.evaluate(()=>{window.__lufsSource.source.stop();return window.__lufsSource.context.close();});
});
test('absence of AudioWorklet is explicit and never relabels RMS as LUFS',async({page})=>{
 await start(page,false);await expect(meter(page)).toHaveAttribute('data-lufs-state','unavailable');
 await expect(meter(page)).toHaveAttribute('aria-label',/LUFS unavailable/);await expect(meter(page)).toHaveAttribute('data-lufs-integrated','pending');
 await page.locator('[data-action="close"]').first().click();expect(await page.evaluate(()=>window.__lufsSource.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await page.evaluate(()=>{window.__lufsSource.source.stop();return window.__lufsSource.context.close();});
});
