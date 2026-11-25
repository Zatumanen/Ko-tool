import{test,expect}from '@playwright/test';

async function delayedVisualsEnumeration(page){
  await page.addInitScript(()=>{
    window.visualsEnumerations=[];
    const media=new EventTarget();
    media.enumerateDevices=()=>new Promise((resolve,reject)=>window.visualsEnumerations.push({resolve,reject}));
    media.getUserMedia=async()=>{throw Error('Unexpected capture request');};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  await expect.poll(()=>page.evaluate(()=>window.visualsEnumerations.length)).toBe(1);
}

test('a late enumeration rejection after Close does not produce a page error',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await delayedVisualsEnumeration(page);
  await page.locator('.vis-toolbar [data-action="close"]').click();
  const observed=page.waitForEvent('pageerror',{timeout:500}).catch(()=>null);
  await page.evaluate(()=>window.visualsEnumerations[0].reject(Error('Synthetic enumeration failure')));
  await observed;
  expect(errors).toEqual([]);
  await expect(page.locator('.vis-dock')).toHaveCount(0);
});

test('a reopened Visuals window keeps its newer input list after old responses',async({page})=>{
  await delayedVisualsEnumeration(page);
  await page.locator('.vis-toolbar [data-action="close"]').click();
  await page.locator('#visuals-icon').click();
  await expect.poll(()=>page.evaluate(()=>window.visualsEnumerations.length)).toBe(2);
  await page.locator('.vis-toolbar [data-action="refresh"]').click();
  await expect.poll(()=>page.evaluate(()=>window.visualsEnumerations.length)).toBe(3);
  const source=page.locator('select[data-source]');
  await page.evaluate(()=>window.visualsEnumerations[2].resolve([{kind:'audioinput',deviceId:'new',label:'Current Input'}]));
  await expect(source.locator('option[value="new"]')).toHaveCount(1);
  await page.evaluate(async()=>{
    window.visualsEnumerations[1].resolve([{kind:'audioinput',deviceId:'old',label:'Stale Refresh'}]);
    window.visualsEnumerations[0].resolve([{kind:'audioinput',deviceId:'closed',label:'Closed Window'}]);
    await new Promise(requestAnimationFrame);
  });
  await expect(source.locator('option[value="new"]')).toHaveCount(1);
  await expect(source.locator('option[value="old"], option[value="closed"]')).toHaveCount(0);
});

test('Close cancels a pending START and disposes the late stream without changing the reopened window',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.visualsStarts=[];
    window.visualsStops=0;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
      enumerateDevices:async()=>[{kind:'audioinput',deviceId:'chosen',label:'Chosen Input'}],
      getUserMedia:options=>new Promise(resolve=>{
        window.visualsStarts.push({source:options.audio.deviceId.exact,resolve});
      })
    }});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  await page.locator('select[data-source]').selectOption('chosen');
  await page.locator('.vis-toolbar [data-action="start"]').dblclick();
  await expect.poll(()=>page.evaluate(()=>window.visualsStarts.length)).toBe(1);
  await page.locator('.vis-toolbar [data-action="close"]').click();
  await page.locator('#visuals-icon').click();
  const input=page.locator('select[data-source]');
  await expect(input.locator('option[value="chosen"]')).toHaveCount(1);
  await page.evaluate(()=>{
    const track={stop(){window.visualsStops++;}};
    window.visualsStarts[0].resolve({getTracks:()=>[track]});
  });
  await expect.poll(()=>page.evaluate(()=>window.visualsStops)).toBe(1);
  expect(await page.evaluate(()=>window.visualsStarts.map(s=>s.source))).toEqual(['chosen']);
  await expect(input).toHaveValue('');
  await expect(page.locator('[data-audio-status]')).not.toContainText('LIVE');
  expect(errors).toEqual([]);
});

