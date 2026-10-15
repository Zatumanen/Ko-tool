import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const open=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick808');
};
const wav16=()=>{
 const samples=80;
 const bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);
 bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
 bytes.writeUInt32LE(46875,24);bytes.writeUInt32LE(46875*2,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)bytes.writeInt16LE(Math.round(Math.sin(i*.2)*12000),44+i*2);
 return [...bytes];
};

test('mouse selects rows through readonly names, and guarded deletion still works with device permission',async({page})=>{
 await open(page);
 await page.locator('[data-slot="8"] [data-name-input]').click();
 await expect(page.locator('[data-slot="8"]')).toHaveClass(/selected/);
 await page.locator('[data-slot="7"] [data-name-input]').click();
 await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
 // Project P01 uses slots 007/008/009: deleting those is correctly blocked
 // by the sample-dependency guard. Move a test sample into unreferenced 010.
 await page.locator('[data-slot="8"]').dragTo(page.locator('[data-slot="10"]'));
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===10))).toBe(true);
 await page.locator('[data-slot="10"]').click();
 await page.locator('[data-slot="10"] [data-delete-row]').click();
 await expect(page.locator('#ep133-confirm-dialog')).not.toHaveAttribute('hidden','');
 await page.locator('#ep133-confirm-cancel').click();
 await expect(page.locator('#ep133-confirm-dialog')).toHaveAttribute('hidden','');
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===10))).toBe(true);
 await page.locator('[data-slot="10"] [data-delete-row]').click();
 await expect(page.locator('#ep133-confirm-dialog')).not.toHaveAttribute('hidden','');
 await page.locator('#ep133-confirm-ok').click();
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===10))).toBe(false);
 await expect(page.locator('[data-slot="10"]')).toHaveClass(/empty/);
 await page.locator('#ep133-view-projects').click();
 await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:15000});
 await expect(page.locator('#ep133-project-inspector')).toContainText('READ ONLY');
});

test('device upload from 056-prefixed source writes stripped filename and local device metadata',async({page})=>{
 await open(page);
 await page.evaluate(bytes=>{
  const file=new File([new Uint8Array(bytes)],'056 Vinyl Clap.wav',{type:'audio/wav'});
  const transfer=new DataTransfer();transfer.items.add(file);
  const row=document.querySelector('[data-slot="9"]');
  row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
 },wav16());
 await expect(page.locator('.ep133-upload-choice-dialog')).toBeVisible();
 await page.locator('[data-upload-mode="sequential"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===9)?.meta?.name),{
  message:'Actual device metadata should omit numeric prefix on upload',timeout:20000
 }).toBe('vinyl clap');
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===9)?.name)).toBe('vinyl clap');
 await expect(page.locator('[data-slot="9"] [data-name-input]')).toHaveValue('vinyl clap');
 await expect(page.locator('#ep133-status')).not.toContainText('COULD NOT');
});

test('long WAV filenames preserve the original 16-character EP name through device readback',async({page})=>{
 await open(page);
 await page.evaluate(bytes=>{
   const transfer=new DataTransfer();
   transfer.items.add(new File([new Uint8Array(bytes)],'biggie loop codeinedemonz intro.wav',{type:'audio/wav'}));
   const row=document.querySelector('[data-slot="9"]');
   row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
   row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
 },wav16());
 // A single unnumbered file uploads to the next free slot immediately.
 await expect(page.locator('.ep133-upload-choice-dialog')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===9)?.meta?.name),{
   timeout:25000,message:'EP should preserve the normalized name through PUT and METADATA_SET'
 }).toBe('biggie .nz intro');
 await expect(page.locator('[data-slot="9"] [data-name-input]')).toHaveValue('biggie .nz intro');
 const report=await page.evaluate(()=>({
   slot:window.__fakeEp.snapshot().find(s=>s.id===9),
   errors:document.querySelector('#errors-tab')?.innerText||''
 }));
 expect(report.slot.name).toBe('biggie .nz intro');
 expect(report.errors).not.toContain('Uploaded sample name differs from device metadata readback');
});

