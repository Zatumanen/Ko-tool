import {test,expect} from '@playwright/test';

function sineWav(frames=4000,sampleRate=48000){
 const bytes=Buffer.alloc(44+frames*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);
 bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
 bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)bytes.writeInt16LE(Math.round(Math.sin(i*.12)*12000),44+i*2);
 return bytes;
}

test('dropping a folder with macOS sidecars and one corrupt WAV still produces a partial ZIP',async({page})=>{
 await page.goto('/');
 const valid=Array.from(sineWav());
 const invalid=Array.from(Buffer.from('this is not a valid audio recording'));
 await page.locator('#drop-zone').evaluate((drop,{valid,invalid})=>{
  const children=[
   new File([new Uint8Array(valid)],'kick.wav',{type:'audio/wav'}),
   new File([new Uint8Array(invalid)],'broken.wav',{type:'audio/wav'}),
   new File([new Uint8Array([0,1,2,3,4])],'._kick.wav',{type:'application/octet-stream'})
  ];
  const entries=children.map(file=>({isFile:true,isDirectory:false,name:file.name,file:resolve=>resolve(file)}));
  let pending=true;
  const directory={name:'BEAT PACK',isFile:false,isDirectory:true,createReader:()=>({
   readEntries:resolve=>{resolve(pending?entries:[]);pending=false;}
  })};
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{items:[{webkitGetAsEntry:()=>directory}],files:[]}});
  drop.dispatchEvent(event);
 },{valid,invalid});
 await expect(page.locator('#status-bar')).toContainText('Processed 1/2 audio file(s)',{timeout:90000});
 await expect(page.locator('#status-bar')).toContainText('1 could not be decoded/processed');
 await expect(page.locator('#status-bar')).toContainText('1 non-audio/metadata ignored');
 await expect(page.locator('#errors-tab')).toContainText('BEAT PACK/broken.wav');
 await expect(page.locator('#errors-tab')).toContainText('PCM WAV');
 await expect(page.locator('#errors-tab')).not.toContainText('._kick.wav');
 await expect(page.locator('#error-message')).toContainText('See Errors tab');
 await page.locator('#error-ok').click();
 const button=page.locator('#folder-download-area button');
 await expect(button).toBeVisible();
 await expect(button).toContainText('BEAT PACK (1 files)');
 const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
 expect(download.suggestedFilename()).toBe('BEAT PACK_x2.zip');
 await expect(page.locator('#overlay')).not.toBeVisible();
});

test('plain dropped files work if the browser exposes files but no FileSystem entries',async({page})=>{
 await page.goto('/');
 const data=Array.from(sineWav(2000));
 await page.locator('#drop-zone').evaluate((drop,data)=>{
  const file=new File([new Uint8Array(data)],'plain.wav',{type:'audio/wav'});
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{items:[{webkitGetAsEntry:()=>null}],files:[file]}});
  drop.dispatchEvent(event);
 },data);
 await expect(page.locator('#status-bar')).toContainText('Processed 1/1 audio file(s)',{timeout:90000});
 await expect(page.locator('#results-list .result-item')).toHaveCount(1);
});
