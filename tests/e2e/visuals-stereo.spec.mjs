import{test,expect}from '@playwright/test';
async function start(page,mono=false){
 await page.addInitScript(({mono})=>{
  window.__stereoRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{enumerateDevices:async()=>[{kind:'audioinput',deviceId:'stereo-synthetic',label:'Synthetic stereo'}],addEventListener(_name,fn){window.__stereoDeviceChange=fn;},
   getUserMedia:async()=>{
    window.__stereoRequests++;const context=new AudioContext(),osc=context.createOscillator(),left=context.createGain(),right=context.createGain(),amp=context.createGain(),destination=context.createMediaStreamDestination();
    destination.channelCount=mono?1:2;destination.channelCountMode='explicit';osc.frequency.value=220;amp.gain.value=.8;osc.connect(amp);
    if(mono)amp.connect(destination);else{const merger=context.createChannelMerger(2);amp.connect(left).connect(merger,0,0);amp.connect(right).connect(merger,0,1);merger.connect(destination);}
    osc.start();await context.resume();
    // MediaStreamDestination negotiates its channel settings asynchronously.
    const deadline=performance.now()+3000;while(destination.stream.getAudioTracks()[0].getSettings().channelCount!==(mono?1:2)){if(performance.now()>deadline)throw Error('Synthetic channel negotiation failed');await new Promise(requestAnimationFrame);}
    window.__stereo={context,osc,left,right,destination,stream:destination.stream};return destination.stream;
   }}});
 },{mono});
 await page.goto('/');await page.locator('#visuals-icon').click();await expect(page.locator('[data-source] option')).toHaveCount(2);await page.locator('[data-source]').selectOption('stereo-synthetic');await page.locator('[data-action="start"]').click();await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
}
const canvas=page=>page.locator('[data-meter="stereo"] canvas');
const spread=page=>canvas(page).evaluate(c=>{
 const ratio=c.width/c.getBoundingClientRect().width,pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 let xx=0,yy=0;const side=Math.max(1,Math.min(c.width-10*ratio,c.height-32*ratio)),cx=c.width/2,cy=side/2+2*ratio;
 // Exclude L/R glyphs and metric rails: text antialiasing is not signal data.
 for(let y=Math.ceil(12*ratio);y<c.height-30*ratio;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(pixels[i]<100&&pixels[i+1]>140){xx+=(x-cx)**2;yy+=(y-cy)**2;}}
 return{xx,yy};
});
test('plasma pixels show phase/antiphase, correlation and one-sided balance without audio writes',async({page})=>{
 await start(page);
 // Adversarial foreground: even vector-colored labels must not count as the trace.
 await page.evaluate(()=>document.getElementById('visuals-root').style.setProperty('--vis-fg','#28e8d2'));
 await expect(canvas(page)).toHaveAttribute('data-stereo-state','stereo');
 await expect.poll(async()=>Number(await canvas(page).getAttribute('data-stereo-correlation'))).toBeGreaterThan(.99);
 await expect.poll(async()=>{const s=await spread(page);return s.yy/(s.xx||1)}).toBeGreaterThan(3);
 await page.evaluate(()=>{window.__stereo.right.gain.value=-1;});await expect.poll(async()=>Number(await canvas(page).getAttribute('data-stereo-correlation'))).toBeLessThan(-.99);
 await expect.poll(async()=>{const s=await spread(page);return s.xx/(s.yy||1)}).toBeGreaterThan(3);
 await page.evaluate(()=>{window.__stereo.right.gain.value=0;});await expect.poll(async()=>Number(await canvas(page).getAttribute('data-stereo-balance'))).toBeLessThan(-.99);
 await expect(canvas(page)).toHaveAttribute('data-stereo-correlation','undefined');
 await page.evaluate(()=>{window.__stereo.left.gain.value=0;});await expect(canvas(page)).toHaveAttribute('data-stereo-state','silence');
 expect(await page.evaluate(()=>window.__stereoRequests)).toBe(1);await page.locator('[data-action="stop"]').first().click();await expect(canvas(page)).toHaveAttribute('data-stereo-state','stopped');
 expect(await page.evaluate(()=>window.__stereo.stream.getAudioTracks()[0].readyState)).toBe('ended');await page.evaluate(()=>{window.__stereo.osc.stop();return window.__stereo.context.close();});
});
test('mono explicitly disables stereo metrics and scope',async({page})=>{
 await start(page,true);await expect(canvas(page)).toHaveAttribute('data-stereo-state','mono');await expect(canvas(page)).toHaveAttribute('data-stereo-correlation','undefined');await expect(canvas(page)).toHaveAttribute('data-stereo-balance','undefined');
 await page.locator('[data-action="close"]').first().click();expect(await page.evaluate(()=>window.__stereo.stream.getAudioTracks()[0].readyState)).toBe('ended');await page.evaluate(()=>{window.__stereo.osc.stop();return window.__stereo.context.close();});
});
test('changed channel format stops and disarms automatic reconnection until START',async({page})=>{
 await start(page);await expect(canvas(page)).toHaveAttribute('data-stereo-state','stereo');
 await page.evaluate(()=>{window.__stereo.destination.channelCount=1;});await expect(page.locator('[data-audio-status]')).toContainText('Формат каналов изменился');
 await expect(canvas(page)).toHaveAttribute('data-stereo-state','stopped');
 await page.evaluate(()=>window.__stereoDeviceChange());await expect(page.locator('[data-action="start"]')).toBeVisible();
 await expect(page.locator('[data-audio-status]')).toContainText('Выберите аудиовход');expect(await page.evaluate(()=>window.__stereoRequests)).toBe(1);
 await page.evaluate(()=>{window.__stereo.osc.stop();return window.__stereo.context.close();});
});