test('sample names can be changed by F2 or double click and are confirmed by device readback',async({page})=>{
  await open(page);
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick808');
  await page.locator('[data-slot="7"]').click();
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveAttribute('readonly','');
  await expect.poll(()=>page.evaluate(()=>document.querySelector('[data-slot="7"] [data-name-input]').readOnly)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>!document.querySelector('#ep133-browser').classList.contains('busy'))).toBe(true);
  await page.keyboard.press('F2');
  await expect(page.locator('[data-slot="7"] [data-name-input]')).not.toHaveAttribute('readonly','');
  await page.locator('[data-slot="7"] [data-name-input]').fill('new kick');
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7)?.meta?.name)).toBe('new kick');
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('new kick');
  await page.locator('[data-slot="7"] [data-name-input]').dblclick();
  await expect(page.locator('[data-slot="7"] [data-name-input]')).not.toHaveAttribute('readonly','');
  await page.locator('[data-slot="7"] [data-name-input]').fill('kick 2');
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7)?.meta?.name)).toBe('kick 2');
});

test('multiple converted outputs are dragged to My EP and uploaded with per-file device verification',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  const wav=Buffer.from(wav16());
  await page.locator('#audio-upload').setInputFiles([
    {name:'Kick.wav',mimeType:'audio/wav',buffer:wav},
    {name:'Snare.wav',mimeType:'audio/wav',buffer:wav}
  ]);
  await expect(page.locator('#results-list .result-item')).toHaveCount(2,{timeout:90000});
  await page.locator('#results-list .result-item').first().click();
  await page.locator('#results-list .result-item').last().click({modifiers:['Control']});
  await expect(page.locator('#results-list .result-item.selected')).toHaveCount(2);
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await page.evaluate(()=>{
    const source=document.querySelector('#results-list .result-item');
    const row=document.querySelector('[data-slot="9"]');
    const transfer=new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().filter(s=>s.id===9||s.id===10).map(s=>s.id)),{timeout:25000}).toEqual([9,10]);
  const log=await page.evaluate(()=>window.__fakeEp.requestLog);
  const puts=log.map((entry,index)=>entry.command===5&&entry.sub===2&&entry.raw[1]===0?index:-1).filter(index=>index>=0);
  expect(puts).toHaveLength(2);
  expect(log.slice(puts[0]+1,puts[1]).some(entry=>entry.command===5&&entry.sub===11)).toBe(true);
  await expect(page.locator('[data-slot="9"] [data-name-input]')).toHaveValue('kick_x2');
  await expect(page.locator('[data-slot="10"] [data-name-input]')).toHaveValue('snare_x2');
});

test('selected occupied sample slot number remains readable',async({page})=>{
  await open(page);
  await page.locator('[data-slot="7"]').click();
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
  const style=await page.locator('[data-slot="7"] [data-name-input]').evaluate(el=>{
    const number=el.closest('[data-slot]').querySelector('.ep133-sample-number');
    return{number:getComputedStyle(number).color,row:getComputedStyle(number.closest('[data-slot]')).color};
  });
  expect(style.number).toBe(style.row);
});

test('failed sample upload is marked FAILED and the next queued sample still uploads',async({page})=>{
  await open(page);
  await page.evaluate(()=>window.__fakeEp.rejectUploadSlot(9));
  const bytes=wav16();
  await page.evaluate(bytes=>{
    const transfer=new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)],'First.wav',{type:'audio/wav'}));
    transfer.items.add(new File([new Uint8Array(bytes)],'Second.wav',{type:'audio/wav'}));
    const row=document.querySelector('[data-slot="9"]');
    row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  },bytes);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(s=>s.id===10)),{timeout:25000}).toBe(true);
  const result=await page.evaluate(()=>({
    slots:window.__fakeEp.snapshot().filter(s=>s.id===9||s.id===10).map(s=>s.id),
    puts:window.__fakeEp.requestLog.filter(r=>r.command===5&&r.sub===2&&r.raw[1]===0)
      .map(r=>r.raw[4]+(r.raw[3]<<8))
  }));
  expect(result.slots).toEqual([10]);
  expect(result.puts).toEqual([9,10]);
});
