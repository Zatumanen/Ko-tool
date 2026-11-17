import{test,expect}from '@playwright/test';
async function live(page){
 await page.addInitScript(()=>{
  const Native=window.AudioWorkletNode;
  window.__visTriggerCount=0;window.__visPaintDelay=0;
  window.AudioWorkletNode=class extends Native{constructor(...args){super(...args);if(args[1]==='visuals-trigger')this.port.addEventListener('message',e=>{window.__visTriggerCount=e.data.count||0;});}};
  const stroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){const end=performance.now()+window.__visPaintDelay;while(performance.now()<end){}return stroke.apply(this,args);};
  const t=window.__visSource={requests:0};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:Object.assign(new EventTarget(),{
   enumerateDevices:async()=>[{kind:'audioinput',deviceId:'chosen-visual-input',label:'Selected synthetic input'}],
   getUserMedia:async c=>{if(c.audio.deviceId.exact!=='chosen-visual-input')throw Error('wrong source');t.requests++;const context=new AudioContext(),osc=context.createOscillator(),dest=context.createMediaStreamDestination();osc.connect(dest);osc.start();await context.resume();Object.assign(t,{context,osc,stream:dest.stream});return dest.stream;}
  })});
 });
 await page.goto('/');await page.locator('#visuals-icon').click();await page.locator('[data-source]').selectOption('chosen-visual-input');await page.locator('.vis-toolbar [data-action="start"]').click();
 await expect(page.locator('#visuals-root')).toHaveAttribute('data-render-state','active');
}
const counters=root=>root.evaluate(n=>({sample:Number(n.dataset.visAnalysisCount),paint:Number(n.dataset.visPaintCount)}));
test('Light Mono is one B&W submode; warnings stay grayscale and layout is unchanged',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};});
 await page.goto('/');await page.locator('#visuals-icon').click();await page.locator('[data-preset]').selectOption('Beatmaking');await expect(page.locator('.vis-unsaved')).toBeVisible();
 const layout=()=>page.locator('.vis-meter').evaluateAll(nodes=>nodes.map(n=>[n.dataset.meter,n.style.width]));const before=await layout();
 await expect(page.locator('[data-theme] option')).toHaveCount(3);await page.locator('[data-theme]').selectOption('mono');
 await expect(page.locator('[data-mono-tone]')).toBeVisible();await page.locator('[data-mono-tone]').selectOption('light');await expect(page.locator('#visuals-root')).toHaveClass(/vis-mono-light/);
 const colors=await page.locator('#visuals-root').evaluate(root=>{const s=getComputedStyle(root),w=getComputedStyle(root.querySelector('.vis-unsaved'));return{panel:s.getPropertyValue('--vis-panel').trim(),colors:[w.color,w.backgroundColor,w.borderTopColor]};});
 expect(colors.panel).toBe('#fff');for(const color of colors.colors){const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number);expect(rgb[0]).toBe(rgb[1]);expect(rgb[1]).toBe(rgb[2]);}expect(await layout()).toEqual(before);
 await page.locator('[data-mono-tone]').selectOption('dark');await expect(page.locator('#visuals-root')).not.toHaveClass(/vis-mono-light/);
 await page.locator('[data-action="close"]').click();await page.locator('#visuals-icon').click();await expect(page.locator('[data-auto-theme]')).toBeChecked();await expect(page.locator('[data-mono-tone]')).toBeHidden();await page.locator('[data-theme]').selectOption('mono');await expect(page.locator('[data-mono-tone]')).toHaveValue('dark');
});
test('sustained Canvas overload selects15FPS while snapshot and trigger work continue',async({page})=>{
 await live(page);const root=page.locator('#visuals-root');await expect(root).toHaveAttribute('data-render-fps','60');
 await page.evaluate(()=>window.__visPaintDelay=4);await expect(root).toHaveAttribute('data-render-fps','15',{timeout:15000});
 await page.evaluate(()=>window.__visPaintDelay=0);const before=await counters(root);
 await expect.poll(async()=>(await counters(root)).sample-before.sample).toBeGreaterThan(8);const after=await counters(root);expect(after.sample-before.sample).toBeGreaterThan(after.paint-before.paint);
 await expect(root).toHaveAttribute('data-render-fps','60',{timeout:20000});expect(await page.evaluate(()=>window.__visSource.requests)).toBe(1);
 await page.locator('.vis-toolbar [data-action="stop"]').click();await expect(root).toHaveAttribute('data-render-state','stopped');await page.evaluate(()=>window.__visSource.context.close());
});
test('offscreen Canvas suspends while actual trigger processing continues and resumes',async({page})=>{
 await live(page);const root=page.locator('#visuals-root');await expect.poll(()=>page.evaluate(()=>window.__visTriggerCount)).toBeGreaterThan(0);
 await page.locator('.vis-dock').evaluate(n=>n.style.transform='translateY(1000px)');await expect(root).toHaveAttribute('data-render-state','suspended');const before=await counters(root),trigger=await page.evaluate(()=>window.__visTriggerCount);
 await expect.poll(()=>page.evaluate(()=>window.__visTriggerCount)).toBeGreaterThan(trigger+2);expect(await counters(root)).toEqual(before);
 await page.locator('.vis-dock').evaluate(n=>n.style.transform='');await expect(root).toHaveAttribute('data-render-state','active');await expect.poll(async()=>(await counters(root)).paint).toBeGreaterThan(before.paint);
 await page.locator('.vis-toolbar [data-action="stop"]').click();expect(await page.evaluate(()=>window.__visSource.stream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);await page.evaluate(()=>window.__visSource.context.close());
});
test('horizontal clipping skips only invisible canvases and scrolling resumes the right modules',async({page})=>{
 await page.setViewportSize({width:640,height:900});await live(page);
 const first=page.locator('[data-meter="waveform"] canvas'),last=page.locator('[data-meter="oscilloscope"] canvas');
 await expect.poll(async()=>Number(await first.getAttribute('data-vis-paint-count'))).toBeGreaterThan(0);
 const unseen=Number(await last.getAttribute('data-vis-paint-count')||0),trigger=await page.evaluate(()=>window.__visTriggerCount);
 await expect.poll(()=>page.evaluate(()=>window.__visTriggerCount)).toBeGreaterThan(trigger+2);expect(Number(await last.getAttribute('data-vis-paint-count')||0)).toBe(unseen);
 await page.locator('.vis-meters').evaluate(n=>n.scrollLeft=n.scrollWidth);
 await expect.poll(async()=>Number(await last.getAttribute('data-vis-paint-count'))).toBeGreaterThan(unseen);
 const clipLeft=await page.locator('.vis-meters').evaluate(n=>n.getBoundingClientRect().left);expect(await first.evaluate(n=>n.getBoundingClientRect().right)).toBeLessThanOrEqual(clipLeft);
 const left=Number(await first.getAttribute('data-vis-paint-count')),nextTrigger=await page.evaluate(()=>window.__visTriggerCount);
 await expect.poll(()=>page.evaluate(()=>window.__visTriggerCount)).toBeGreaterThan(nextTrigger+2);expect(Number(await first.getAttribute('data-vis-paint-count'))).toBe(left);
 await page.locator('.vis-toolbar [data-action="stop"]').click();await page.evaluate(()=>window.__visSource.context.close());
});
test('a visible module header does not keep a wholly clipped Canvas running',async({page})=>{
 await live(page);const root=page.locator('#visuals-root');
 await page.locator('.vis-dock').evaluate(dock=>{const top=Math.min(...[...dock.querySelectorAll('canvas')].map(c=>c.getBoundingClientRect().top));dock.style.transform='translateY('+(innerHeight-top+1)+'px)';});
 await expect.poll(()=>page.locator('.vis-meter canvas').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().top>=innerHeight))).toBe(true);
 expect(await page.locator('.vis-meter').evaluateAll(nodes=>nodes.some(n=>{const r=n.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}))).toBe(true);
 await expect(root).toHaveAttribute('data-render-state','suspended');
 await page.locator('.vis-dock').evaluate(n=>n.style.transform='');await expect(root).toHaveAttribute('data-render-state','active');
 await page.locator('.vis-toolbar [data-action="stop"]').click();await page.evaluate(()=>window.__visSource.context.close());
});
test('zero-height Canvas suspends and resumes after trigger controls release its space',async({page})=>{
 await live(page);const root=page.locator('#visuals-root');
 for(const id of ['spectrum','spectrogram','loudness','stereo','output','oscilloscope'])await page.locator('[data-meter="'+id+'"] [data-action="hide"]').click();
 const handle=await page.locator('.vis-top-resize').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+100,{steps:5});await page.mouse.up();
 await page.locator('.vis-trigger-controls summary').click();await expect.poll(()=>page.locator('[data-meter="waveform"] canvas').evaluate(n=>n.getBoundingClientRect().height)).toBe(0);
 await expect(root).toHaveAttribute('data-render-state','suspended');
 await page.locator('.vis-trigger-controls summary').click();await expect.poll(()=>page.locator('[data-meter="waveform"] canvas').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThan(0);await expect(root).toHaveAttribute('data-render-state','active');
 await page.locator('.vis-toolbar [data-action="stop"]').click();await page.evaluate(()=>window.__visSource.context.close());
});