test('START cannot overlap the permission-only ACCESS stream',async({page})=>{
  await page.addInitScript(()=>{
    window.visualsRequests=[];
    window.visualsStops=0;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
      enumerateDevices:async()=>[{kind:'audioinput',deviceId:'chosen',label:'Chosen Input'}],
      getUserMedia:options=>new Promise(resolve=>window.visualsRequests.push({audio:options.audio,resolve}))
    }});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  await page.locator('select[data-source]').selectOption('chosen');
  await page.locator('.vis-toolbar [data-action="unlock"]').click();
  await page.locator('.vis-toolbar [data-action="start"]').click();
  expect(await page.evaluate(()=>window.visualsRequests.map(request=>request.audio))).toEqual([true]);
  await page.evaluate(()=>window.visualsRequests[0].resolve({getTracks:()=>[{stop(){window.visualsStops++;}}]}));
  await expect.poll(()=>page.evaluate(()=>window.visualsStops)).toBe(1);
  await expect(page.locator('[data-audio-status]')).toContainText('нажмите START');
  await page.locator('.vis-toolbar [data-action="start"]').click();
  expect(await page.evaluate(()=>window.visualsRequests[1].audio.deviceId.exact)).toBe('chosen');
});

test('ACCESS publishes the post-grant input list despite refresh and source selection',async({page})=>{
  await page.addInitScript(()=>{
    const media=new EventTarget();
    let authorized=false;
    window.visualsStops=0;
    media.enumerateDevices=async()=>[{kind:'audioinput',deviceId:'chosen',label:authorized?'Authorized Input':'Input before permission'}];
    media.getUserMedia=()=>new Promise(resolve=>{
      window.completeVisualsAccess=()=>{
        authorized=true;
        resolve({getTracks:()=>[{stop(){window.visualsStops++;}}]});
      };
    });
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  const input=page.locator('select[data-source]');
  await expect(input.locator('option[value="chosen"]')).toHaveText('Input before permission');
  await page.locator('.vis-toolbar [data-action="unlock"]').click();
  await page.locator('.vis-toolbar [data-action="refresh"]').click();
  await page.evaluate(()=>navigator.mediaDevices.dispatchEvent(new Event('devicechange')));
  await input.selectOption('chosen');
  await page.evaluate(()=>window.completeVisualsAccess());
  await expect(input.locator('option[value="chosen"]')).toHaveText('Authorized Input');
  await expect(input).toHaveValue('chosen');
  expect(await page.evaluate(()=>window.visualsStops)).toBe(1);
  await expect(page.locator('[data-audio-status]')).toContainText('нажмите START');
});

test('devicechange during ACCESS is replayed before resuming the selected input',async({page})=>{
  await page.addInitScript(()=>{
    const media=new EventTarget(),chosen={kind:'audioinput',deviceId:'chosen',label:'Chosen Input'};
    let present=true,holdPermissionList=false;
    window.captureSources=[];
    window.captureContexts=[];
    window.changeVisualsDevice=value=>{present=value;media.dispatchEvent(new Event('devicechange'));};
    media.enumerateDevices=async()=>{
      const snapshot=present?[chosen]:[];
      if(!holdPermissionList)return snapshot;
      holdPermissionList=false;
      return new Promise(resolve=>{window.completeVisualsList=()=>resolve(snapshot);});
    };
    media.getUserMedia=async({audio})=>{
      if(audio===true){holdPermissionList=true;return{getTracks:()=>[{stop(){}}]};}
      window.captureSources.push(audio.deviceId.exact);
      const context=new AudioContext(),destination=context.createMediaStreamDestination();
      window.captureContexts.push(context);
      await context.resume();
      return destination.stream;
    };
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  await page.locator('select[data-source]').selectOption('chosen');
  await page.locator('.vis-toolbar [data-action="start"]').click();
  await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
  await page.evaluate(()=>window.changeVisualsDevice(false));
  await expect(page.locator('[data-audio-status]')).toContainText('отключён');
  await page.locator('.vis-toolbar [data-action="unlock"]').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.completeVisualsList)).toBe('function');
  await page.evaluate(()=>{window.changeVisualsDevice(true);window.completeVisualsList();});
  await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
  expect(await page.evaluate(()=>window.captureSources)).toEqual(['chosen','chosen']);
  await page.locator('.vis-toolbar [data-action="stop"]').click();
  await page.evaluate(()=>Promise.all(window.captureContexts.map(context=>context.close())));
});

test('keyboard audio input selection retains focus through a device refresh',async({page})=>{
  await page.addInitScript(()=>{
    const media=new EventTarget();let label='Fixture Input';
    media.enumerateDevices=async()=>[{kind:'audioinput',deviceId:'fixture',label}];
    window.keyboardSourceCaptureRequests=0;
    media.getUserMedia=async()=>{window.keyboardSourceCaptureRequests++;throw Error('Unexpected capture');};
    window.renameFixtureInput=()=>{label='Refreshed Input';media.dispatchEvent(new Event('devicechange'));};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
  });
  await page.goto('/');await page.locator('#visuals-icon').click();
  const input=page.locator('select[data-source]');
  await expect(input.locator('option[value="fixture"]')).toHaveText('Fixture Input');
  await input.focus();await page.keyboard.press('ArrowDown');
  await expect(input).toHaveValue('fixture');
  await expect(input).toBeFocused();
  await page.evaluate(()=>window.renameFixtureInput());
  await expect(input.locator('option[value="fixture"]')).toHaveText('Refreshed Input');
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.vis-toolbar [data-action="unlock"]')).toBeFocused();
  expect(await page.evaluate(()=>window.keyboardSourceCaptureRequests)).toBe(0);
});

test('Visuals opens with seven idle modules without bootstrapping My EP',async({page})=>{
 const workspaceRequests=[];
 page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/ep133/workspaceBootstrap.js'))workspaceRequests.push(request.url());});
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
 await page.waitForLoadState('networkidle');
 expect(workspaceRequests).toEqual([]);
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
       window.__visualsAudioTest.osc=osc;
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
 await expect.poll(async()=>Number(await page.locator('[data-meter="waveform"] canvas').getAttribute('data-trigger-count'))).toBeGreaterThan(0);
 await page.locator('.vis-trigger-controls summary').click();
 await page.getByLabel('Waveform Sensitivity threshold',{exact:true}).fill('0.2');
 await page.getByLabel('Waveform Sensitivity threshold',{exact:true}).press('Tab');
 expect(await page.getByLabel('Waveform Sensitivity threshold',{exact:true}).evaluate(input=>input.checkValidity())).toBe(true);
 await page.getByLabel('Waveform Time ms',{exact:true}).fill('100');
 await page.getByLabel('Waveform Time ms',{exact:true}).press('Tab');
 await page.getByLabel('Waveform Amplitude',{exact:true}).fill('2');
 await page.getByLabel('Waveform Amplitude',{exact:true}).press('Tab');
 await expect.poll(async()=>Number(await page.locator('[data-meter="waveform"] canvas').getAttribute('data-trigger-count'))).toBeGreaterThan(0);
 await expect(page.locator('[data-meter="spectrum"] canvas')).toHaveAttribute('data-spectrum-scale','log-hz-dbfs');
 await expect.poll(async()=>Math.abs(Number(await page.locator('[data-meter="spectrum"] canvas').getAttribute('data-spectrum-peak-hz'))-220)).toBeLessThan(20);
 const history=page.locator('[data-meter="spectrogram"] canvas');
 await expect(history).toHaveAttribute('data-history-direction','right-to-left');
 await expect.poll(async()=>Number(await history.getAttribute('data-history-frames'))).toBeGreaterThan(2);
 const frames=Number(await history.getAttribute('data-history-frames'));
 const peakRow=()=>history.evaluate(canvas=>{
   const ratio=canvas.width/canvas.getBoundingClientRect().width,ctx=canvas.getContext('2d');
   const pixels=ctx.getImageData(canvas.width-1,0,1,canvas.height).data;
   let peak=-1,row=-1;for(let y=Math.ceil(10*ratio);y<Math.floor(canvas.height-10*ratio);y++)if(pixels[y*4+1]>peak){peak=pixels[y*4+1];row=y;}
   return row/canvas.height;
 });
 const lowRow=await peakRow();
 await page.evaluate(()=>{window.__visualsAudioTest.osc.frequency.value=2200;});
 await expect.poll(peakRow).toBeLessThan(lowRow-.1);
 await page.setViewportSize({width:1000,height:800});
 await expect.poll(async()=>Number(await history.getAttribute('data-history-frames'))).toBeGreaterThanOrEqual(frames);
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
