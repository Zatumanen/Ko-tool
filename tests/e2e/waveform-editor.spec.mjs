import{test,expect}from '@playwright/test';

const wav16Mono=(sampleRate=48000,frames=48000)=>{
  const dataSize=frames*2;
  const buffer=Buffer.alloc(44+dataSize);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataSize,4);buffer.write('WAVE',8);
  buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);
  buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(dataSize,40);
  for(let index=0;index<frames;index++){
    const sample=Math.round(Math.sin(index/37)*9000);
    buffer.writeInt16LE(sample,44+index*2);
  }
  return buffer;
};

test('SpeedUpperCut waveform editor crops, adjusts gain, normalizes and replaces the EP-ready result',async({page})=>{
  await page.goto('/');
  const wav=wav16Mono();
  await page.locator('#audio-upload').setInputFiles({
    name:'waveform-test.wav',
    mimeType:'audio/wav',
    buffer:wav
  });

  await expect(page.locator('.result-item')).toHaveCount(1,{timeout:15000});
  await expect(page.locator('.result-item .edit-waveform')).toBeVisible();
  await page.locator('#preview-window .preview-close').click();

  const before=await page.evaluate(()=>{
    const item=[...window.__speedUpperCutFiles.values()][0];
    return{
      duration:item?.result?.epStorage?.duration,
      size:item?.result?.blob?.size,
      length:item?.result?.buffer?.length
    };
  });
  expect(before.duration).toBeGreaterThan(.45);
  expect(before.duration).toBeLessThan(.55);

  await page.locator('.edit-waveform').click();
  await expect(page.locator('#waveform-editor')).toBeVisible();
  await expect(page.locator('[data-waveform-canvas]')).toBeVisible();

  await page.locator('[data-waveform-start]').fill('0.100');
  await page.locator('[data-waveform-start]').press('Tab');
  await page.locator('[data-waveform-end]').fill('0.300');
  await page.locator('[data-waveform-end]').press('Tab');
  await expect(page.locator('[data-waveform-duration]')).toHaveText('00:00.200');

  await page.locator('[data-waveform-zoom]').fill('4');
  await expect(page.locator('[data-waveform-zoom-label]')).toHaveText('4×');
  await page.locator('[data-waveform-gain]').fill('-6');
  await expect(page.locator('[data-waveform-gain-label]')).toHaveText('-6 dB');
  await page.locator('[data-waveform-normalize]').check();

  await page.locator('[data-waveform-apply]').click();
  await expect(page.locator('#waveform-editor')).toHaveCount(0);
  await expect(page.locator('.result-item')).toHaveAttribute('data-edited','true');

  const after=await page.evaluate(()=>{
    const item=[...window.__speedUpperCutFiles.values()][0];
    return{
      duration:item?.result?.epStorage?.duration,
      size:item?.result?.blob?.size,
      length:item?.result?.buffer?.length,
      edit:item?.result?.edit,
      type:item?.result?.blob?.type
    };
  });
  expect(after.duration).toBeGreaterThan(.19);
  expect(after.duration).toBeLessThan(.21);
  expect(after.duration).toBeLessThan(before.duration);
  expect(after.length).toBeLessThan(before.length);
  expect(after.edit).toMatchObject({start:.1,end:.3,gainDb:-6,normalize:true});
  expect(after.type).toBe('audio/wav');
  expect(after.size).toBeGreaterThan(100);

  await page.locator('.result-item .download').last().click();
});

test('waveform editor Reset restores full-range selection and neutral processing controls',async({page})=>{
  await page.goto('/');
  await page.locator('#audio-upload').setInputFiles({
    name:'waveform-reset.wav',
    mimeType:'audio/wav',
    buffer:wav16Mono(48000,24000)
  });
  await expect(page.locator('.edit-waveform')).toBeVisible({timeout:15000});
  await page.locator('#preview-window .preview-close').click();
  await page.locator('.edit-waveform').click();

  const originalEnd=Number(await page.locator('[data-waveform-end]').inputValue());
  await page.locator('[data-waveform-start]').fill('0.050');
  await page.locator('[data-waveform-start]').press('Tab');
  await page.locator('[data-waveform-gain]').fill('9');
  await page.locator('[data-waveform-normalize]').check();
  await page.locator('[data-waveform-zoom]').fill('8');
  await page.locator('[data-waveform-reset]').click();

  expect(Number(await page.locator('[data-waveform-start]').inputValue())).toBe(0);
  expect(Number(await page.locator('[data-waveform-end]').inputValue())).toBeCloseTo(originalEnd,2);
  await expect(page.locator('[data-waveform-gain]')).toHaveValue('0');
  await expect(page.locator('[data-waveform-zoom]')).toHaveValue('1');
  await expect(page.locator('[data-waveform-normalize]')).not.toBeChecked();
});
