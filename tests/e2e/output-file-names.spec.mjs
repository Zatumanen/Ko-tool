import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

function sineWav(frames=2400,sampleRate=48000){
 const out=Buffer.alloc(44+frames*2);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);
 out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
 out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
 out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
 out.write('data',36);out.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)out.writeInt16LE(Math.round(Math.sin(i*.18)*9000),44+i*2);
 return out;
}

function zipPaths(buffer){
 const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength),paths=[];
 let offset=0;
 while(offset+30<=buffer.length&&view.getUint32(offset,true)===0x04034b50){
  const length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  const size=view.getUint32(offset+18,true);
  paths.push(buffer.subarray(offset+30,offset+30+length).toString('utf8'));
  offset+=30+length+extra+size;
 }
 return paths;
}

test('a numbered input saves only the name following its three-digit label',async({page})=>{
 await page.goto('/');
 await page.locator('#audio-upload').setInputFiles({
  name:'056 Classic Kick.wav',mimeType:'audio/wav',buffer:sineWav()
 });
 await expect(page.locator('#results-list .result-item')).toHaveCount(1,{timeout:60000});
 await expect(page.locator('#results-list .result-name')).toHaveText('Classic Kick.wav');
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.locator('#results-list .result-item .download').last().click()
 ]);
 expect(download.suggestedFilename()).toBe('Classic Kick.wav');
});

test('batch ZIP strips numeric labels, preserves other names, and never duplicates entry paths',async({page})=>{
 await page.goto('/');
 const wave=Array.from(sineWav());
 await page.locator('#drop-zone').evaluate((drop,wave)=>{
  const children=['001 Kick.wav','056 Snare.wav','002 Kick.wav','Loose.wav'].map(name=>
   new File([new Uint8Array(wave)],name,{type:'audio/wav'}));
  const entries=children.map(file=>({isFile:true,isDirectory:false,name:file.name,file:resolve=>resolve(file)}));
  let remaining=entries;
  const folder={name:'Drum Kit',isFile:false,isDirectory:true,createReader:()=>({
   readEntries:resolve=>{const now=remaining;remaining=[];resolve(now);}
  })};
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{items:[{webkitGetAsEntry:()=>folder}],files:[]}});
  drop.dispatchEvent(event);
 },wave);
 await expect(page.locator('#status-bar')).toContainText('Processed 4/4 audio file(s)',{timeout:90000});
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.locator('#folder-download-area button').click()
 ]);
 const data=await fs.readFile(await download.path());
 assertZip(zipPaths(data));
});

function assertZip(paths){
 expect(paths).toEqual(['Kick.wav','Snare.wav','Kick (2).wav','Loose_x2.wav']);
}
