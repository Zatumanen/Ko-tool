import{test,expect}from '@playwright/test';
async function fixture(page,channels=2){
 await page.addInitScript(({channels})=>{
  let stream;
  const test=window.__outputTest={requests:0};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:Object.assign(new EventTarget(),{
   enumerateDevices:async()=>[{kind:'audioinput',deviceId:'selected-meter-input',label:'Synthetic meter input'}],
   getUserMedia:async constraints=>{
    if(constraints.audio.deviceId.exact!=='selected-meter-input')throw Error('wrong source');test.requests++;
    const ctx=new AudioContext(),dest=ctx.createMediaStreamDestination();dest.channelCount=channels;dest.channelCountMode='explicit';
    const merger=ctx.createChannelMerger(2),left=ctx.createConstantSource(),right=ctx.createConstantSource();
    left.offset.value=.5;right.offset.value=.125;left.start();right.start();left.connect(merger,0,0);if(channels===2)right.connect(merger,0,1);merger.connect(dest);await ctx.resume();
    stream=dest.stream;Object.assign(test,{ctx,dest,stream,left,right,merger});
    const deadline=performance.now()+3000;
    while(stream.getAudioTracks()[0].getSettings().channelCount!==channels){if(performance.now()>deadline)throw Error('channel negotiation timeout');await new Promise(requestAnimationFrame);}
    return stream;
   }
  })});
 },{channels});
 await page.goto('/');await page.locator('#visuals-icon').click();
 await page.locator('[data-source]').selectOption('selected-meter-input');await page.locator('[data-action="start"]').click();
 const meter=page.locator('[data-meter="output"] canvas');await expect(meter).toHaveAttribute('data-output-state','ready');return meter;
}
test('selected-input continuous sample peaks, hold, latched CLIP, reset and cleanup',async({page})=>{
 const m=await fixture(page);
 await expect(m).toHaveAttribute('data-output-left-db',/-6\.0/);await expect(m).toHaveAttribute('data-output-right-db',/-18\.0/);
 const widths=await m.evaluate(canvas=>{
  const rect=canvas.getBoundingClientRect(),dpr=canvas.width/rect.width,h=rect.height,ctx=canvas.getContext('2d');
  const color=getComputedStyle(document.getElementById('visuals-root')).getPropertyValue('--vis-accent').trim();
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  return [1,h/2+1].map(y=>{
   const row=ctx.getImageData(0,Math.floor((y+12+Math.max(3,Math.min(10,h/2-15))/2)*dpr),canvas.width,1).data;let count=0;
   for(let x=0;x<canvas.width;x++)if(rgb.every((v,c)=>Math.abs(row[x*4+c]-v)<3))count++;return count/dpr;
  });
 });
 expect(widths[0]).toBeGreaterThan(widths[1]+5);
 // A single audio sample followed by silence while the main thread is blocked.
 // Scheduled in Web Audio, not via the renderer or test-only product injection.
 await page.evaluate(()=>{
  const t=window.__outputTest,ctx=t.ctx,at=ctx.currentTime+.1;
  t.left.offset.setValueAtTime(0,at-.02);t.right.offset.setValueAtTime(0,at-.02);
  const buffer=ctx.createBuffer(2,1,ctx.sampleRate);buffer.getChannelData(0)[0]=-1.125;buffer.getChannelData(1)[0]=.75;
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(t.dest);source.start(at);
  const end=performance.now()+300;while(performance.now()<end){};
 });
 await expect(m).toHaveAttribute('data-output-left-clip','true');await expect(m).toHaveAttribute('data-output-right-clip','false');
 await expect(m).toHaveAttribute('aria-label',/L.*CLIP/);
 await expect.poll(()=>m.getAttribute('data-output-left-db')).toBe('-Infinity');
 await expect.poll(async()=>Number(await m.getAttribute('data-output-left-hold-db'))).toBeGreaterThan(-1);
 // Changing global colors cannot clear the meter or hide the textual warning.
 await page.locator('[data-theme]').selectOption('mono');await expect(m).toHaveAttribute('data-output-left-clip','true');
 await page.getByRole('button',{name:'Reset Output Peak Hold and CLIP',exact:true}).click();
 await expect(m).toHaveAttribute('data-output-left-clip','false');await expect(m).toHaveAttribute('data-output-left-hold-db','-Infinity');
 await page.locator('.vis-toolbar [data-action="stop"]').click();await expect(m).toHaveAttribute('data-output-state','stopped');
 expect(await m.getAttribute('data-output-left-db')).toBeNull();
 expect(await page.evaluate(()=>window.__outputTest.stream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);
 await page.evaluate(()=>window.__outputTest.ctx.close());
});
test('mono is measured as a single channel without fabricating R peaks',async({page})=>{
 const m=await fixture(page,1);await expect(m).toHaveAttribute('data-output-channels','1');
 await expect(m).toHaveAttribute('data-output-right-db','unavailable');await expect(m).toHaveAttribute('aria-label',/MONO.*R unavailable/);
 await page.locator('[data-action="close"]').click();expect(await page.evaluate(()=>window.__outputTest.stream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);await page.evaluate(()=>window.__outputTest.ctx.close());
});
test('90px dock retains both channel rails; channel drift stops without automatic restart',async({page})=>{
 const m=await fixture(page);const handle=await page.locator('.vis-top-resize').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+100,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.locator('.vis-dock').evaluate(n=>Math.round(n.getBoundingClientRect().height))).toBe(90);
 await expect.poll(()=>m.evaluate(canvas=>{
  const ctx=canvas.getContext('2d'),color=getComputedStyle(document.getElementById('visuals-root')).getPropertyValue('--vis-accent').trim(),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  return [.25,.75].every(x=>{const p=ctx.getImageData(Math.floor(canvas.width*x),canvas.height-4,1,1).data;return rgb.every((v,c)=>Math.abs(p[c]-v)<3);});
 })).toBe(true);
 await page.evaluate(()=>{window.__outputTest.dest.channelCount=1});
 await expect(m).toHaveAttribute('data-output-state','stopped');await expect(page.locator('[data-audio-status]')).toContainText('Формат каналов изменился');
 await page.evaluate(()=>navigator.mediaDevices.dispatchEvent(new Event('devicechange')));
 await expect(page.locator('[data-audio-status]')).toContainText('Выберите аудиовход и нажмите START');
 expect(await page.evaluate(()=>window.__outputTest.requests)).toBe(1);await page.evaluate(()=>window.__outputTest.ctx.close());
});
