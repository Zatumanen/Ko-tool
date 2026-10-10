import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

function pcmWav(channels=1,frames=3600,sampleRate=48000){
 const bytes=Buffer.alloc(44+frames*channels*2);
 bytes.write('RIFF',0);
 bytes.writeUInt32LE(bytes.length-8,4);
 bytes.write('WAVEfmt ',8);
 bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);
 bytes.writeUInt16LE(channels,22);
 bytes.writeUInt32LE(sampleRate,24);
 bytes.writeUInt32LE(sampleRate*channels*2,28);
 bytes.writeUInt16LE(channels*2,32);
 bytes.writeUInt16LE(16,34);
 bytes.write('data',36);
 bytes.writeUInt32LE(frames*channels*2,40);
 for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++)
  bytes.writeInt16LE(Math.round((ch?Math.cos(i*.13):Math.sin(i*.1))*12000),44+(i*channels+ch)*2);
 return bytes;
}

function zipWavChannels(data){
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 let offset=0;
 const found=[];
 while(offset+30<=data.length&&view.getUint32(offset,true)===0x04034b50){
  const nameLength=view.getUint16(offset+26,true);
  const extraLength=view.getUint16(offset+28,true);
  const compressedLength=view.getUint32(offset+18,true);
  const payload=offset+30+nameLength+extraLength;
  const name=data.subarray(offset+30,offset+30+nameLength).toString('utf8');
  const wave=data.subarray(payload,payload+compressedLength);
  const header=new DataView(wave.buffer,wave.byteOffset,wave.byteLength);
  expect(wave.subarray(0,4).toString('ascii')).toBe('RIFF');
  expect(wave.subarray(8,12).toString('ascii')).toBe('WAVE');
  found.push({name,channels:header.getUint16(22,true),rate:header.getUint32(24,true)});
  offset=payload+compressedLength;
 }
 return found;
}

test('Original selector keeps mono and stereo layout separately within one processed folder',async({page})=>{
 await page.goto('/');
 const selector=page.locator('[data-group="channels"]');
 await expect(selector.locator('[data-value="original"]')).toBeVisible();
 await expect(selector.locator('[data-value="stereo"]')).toHaveClass(/selected/);
 await selector.locator('[data-value="original"]').click();
 await expect(selector.locator('[data-value="original"]')).toHaveAttribute('aria-selected','true');
 const mono=Array.from(pcmWav(1));
 const stereo=Array.from(pcmWav(2));
 await page.locator('#drop-zone').evaluate((drop,{mono,stereo})=>{
  const sources=[
   new File([new Uint8Array(mono)],'001 Mono.wav',{type:'audio/wav'}),
   new File([new Uint8Array(stereo)],'002 Stereo.wav',{type:'audio/wav'})
  ];
  const children=sources.map(file=>({isFile:true,isDirectory:false,name:file.name,file:resolve=>resolve(file)}));
  let batch=children;
  const directory={isFile:false,isDirectory:true,name:'Mixed Sounds',createReader:()=>({
   readEntries:callback=>{const next=batch;batch=[];callback(next);}
  })};
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{items:[{webkitGetAsEntry:()=>directory}],files:[]}});
  drop.dispatchEvent(event);
 },{mono,stereo});
 await expect(page.locator('#status-bar')).toContainText('Processed 2/2 audio file(s)',{timeout:90000});
 await expect(page.locator('#log-tab')).toContainText('mono (original)');
 await expect(page.locator('#log-tab')).toContainText('stereo (original)');
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.locator('#folder-download-area button').click()
 ]);
 const zip=await fs.readFile(await download.path());
 expect(zipWavChannels(zip)).toEqual([
  {name:'Mono.wav',channels:1,rate:46875},
  {name:'Stereo.wav',channels:2,rate:46875}
 ]);
});
