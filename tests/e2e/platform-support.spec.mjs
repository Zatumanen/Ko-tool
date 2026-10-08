import{test,expect}from '@playwright/test';

const wav=(frames=2400,sampleRate=48000)=>{
  const out=Buffer.alloc(44+2*frames);
  out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);
  out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
  out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
  out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
  out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
  out.write('data',36);out.writeUInt32LE(2*frames,40);
  for(let i=0;i<frames;i++)out.writeInt16LE(Math.round(Math.sin(i*.2)*15000),44+i*2);
  return out;
};

test('desktop browser without WebMIDI explains My EP requirements before opening a device session',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:undefined});
  });
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#error-dialog')).toBeVisible();
  await expect(page.locator('#error-message')).toContainText('Web MIDI with SysEx');
  await expect(page.locator('#error-message')).toContainText('Chrome or Edge');
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
  // Unsupported My EP must not disable the standalone audio converter.
  await expect(page.locator('#audio-upload')).toBeEnabled();
});

test('insecure page receives actionable HTTPS message without attempting MIDI permission',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});
    window.__midiAttempts=0;
    Object.defineProperty(navigator,'requestMIDIAccess',{
      configurable:true,value:async()=>{window.__midiAttempts++;throw new Error('should not reach device');}
    });
  });
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#error-message')).toContainText('HTTPS or http://localhost');
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(()=>window.__midiAttempts)).toBe(0);
});

test('MIDI permission denial displays SysEx instructions rather than generic device failure',async({page})=>{
  await page.addInitScript(()=>{
    window.__midiAttempts=0;
    Object.defineProperty(navigator,'requestMIDIAccess',{
      configurable:true,
      value:async()=>{
        window.__midiAttempts++;
        throw new DOMException('Permission denied','NotAllowedError');
      }
    });
  });
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#error-message')).toContainText('Allow MIDI and SysEx');
  expect(await page.evaluate(()=>window.__midiAttempts)).toBe(1);
});

test('mobile platform is rejected for My EP with desktop guidance',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgent',{
      configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    });
  });
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#error-message')).toContainText('desktop computer');
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
});

test('absence of File System Access save picker uses normal browser WAV download',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:undefined});
  });
  await page.goto('/');
  await expect(page.locator('#platform-notice')).toBeVisible();
  await expect(page.locator('#platform-notice')).toContainText('normal download flow');

  await page.locator('#audio-upload').setInputFiles({
    name:'platform-fallback.wav',mimeType:'audio/wav',buffer:wav()
  });
  await expect(page.locator('.result-item')).toHaveCount(1,{timeout:15000});
  const previewClose=page.locator('#preview-window .preview-close');
  if(await previewClose.isVisible())await previewClose.click();
  const downloadEvent=page.waitForEvent('download');
  await page.locator('.result-item .download').last().click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/platform-fallback.*\.wav$/);
});
