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


const transientWav=(sampleRate=48000,seconds=2)=>{
  const frames=Math.floor(sampleRate*seconds);
  const buffer=wav16Mono(sampleRate,frames);
  for(let index=0;index<frames;index++)buffer.writeInt16LE(0,44+index*2);
  for(const second of [.30,.80,1.30]){
    const start=Math.floor(second*sampleRate);
    const length=Math.floor(.09*sampleRate);
    for(let offset=0;offset<length&&start+offset<frames;offset++){
      const envelope=Math.exp(-offset/(sampleRate*.018));
      const sample=Math.max(-32767,Math.min(32767,Math.round(Math.sin(offset*.42)*26000*envelope)));
      buffer.writeInt16LE(sample,44+(start+offset)*2);
    }
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


test('waveform chop modes detect transients, build even slices, allow manual marker edits and export ZIP',async({page})=>{
  await page.goto('/');
  await page.locator('#auto-trim').uncheck();
  await page.locator('#audio-upload').setInputFiles({
    name:'transients.wav',
    mimeType:'audio/wav',
    buffer:transientWav()
  });
  await expect(page.locator('.edit-waveform')).toBeVisible({timeout:15000});
  await page.locator('#preview-window .preview-close').click();
  await page.locator('.edit-waveform').click();

  await page.locator('[data-chop-target]').fill('4');
  await page.locator('[data-chop-target]').press('Tab');
  await page.locator('[data-chop-mode="transients"]').click();
  await expect(page.locator('[data-chop-mode="transients"]')).toHaveClass(/active/);
  await expect.poll(async()=>{
    const text=await page.locator('[data-chop-status]').textContent();
    return Number(String(text).match(/\d+/)?.[0]||0);
  }).toBeGreaterThan(1);

  await page.locator('[data-chop-mode="even"]').click();
  await expect(page.locator('[data-chop-status]')).toHaveText('4 SLICES');
  await expect(page.locator('[data-chop-mode="even"]')).toHaveClass(/active/);

  const canvas=page.locator('[data-waveform-canvas]');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.dblclick(box.x+box.width*.36,box.y+box.height*.5);
  await expect(page.locator('[data-chop-mode="manual"]')).toHaveClass(/active/);
  await expect(page.locator('[data-chop-status]')).toHaveText('5 SLICES');
  await expect(page.locator('[data-chop-remove]')).toBeEnabled();

  await page.locator('[data-chop-remove]').click();
  await expect(page.locator('[data-chop-status]')).toHaveText('4 SLICES');

  await page.evaluate(()=>{
    window.__savedChopZip=null;
    window.showSaveFilePicker=async options=>{
      const record={name:options?.suggestedName||'',size:0,type:''};
      window.__savedChopZip=record;
      return{
        async createWritable(){
          return{
            async write(blob){record.size=blob?.size||0;record.type=blob?.type||'';},
            async close(){record.closed=true;}
          };
        }
      };
    };
  });
  await page.locator('[data-chop-export]').click();
  await expect.poll(()=>page.evaluate(()=>window.__savedChopZip)).toMatchObject({
    name:'transients_x2_chops.zip',
    type:'application/zip',
    closed:true
  });
  expect(await page.evaluate(()=>window.__savedChopZip.size)).toBeGreaterThan(200);
  await expect(page.locator('#status-bar')).toContainText('Exported 4 chops');
});


test('reference AudioEngine preserves LOOP playmode and x2 pitch compensation in the actual WAV',async({page})=>{await page.goto('/');await page.locator('.playmode-control [data-value="loop"]').click();await page.locator('#auto-trim').uncheck();await page.locator('#audio-upload').setInputFiles({name:'reference-metadata.wav',mimeType:'audio/wav',buffer:wav16Mono(48000,12000)});await expect(page.locator('.result-item')).toHaveCount(1,{timeout:15000});const result=await page.evaluate(async()=>{const item=[...window.__speedUpperCutFiles.values()][0],bytes=new Uint8Array(await item.result.blob.arrayBuffer()),ascii=(offset,length)=>String.fromCharCode(...bytes.slice(offset,offset+length));let tnge=-1;for(let index=0;index+8<=bytes.length;index++)if(ascii(index,4)==='TNGE'){tnge=index;break;}if(tnge<0)throw new Error('TNGE metadata chunk not found');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(tnge+4,true),metadata=JSON.parse(new TextDecoder().decode(bytes.slice(tnge+8,tnge+8+length)));return{metadata,sampleRate:view.getUint32(24,true),duration:item.result.epStorage.duration};});expect(result.metadata['sound.playmode']).toBe('loop');expect(result.metadata['sound.pitch']).toBe(-12);expect(result.metadata['time.mode']).toBe('off');expect(result.sampleRate).toBe(46875);expect(result.duration).toBeGreaterThan(.12);expect(result.duration).toBeLessThan(.13);});
