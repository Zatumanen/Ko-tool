import{test,expect}from '@playwright/test';

test('Visuals opens as its own desktop app with seven real modules and safe idle source',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#visuals-icon')).toBeVisible();
 await page.locator('#visuals-icon').click();
 await expect(page.locator('.vis-dock')).toBeVisible();
 await expect(page.locator('.vis-meter')).toHaveCount(7);
 await expect(page.locator('[data-action="start"]')).toBeVisible();
 await expect(page.locator('[data-audio-status]')).toContainText(/Выберите|Доступных аудиовходов нет/);
 await expect(page.locator('[data-auto-theme]')).toBeChecked();
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-app/);
 await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
});

test('builtin presets, module picker, all-hidden restore and working snapshot survive reload',async({page})=>{
 await page.goto('/');await page.locator('#visuals-icon').click();
 await page.locator('[data-preset]').selectOption('Beatmaking');
 await expect(page.locator('.vis-meter')).toHaveCount(5);
 expect(await page.locator('.vis-meter').evaluateAll(nodes=>nodes.map(x=>x.dataset.meter))).toEqual(['waveform','spectrum','spectrogram','output','loudness']);
 await expect(page.locator('[data-autohide]')).not.toBeChecked();
 await page.locator('[data-action="modules"]').click();
 await page.locator('[data-module="stereo"]').click();
 await expect(page.locator('.vis-meter')).toHaveCount(6);
 const latest=await page.evaluate(()=>JSON.parse(localStorage.getItem('ko-tool-visuals-working-v1')));
 expect(latest.visible).toContain('stereo');
 await page.locator('[data-action="close"]').click();
 await expect(page.locator('.vis-dock')).toHaveCount(0);
 await page.reload();
 await page.locator('#visuals-icon').click();
 await expect(page.locator('.vis-meter')).toHaveCount(6);
 for(const id of ['waveform','spectrum','spectrogram','loudness','stereo','output']){
   await page.locator('.vis-meter[data-meter="'+id+'"] [data-action="hide"]').click();
 }
 await expect(page.locator('.vis-meter')).toHaveCount(0);
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-collapsed/);
 await page.locator('[data-action="restore"]').click();
 await expect(page.locator('[data-module-picker]')).toBeVisible();
 await page.locator('[data-module="oscilloscope"]').click();
 await expect(page.locator('.vis-meter')).toHaveCount(1);
 await expect(page.locator('.vis-meter[data-meter="oscilloscope"]')).toBeVisible();
 await expect(page.locator('.vis-tab')).toBeHidden();
});

test('manual collapse, three modes and per-launch Auto Theme reset',async({page})=>{
 await page.goto('/');await page.locator('#visuals-icon').click();
 await page.locator('[data-theme]').selectOption('mono');
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-mono/);
 await expect(page.locator('[data-auto-theme]')).not.toBeChecked();
 await page.locator('[data-action="collapse"]').click();
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-collapsed/);
 await page.locator('[data-action="restore"]').click();
 await expect(page.locator('.vis-dock')).toBeVisible();
 await expect(page.locator('.vis-meter')).toHaveCount(7);
 await page.locator('[data-action="close"]').click();
 await page.locator('#visuals-icon').click();
 await expect(page.locator('[data-auto-theme]')).toBeChecked();
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-app/);
});

test('fake browser-selected stereo input captures without touching Web MIDI; stop releases track',async({page})=>{
 await page.addInitScript(()=>{
   const real=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
   let live=null;
   window.__visualsAudioTest={started:0,stopped:0,get stream(){return live}};
   const devices={
     enumerateDevices:async()=>[{kind:'audioinput',deviceId:'fake-ep-usb',label:'EP USB AUDIO'}],
     getUserMedia:async constraints=>{
       if(constraints.audio.deviceId.exact!=='fake-ep-usb')throw Error('wrong source');
       window.__visualsAudioTest.started++;
       const ctx=new AudioContext(),osc=ctx.createOscillator(),destination=ctx.createMediaStreamDestination();
       osc.frequency.value=220;osc.connect(destination);osc.start();
       await ctx.resume();
       live=destination.stream;
       live.getAudioTracks()[0].addEventListener('ended',()=>window.__visualsAudioTest.stopped++);
       return live;
     },
     addEventListener:()=>{}
   };
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:devices});
   window.__visualsAudioTest.original=!!real;
 });
 await page.goto('/');
 await page.locator('#visuals-icon').click();
 await expect(page.locator('[data-source] option')).toHaveCount(2);
 await page.locator('[data-source]').selectOption('fake-ep-usb');
 await page.locator('[data-action="start"]').click();
 await expect(page.locator('[data-action="stop"]').first()).toBeVisible();
 await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
 const count=await page.evaluate(()=>window.__visualsAudioTest.started);
 expect(count).toBe(1);
 await page.locator('[data-action="stop"]').first().click();
 await expect(page.locator('[data-action="start"]')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__visualsAudioTest.stream.getAudioTracks()[0].readyState)).toBe('ended');
 await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
});

test('Visuals Auto Theme follows the same verified My EP MIDI session without extra access requests',async({page})=>{
 const{fileURLToPath}=await import('node:url');
 await page.addInitScript({path:fileURLToPath(new URL('./fake-ep-browser.js',import.meta.url))});
 await page.goto('/');
 await page.locator('#visuals-icon').click();
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-app/);
 const before=await page.evaluate(()=>window.__fakeEp.midiAccessRequests.length);
 expect(before).toBe(0);
 await page.locator('#my-ep-icon').click();
 await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:15000});
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-ep133/);
 expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(1);
 await page.locator('[data-theme]').selectOption('mono');
 await expect(page.locator('#visuals-root')).toHaveClass(/vis-theme-mono/);
});
