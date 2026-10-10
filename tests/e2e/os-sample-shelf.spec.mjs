import {test,expect} from '@playwright/test';

function sineWav(frames=1600,sr=48000){
 const o=Buffer.alloc(44+frames*2);
 o.write('RIFF',0);o.writeUInt32LE(o.length-8,4);
 o.write('WAVEfmt ',8);o.writeUInt32LE(16,16);
 o.writeUInt16LE(1,20);o.writeUInt16LE(1,22);
 o.writeUInt32LE(sr,24);o.writeUInt32LE(sr*2,28);
 o.writeUInt16LE(2,32);o.writeUInt16LE(16,34);
 o.write('data',36);o.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)o.writeInt16LE(Math.round(Math.sin(i*.13)*12000),44+i*2);
 return o;
}
const shelfRows=page=>page.locator('.os-shelf-entry');
const originalFile={name:'kick-offline.wav',mimeType:'audio/wav',buffer:sineWav(24000)};

test('offline Sample Shelf retains actual audio after reload and prepares it with the existing processor',async({page})=>{
 await page.goto('/os/index.html');
 await expect(page.locator('#os-shelf-upload')).toBeAttached();
 await expect(page.locator('#os-embedded-my-ep')).not.toHaveAttribute('src',/os-embed/);
 await page.locator('#os-shelf-upload').setInputFiles(originalFile);
 await expect(shelfRows(page)).toHaveCount(1,{timeout:15000});
 await expect(page.locator('#os-shelf-count')).toHaveText('1 STORED');
 await expect(page.locator('#os-shelf-message')).toContainText('1 added');
 await expect(page.locator('.os-file-entry')).toHaveCount(0);
 await page.reload();
 await expect(shelfRows(page)).toHaveCount(1,{timeout:15000});
 await expect(page.locator('.os-shelf-entry-main')).toContainText('kick-offline.wav');
 await page.locator('[data-shelf-action="prepare"]').click();
 await expect(page.locator('.os-file-entry')).toHaveCount(1,{timeout:30000});
 await expect(page.locator('#os-sample-name')).toHaveText('kick-offline_x2.wav');
 await expect(page.locator('#os-embedded-my-ep')).not.toHaveAttribute('src',/os-embed/);
 await page.reload();
 await expect(shelfRows(page)).toHaveCount(1);
 await expect(page.locator('.os-file-entry')).toHaveCount(0);
 await page.locator('[data-shelf-action="remove"]').click();
 await expect(shelfRows(page)).toHaveCount(0);
 await page.reload();
 await expect(shelfRows(page)).toHaveCount(0);
});

test('offline shelf deduplicates by content, supports folder paths and searches without HTML injection',async({page})=>{
 await page.goto('/os/index.html');
 await page.locator('#os-shelf-upload').setInputFiles(originalFile);
 await expect(shelfRows(page)).toHaveCount(1);
 await page.locator('#os-shelf-upload').setInputFiles({name:'same-audio-different-name.wav',mimeType:'audio/wav',buffer:originalFile.buffer});
 await expect(page.locator('#os-shelf-message')).toContainText('1 duplicates');
 await expect(shelfRows(page)).toHaveCount(1);
 // The directory chooser supplies webkitRelativePath; emulate this File API
 // metadata to keep the test independent of host filesystem dialogs.
 const nested=Array.from(sineWav(800));
 await page.locator('#os-shelf-folder').evaluate((input,bytes)=>{
  const file=new File([new Uint8Array(bytes)],'hat <unsafe>.wav',{type:'audio/wav'});
  Object.defineProperty(file,'webkitRelativePath',{value:'DRUMS/NESTED/hat <unsafe>.wav'});
  const transfer=new DataTransfer();transfer.items.add(file);
  input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 },nested);
 await expect(shelfRows(page)).toHaveCount(2);
 await expect(page.locator('.os-shelf-entry-main')).toContainText(['kick-offline.wav','hat <unsafe>.wav']);
 await expect(page.locator('#os-shelf-list img')).toHaveCount(0);
 await page.locator('#os-shelf-search').fill('nested');
 await expect(shelfRows(page)).toHaveCount(1);
 await expect(shelfRows(page)).toContainText('DRUMS/NESTED');
 await page.locator('#os-shelf-search').fill('nothing-matches');
 await expect(shelfRows(page)).toHaveCount(0);
 await page.locator('#os-shelf-search').fill('');
 await expect(shelfRows(page)).toHaveCount(2);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#os-shelf-clear').click();
 await expect(shelfRows(page)).toHaveCount(0);
 await page.reload();
 await expect(shelfRows(page)).toHaveCount(0);
});

test('offline shelf rejects unsupported files and atomically keeps completed files when batch cancelled',async({page})=>{
 await page.goto('/os/index.html');
 const result=await page.evaluate(async()=>{
  const {createSampleShelf}=await import('/os/sampleShelf.js');
  const shelf=createSampleShelf();
  const bytes=new Uint8Array([1,2,3,4,5,6,7,8]);
  const controller=new AbortController();
  const status=await shelf.importFiles([
   new File([bytes],'one.wav',{type:'audio/wav'}),
   new File([bytes],'two.wav',{type:'audio/wav'}),
   new File([bytes],'bad.txt',{type:'text/plain'})
  ],{signal:controller.signal,onProgress:p=>{if(p.index===1)controller.abort();}});
  const entries=await shelf.list();
  return {status,entries:entries.map(x=>x.name)};
 });
 expect(result.status.added).toBe(1);
 expect(result.status.cancelled).toBe(true);
 expect(result.entries).toEqual(['one.wav']);
 await page.reload();
 await expect(shelfRows(page)).toHaveCount(1);
 await page.locator('#os-shelf-upload').setInputFiles({name:'not-a-wave.txt',mimeType:'text/plain',buffer:Buffer.from('unsupported')});
 await expect(page.locator('#os-shelf-message')).toContainText('1 unsupported');
 await expect(shelfRows(page)).toHaveCount(1);
});
