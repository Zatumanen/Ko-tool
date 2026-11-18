import {test,expect} from '@playwright/test';

test('combined Visuals worklets and recorder share one stereo input, surviving theme/paint changes',async({page})=>{
  await page.addInitScript(()=>{
    const fixture=window.__visCombined={requests:0};
    const media=Object.assign(new EventTarget(),{
      enumerateDevices:async()=>[{kind:'audioinput',deviceId:'combined-input',label:'Combined synthetic stereo'}],
      getUserMedia:async request=>{
        if(request.audio?.deviceId?.exact!=='combined-input')throw Error('Unexpected device requested');
        fixture.requests++;
        const context=new AudioContext(),osc=context.createOscillator(),l=context.createGain(),r=context.createGain(),merger=context.createChannelMerger(2),dest=context.createMediaStreamDestination();
        osc.frequency.value=997;l.gain.value=.14;r.gain.value=.14;
        osc.connect(l).connect(merger,0,0);osc.connect(r).connect(merger,0,1);merger.connect(dest);
        dest.channelCount=2;dest.channelCountMode='explicit';osc.start();await context.resume();
        Object.assign(fixture,{context,osc,l,r,dest,stream:dest.stream});
        const end=performance.now()+3000;
        while(dest.stream.getAudioTracks()[0].getSettings().channelCount!==2){
          if(performance.now()>end)throw Error('Stereo negotiation failed');
          await new Promise(requestAnimationFrame);
        }
        return dest.stream;
      }
    });
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
  });
  await page.goto('/');
  await page.locator('#visuals-icon').click();
  await expect(page.locator('[data-source] option')).toHaveCount(2);
  await page.locator('[data-source]').selectOption('combined-input');
  await page.locator('.vis-toolbar [data-action="start"]').click();
  await expect(page.locator('[data-audio-status]')).toContainText('LIVE');
  await page.locator('[data-meter="loudness"]').scrollIntoViewIfNeeded();
  await expect.poll(async()=>Number(await page.locator('[data-meter="loudness"] canvas').getAttribute('data-lufs-seconds'))).toBeGreaterThan(.5);
  await page.locator('[data-meter="output"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-meter="output"] canvas')).toHaveAttribute('data-output-state','ready');
  await expect.poll(async()=>Number(await page.locator('[data-meter="output"] canvas').getAttribute('data-output-left-db'))).toBeGreaterThan(-30);
  await page.locator('[data-meter="stereo"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-meter="stereo"] canvas')).toHaveAttribute('data-stereo-state','stereo');
  await expect.poll(async()=>Number(await page.locator('[data-meter="stereo"] canvas').getAttribute('data-stereo-correlation'))).toBeGreaterThan(.95);
  await page.locator('[data-meter="oscilloscope"]').scrollIntoViewIfNeeded();
  await expect.poll(async()=>Number(await page.locator('[data-meter="oscilloscope"] canvas').getAttribute('data-xy-points'))).toBeGreaterThan(0);
  await page.locator('select[data-xy-mode]').selectOption('artistic');
  await expect(page.locator('[data-meter="oscilloscope"] canvas')).toHaveAttribute('data-xy-mode','artistic');

  await page.getByRole('button',{name:'WAV Recorder',exact:true}).click();
  await page.locator('[data-rec-bits]').selectOption('24');
  await page.locator('[data-rec-command="start"]').click();
  await expect(page.locator('[data-recorder]')).toHaveAttribute('data-rec-state','recording');
  await expect.poll(async()=>Number(await page.locator('[data-recorder]').getAttribute('data-rec-frames'))).toBeGreaterThan(3000);
  await page.locator('[data-theme]').selectOption('mono');
  await page.locator('[data-mono-tone]').selectOption('light');
  await expect(page.locator('[data-recorder]')).toHaveAttribute('data-rec-state','recording');
  await page.locator('[data-rec-command="pause"]').click();
  await expect(page.locator('[data-recorder]')).toHaveAttribute('data-rec-state','paused');
  await page.locator('[data-rec-command="resume"]').click();
  await expect(page.locator('[data-recorder]')).toHaveAttribute('data-rec-state','recording');
  await page.locator('[data-rec-command="stop"]').click();
  await expect(page.locator('[data-recorder]')).toHaveAttribute('data-rec-state','done');
  await expect(page.locator('[data-rec-preview]')).toBeVisible();
  await page.locator('[data-rec-command="discard"]').click();

  // The source format may change while document and all canvases are hidden.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));window.__visCombined.dest.channelCount=1;});
  await expect(page.locator('[data-audio-status]')).toContainText('Формат каналов изменился');
  expect(await page.evaluate(()=>window.__visCombined.requests)).toBe(1);
  expect(await page.evaluate(()=>window.__visCombined.stream.getAudioTracks()[0].readyState)).toBe('ended');
  await page.evaluate(async()=>{window.__visCombined.osc.stop();await window.__visCombined.context.close();});
});
