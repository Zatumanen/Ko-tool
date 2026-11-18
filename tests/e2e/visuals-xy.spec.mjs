import {test,expect} from '@playwright/test';
async function start(page,mono=false){
 await page.addInitScript(({mono})=>{
  window.__xyRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   enumerateDevices:async()=>[{kind:'audioinput',deviceId:'xy-synthetic',label:'Synthetic XY'}],addEventListener(){},
   getUserMedia:async()=>{
    window.__xyRequests++;
    const context=new AudioContext(),osc=context.createOscillator(),right=context.createGain(),destination=context.createMediaStreamDestination();
    destination.channelCount=mono?1:2;destination.channelCountMode='explicit';osc.frequency.value=220;
    if(mono)osc.connect(destination);else{const merger=context.createChannelMerger(2);osc.connect(merger,0,0);osc.connect(right);right.connect(merger,0,1);merger.connect(destination);}
    osc.start();await context.resume();window.__xy={context,osc,right,stream:destination.stream};return destination.stream;
   }
  }});
 },{mono});
 await page.goto('/');await page.locator('#visuals-icon').click();await expect(page.locator('[data-source] option')).toHaveCount(2);
 await page.locator('[data-source]').selectOption('xy-synthetic');await page.locator('[data-action="start"]').click();
 await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
}
const canvas=page=>page.locator('[data-meter="oscilloscope"] canvas');
const covariance=page=>canvas(page).evaluate(c=>{
 const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data,ratio=c.width/c.getBoundingClientRect().width;
 let dot=0;for(let y=Math.ceil(14*ratio);y<c.height;y++)for(let x=0;x<c.width;x++){
  const i=(y*c.width+x)*4;if(pixels[i]<80&&pixels[i+1]>140)dot+=(x-c.width/2)*(c.height/2+4*ratio-y);
 }
 return dot;
});
test('actual stereo channels draw phase and antiphase XY diagonals and stop releases input',async({page})=>{
 await start(page);await expect(canvas(page)).toHaveAttribute('data-xy-mode','stereo');
 await expect.poll(()=>covariance(page)).toBeGreaterThan(0);
 await page.evaluate(()=>{window.__xy.right.gain.value=-1;});await expect.poll(()=>covariance(page)).toBeLessThan(0);
 const streamId=await page.evaluate(()=>window.__xy.stream.id);
 await page.getByLabel('Oscilloscope XY mode').selectOption('artistic');await expect(canvas(page)).toHaveAttribute('data-xy-mode','artistic');
 expect(await page.evaluate(()=>window.__xyRequests)).toBe(1);expect(await page.evaluate(()=>window.__xy.stream.id)).toBe(streamId);
 await page.locator('[data-action="stop"]').first().click();expect(await page.evaluate(()=>window.__xy.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await page.evaluate(()=>{window.__xy.osc.stop();return window.__xy.context.close();});
});
test('mono has no technical stereo trace and may explicitly select derived Artistic XY',async({page})=>{
 await start(page,true);await expect(canvas(page)).toHaveAttribute('data-xy-points','0');
 await page.getByLabel('Oscilloscope XY mode').selectOption('artistic');
 await expect.poll(async()=>Number(await canvas(page).getAttribute('data-xy-points'))).toBeGreaterThan(1000);
 await page.locator('[data-action="close"]').first().click();expect(await page.evaluate(()=>window.__xy.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await page.evaluate(()=>{window.__xy.osc.stop();return window.__xy.context.close();});
});
