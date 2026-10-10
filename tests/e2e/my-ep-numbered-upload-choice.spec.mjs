import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';
const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const open=async page=>{
 await page.addInitScript({path:fakeEpScript});
 await page.goto('/');
 await page.locator('#my-ep-icon').click();
 await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
 await expect(page.locator('[data-slot="7"]')).toHaveClass(/occupied/);
};
const wave=()=>{
 const b=Buffer.alloc(44+80*2);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);
 b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(46875,24);b.writeUInt32LE(46875*2,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(80*2,40);
 for(let i=0;i<80;i++)b.writeInt16LE(Math.round(Math.sin(i*.2)*12000),44+i*2);
 return Array.from(b);
};
const drop=async(page,names,slot=9)=>{
 await page.locator('[data-slot="'+slot+'"]').evaluate((row,{names,bytes})=>{
  const dt=new DataTransfer();
  for(const name of names)dt.items.add(new File([new Uint8Array(bytes)],name,{type:'audio/wav'}));
  row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
 },{names,bytes:wave()});
};
const snapshot=page=>page.evaluate(()=>window.__fakeEp.snapshot());

test('numbered modal appears before FILE write; cancel leaves device unchanged',async({page})=>{
 await open(page);
 const before=await snapshot(page);
 await drop(page,['056 Vinyl Clap.wav']);
 await expect(page.locator('.ep133-upload-choice-dialog')).toBeVisible();
 await expect(page.locator('[data-upload-mode="numbered"]')).toBeEnabled();
 await expect(page.locator('[data-upload-mode="sequential"]')).toBeEnabled();
 await expect(page.locator('.ep133-upload-choice-preview')).toContainText('056 ← 056 Vinyl Clap.wav');
 expect(await snapshot(page)).toEqual(before);
 await page.locator('[data-upload-mode="cancel"]').click();
 await expect(page.locator('.ep133-upload-choice-dialog')).toHaveCount(0);
 expect(await snapshot(page)).toEqual(before);
 await drop(page,['056 Vinyl Clap.wav']);
 await page.locator('[data-upload-mode="numbered"]').click();
 await expect.poll(async()=> (await snapshot(page)).find(x=>x.id===56)?.meta?.name,{timeout:12000}).toBe('vinyl clap');
 await expect(page.locator('[data-slot="56"]')).toHaveClass(/occupied/);
 expect((await snapshot(page)).some(x=>x.id===9)).toBe(false);
});

test('user can choose legacy next-free mode even when a filename contains 999',async({page})=>{
 await open(page);
 await drop(page,['999 Snare.wav']);
 await expect(page.locator('.ep133-upload-choice-dialog')).toBeVisible();
 await page.locator('[data-upload-mode="sequential"]').click();
 await expect.poll(async()=> (await snapshot(page)).find(x=>x.id===9)?.meta?.name,{timeout:12000}).toBe('snare');
 expect((await snapshot(page)).some(x=>x.id===999)).toBe(false);
});

test('occupied or duplicate numbered targets disable that choice, preserving safe next-free option',async({page})=>{
 await open(page);
 await drop(page,['007 Existing.wav']);
 await expect(page.locator('[data-upload-mode="numbered"]')).toBeDisabled();
 await expect(page.locator('.ep133-upload-choice-warning')).toContainText('Slot 007 already contains a sample');
 await expect(page.locator('[data-upload-mode="sequential"]')).toBeEnabled();
 await page.keyboard.press('Escape');
 await expect(page.locator('.ep133-upload-choice-dialog')).toHaveCount(0);
 expect((await snapshot(page)).find(x=>x.id===7)?.name).toBe('kick808');
 await drop(page,['012 First.wav','012 Second.wav']);
 await expect(page.locator('[data-upload-mode="numbered"]')).toBeDisabled();
 await expect(page.locator('.ep133-upload-choice-warning')).toContainText('Multiple files specify slot 012');
 await page.locator('[data-upload-mode="cancel"]').click();
 expect((await snapshot(page)).some(x=>x.id===12)).toBe(false);
});

test('mixed batch maps numbered filename to exact slot and unnumbered to next free',async({page})=>{
 await open(page);
 await drop(page,['056 Clap.wav','Loose.wav']);
 await expect(page.locator('.ep133-upload-choice-preview')).toContainText('056 ← 056 Clap.wav');
 await expect(page.locator('.ep133-upload-choice-preview')).toContainText('009 ← Loose.wav');
 await page.locator('[data-upload-mode="numbered"]').click();
 await expect.poll(async()=> (await snapshot(page)).find(x=>x.id===56)?.meta?.name,{timeout:15000}).toBe('clap');
 await expect.poll(async()=> (await snapshot(page)).find(x=>x.id===9)?.meta?.name,{timeout:15000}).toBe('loose');
});
