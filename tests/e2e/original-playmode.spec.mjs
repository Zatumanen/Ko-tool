import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

function wav({mode=null,frames=4800,sampleRate=48000}={}){
 const audio=Buffer.alloc(44+frames*2);
 audio.write('RIFF',0);audio.write('WAVEfmt ',8);
 audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);
 audio.writeUInt32LE(sampleRate,24);audio.writeUInt32LE(sampleRate*2,28);
 audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);
 audio.write('data',36);audio.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)audio.writeInt16LE(Math.round(Math.sin(i*.13)*12000),44+i*2);
 if(mode===null){
  audio.writeUInt32LE(audio.length-8,4);
  return audio;
 }
 const json=Buffer.from(JSON.stringify({'sound.playmode':mode}),'utf8');
 const payloadSize=4+8+json.length+(json.length&1),chunk=Buffer.alloc(8+payloadSize);
 chunk.write('LIST',0);chunk.writeUInt32LE(payloadSize,4);
 chunk.write('INFO',8);chunk.write('TNGE',12);chunk.writeUInt32LE(json.length,16);
 json.copy(chunk,20);
 const result=Buffer.concat([audio,chunk]);
 result.writeUInt32LE(result.length-8,4);
 return result;
}
function readPlaymode(wavBytes){
 const index=wavBytes.indexOf(Buffer.from('TNGE'));
 expect(index).toBeGreaterThan(0);
 const length=wavBytes.readUInt32LE(index+4);
 const raw=wavBytes.subarray(index+8,index+8+length);
 const terminator=raw.indexOf(0);
 const json=(terminator<0?raw:raw.subarray(0,terminator)).toString('utf8').trim();
 return JSON.parse(json)['sound.playmode'];
}

test('Original Playmode preserves each embedded mode in a mixed batch and identifies the fallback',async({page})=>{
 await page.goto('/');
 const list=page.locator('.playmode-control .win95-list');
 await expect(list.locator('[data-value="original"]')).toBeVisible();
 await expect(list.locator('[data-value="oneshot"]')).toHaveClass(/selected/);
 await list.locator('[data-value="original"]').click();
 await expect(list.locator('[data-value="original"]')).toHaveAttribute('aria-selected','true');

 await page.locator('#audio-upload').setInputFiles([
  {name:'Source Loop.wav',mimeType:'audio/wav',buffer:wav({mode:'loop'})},
  {name:'Source Key.wav',mimeType:'audio/wav',buffer:wav({mode:'key'})},
  {name:'No Metadata.wav',mimeType:'audio/wav',buffer:wav()}
 ]);
 await expect(page.locator('#status-bar')).toContainText('Processed 3/3 audio file(s)',{timeout:90000});
 await expect(page.locator('#log-tab')).toContainText('original → loop');
 await expect(page.locator('#log-tab')).toContainText('original → key');
 await expect(page.locator('#log-tab')).toContainText('original → oneshot (no source mode; default)');
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
 const rows=page.locator('#results-list .result-item');
 await expect(rows).toHaveCount(3);
 const expected=['loop','key','oneshot'];
 for(let i=0;i<3;i++){
  const [download]=await Promise.all([
   page.waitForEvent('download'),rows.nth(i).locator('.download').last().click()
  ]);
  expect(readPlaymode(await fs.readFile(await download.path()))).toBe(expected[i]);
 }
});
