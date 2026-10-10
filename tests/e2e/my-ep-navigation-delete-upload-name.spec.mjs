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
