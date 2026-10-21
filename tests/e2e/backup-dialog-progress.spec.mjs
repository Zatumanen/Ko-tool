import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';
import{inflateRawSync}from 'node:zlib';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const openBackup=async(page,{projects=2,samples=null,selectProject02=false}={})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(({projects,samples})=>{
    window.__fakeEp.seedProjects(projects);
    if(samples!==null)window.__fakeEp.seedSamples(samples,64);
  },{projects,samples});
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:30000});
  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(projects,{timeout:30000});
  if(selectProject02){
    await page.locator('[data-project="02"]').click();
    await expect(page.locator('#ep133-project-inspector')).toContainText('2/2 AVAILABLE');
  }
  await page.locator('#ep133-project-backup').click();
  await expect(page.locator('#ep133-backup-dialog')).toBeVisible();
};

test('9 projects / 331 samples: in-dialog counters reach exact completed file totals without writes',async({page})=>{
  test.setTimeout(150000);
  await openBackup(page,{projects:9,samples:331});
  await page.evaluate(()=>{
    window.__savedBackupFiles=[];
    window.showSaveFilePicker=async options=>{
      const record={name:options.suggestedName,bytes:0,closed:false};
      window.__savedBackupFiles.push(record);
      return{async createWritable(){return{
        async write(blob){record.bytes=(await blob.arrayBuffer()).byteLength;},
        async close(){record.closed=true;}
      };}};
    };
  });
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-backup-device').click();
  await expect(page.locator('#ep133-backup-operation')).toBeVisible();
  await expect(page.locator('#ep133-backup-close')).toBeDisabled();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:120000});
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 9/9 · SAMPLES 331/331');
  await expect(page.locator('#ep133-backup-detail')).toContainText('FILE WRITTEN');
  const outcome=await page.evaluate(start=>({
    saved:window.__savedBackupFiles,
    mutating:window.__fakeEp.requestLog.slice(start).filter(r=>r.command===5&&
      ([2,6,12].includes(r.sub)||(r.sub===7&&r.type===1)))
  }),before);
  expect(outcome.saved).toHaveLength(1);
  expect(outcome.saved[0].closed).toBe(true);
  expect(outcome.saved[0].bytes).toBeGreaterThan(10000);
  expect(outcome.mutating).toEqual([]);
  await expect(page.locator('#ep133-backup-close')).toBeEnabled();
});

test('paused FILE_GET leaves visible activity, identifies current project and forbids cancelling',async({page})=>{
  // Finish inspector's own read before opening the modal and holding P01.
  await openBackup(page,{selectProject02:true});
  await page.evaluate(()=>{
    window.__fakeEp.holdNextGet(3001);
    window.showSaveFilePicker=async()=>({
      async createWritable(){return{async write(){},async close(){}};}
    });
  });
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-backup-device').click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.hasHeldGet),{timeout:1500}).toBe(true);
  await expect(page.locator('#ep133-backup-phase')).toHaveText('READING PROJECTS');
  await expect(page.locator('#ep133-backup-counts')).toContainText('PROJECTS 0/2');
  await expect(page.locator('#ep133-backup-current')).toHaveText('P01.tar');
  await expect(page.locator('#ep133-backup-operation')).toHaveAttribute('data-state','running');
  await expect(page.locator('#ep133-backup-close')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ep133-backup-dialog')).toBeVisible();
  await page.evaluate(()=>window.__fakeEp.releaseHeldGet());
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:25000});
  expect(await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).filter(r=>
    r.command===5&&([2,6,12].includes(r.sub)||(r.sub===7&&r.type===1))
  ),before)).toEqual([]);
});

test('mid-backup FILE_GET error is visible as FAILED; next backup can retry',async({page})=>{
  await openBackup(page);
  await page.evaluate(()=>{
    window.__fakeEp.rejectNextGet(8);
    window.__saveCount=0;
    window.showSaveFilePicker=async()=>{window.__saveCount++;return{
      async createWritable(){return{async write(){},async close(){}};}
    };};
  });
  await page.locator('#ep133-backup-device').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('FAILED',{timeout:20000});
  await expect(page.locator('#ep133-backup-detail')).toContainText('fake file read refused');
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 2/2 · SAMPLES 1/2');
  expect(await page.evaluate(()=>window.__saveCount)).toBe(0);
  await expect(page.locator('#ep133-backup-close')).toBeEnabled();
  await expect(page.locator('#error-dialog')).toBeHidden();
  await page.locator('#ep133-backup-device').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:20000});
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 2/2 · SAMPLES 2/2');
  expect(await page.evaluate(()=>window.__saveCount)).toBe(1);
});

test('picker permission rejection fails visibly without download fallback; close and rerun work',async({page})=>{
  await openBackup(page);
  await page.evaluate(()=>{
    window.__saveAttempts=0;
    window.showSaveFilePicker=async()=>{
      window.__saveAttempts++;
      throw Object.assign(new Error('Saving permission denied'),{name:'NotAllowedError'});
    };
  });
  await page.locator('#ep133-backup-project').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('FAILED',{timeout:20000});
  await expect(page.locator('#ep133-backup-detail')).toContainText('Saving permission denied');
  await expect(page.locator('#error-dialog')).toBeHidden();
  await page.locator('#ep133-backup-close').click();
  await expect(page.locator('#ep133-backup-dialog')).toBeHidden();
  await page.locator('#ep133-project-backup').click();
  await page.evaluate(()=>{
    window.showSaveFilePicker=async()=>({
      async createWritable(){return{async write(){},async close(){}};}
    });
  });
  await page.locator('#ep133-backup-project').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:20000});
  await expect(page.locator('#ep133-backup-detail')).toContainText('FILE WRITTEN');
  expect(await page.evaluate(()=>window.__saveAttempts)).toBe(1);
});


test('CANCEL BACKUP drains the current project FILE_GET, skips subsequent projects and never saves partial output',async({page})=>{
  await openBackup(page,{selectProject02:true});
  await page.evaluate(()=>{
    window.__fakeEp.holdNextGet(3001);
    window.__cancelTestSaved=0;
    window.showSaveFilePicker=async()=>{
      window.__cancelTestSaved++;
      return{async createWritable(){return{async write(){},async close(){}};}};
    };
  });
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await expect(page.locator('#ep133-backup-cancel')).toBeHidden();
  await page.locator('#ep133-backup-device').click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.hasHeldGet),{timeout:15000}).toBe(true);
  await expect(page.locator('#ep133-backup-phase')).toHaveText('READING PROJECTS');
  await expect(page.locator('#ep133-backup-current')).toHaveText('P01.tar');
  const cancel=page.locator('#ep133-backup-cancel');
  await expect(cancel).toBeEnabled();
  await cancel.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ep133-backup-phase')).toHaveText('CANCELLING');
  await expect(cancel).toBeDisabled();
  await expect(page.locator('#ep133-backup-close')).toBeDisabled();
  await expect(page.locator('#ep133-backup-detail')).toContainText('FINISHING CURRENT DEVICE REQUEST');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ep133-backup-dialog')).toBeVisible();
  await page.evaluate(()=>window.__fakeEp.releaseHeldGet());
  await expect(page.locator('#ep133-backup-phase')).toHaveText('CANCELLED',{timeout:15000});
  await expect(page.locator('#ep133-backup-operation')).toHaveAttribute('data-state','cancelled');
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 0/2 · SAMPLES 0/0');
  await expect(page.locator('#ep133-backup-detail')).toContainText('NO PARTIAL ARCHIVE');
  await expect(cancel).toBeHidden();
  await expect(page.locator('#ep133-backup-close')).toBeEnabled();
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),
    saved:window.__cancelTestSaved
  }),before);
  expect(result.saved).toBe(0);
  const projectGetInits=result.requests.filter(r=>r.command===5&&r.sub===3&&r.type===0)
    .map(r=>(r.raw[2]<<8)|r.raw[3]);
  expect(projectGetInits).toEqual([3001]);
  expect(result.requests.filter(r=>r.command===5&&
    ([2,6,12].includes(r.sub)||(r.sub===7&&r.type===1)))).toEqual([]);
  await page.locator('#ep133-backup-device').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:20000});
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 2/2 · SAMPLES 2/2');
  expect(await page.evaluate(()=>window.__cancelTestSaved)).toBe(1);
});

test('cancelling during sample FILE_GET on a 9-project / 331-sample backup stops the rest without output',async({page})=>{
  test.setTimeout(120000);
  await openBackup(page,{projects:9,samples:331});
  await page.evaluate(()=>{
    window.__fakeEp.holdNextGet(1);
    window.__cancelSampleSaved=0;
    window.showSaveFilePicker=async()=>{window.__cancelSampleSaved++;return{
      async createWritable(){return{async write(){},async close(){}};}
    };};
  });
  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-backup-device').click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.hasHeldGet),{timeout:90000}).toBe(true);
  await expect(page.locator('#ep133-backup-phase')).toHaveText('READING SAMPLES');
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 9/9 · SAMPLES 0/331');
  await expect(page.locator('#ep133-backup-current')).toContainText('001');
  await page.locator('#ep133-backup-cancel').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('CANCELLING');
  await page.evaluate(()=>window.__fakeEp.releaseHeldGet());
  await expect(page.locator('#ep133-backup-phase')).toHaveText('CANCELLED',{timeout:15000});
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 9/9 · SAMPLES 0/331');
  const result=await page.evaluate(index=>({
    requests:window.__fakeEp.requestLog.slice(index),
    saved:window.__cancelSampleSaved
  }),start);
  expect(result.saved).toBe(0);
  const soundGets=result.requests.filter(r=>r.command===5&&r.sub===3&&r.type===0)
    .map(r=>(r.raw[2]<<8)|r.raw[3]).filter(id=>id>=1&&id<=999);
  expect(soundGets).toEqual([1]);
});

test('picker cancellation is not reported as a completed backup',async({page})=>{
  await openBackup(page);
  await page.evaluate(()=>{
    window.showSaveFilePicker=async()=>{throw Object.assign(new Error('User cancelled'),{name:'AbortError'});};
  });
  await page.locator('#ep133-backup-project').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:20000});
  await expect(page.locator('#ep133-backup-operation')).toHaveAttribute('data-state','cancelled');
  await expect(page.locator('#ep133-backup-detail')).toContainText('CANCELLED BY USER');
});

const zipMembers=buffer=>{
  const files=new Map(),v=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  let p=0;
  while(p+30<=buffer.length&&v.getUint32(p,true)===0x04034b50){
    const method=v.getUint16(p+8,true),compressed=v.getUint32(p+18,true),
      length=v.getUint16(p+26,true),extra=v.getUint16(p+28,true);
    const name=new TextDecoder().decode(buffer.slice(p+30,p+30+length));
    const start=p+30+length+extra,data=buffer.slice(start,start+compressed);
    files.set(name,{method,data:method===8?inflateRawSync(data):data});
    p=start+compressed;
  }
  return files;
};

test('official project PPAK exports deflated WAV/TAR without changing legacy backup or FILE state',async({page})=>{
  await openBackup(page,{selectProject02:true});
  await page.evaluate(()=>{
    window.__officialSaves=[];
    window.showSaveFilePicker=async ({suggestedName})=>({
      async createWritable(){return{
        async write(blob){
          window.__officialSaves.push({name:suggestedName,bytes:[...new Uint8Array(await blob.arrayBuffer())]});
        },async close(){}
      };}
    });
  });
  const begin=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-backup-official-project').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:25000});
  await expect(page.locator('#ep133-backup-counts')).toHaveText('PROJECTS 1/1 · SAMPLES 2/2');
  const info=await page.evaluate(start=>({
    save:window.__officialSaves[0],
    mutations:window.__fakeEp.requestLog.slice(start).filter(r=>
      r.command===5&&([2,6,12].includes(r.sub)||(r.sub===7&&r.type===1)))
  }),begin);
  expect(info.save.name).toMatch(/\.ppak$/);
  expect(info.mutations).toEqual([]);
  const files=zipMembers(Buffer.from(info.save.bytes));
  expect([...files.keys()]).toEqual([
    '/projects/P02.tar','/sounds/007 kick808.wav','/sounds/008 snare.wav','/meta.json'
  ]);
  for(const item of files.values())expect(item.method).toBe(8);
  const meta=JSON.parse(new TextDecoder().decode(files.get('/meta.json').data));
  expect(meta.pak_type).toBe('project');
  expect(meta.device_version).toBe('2.5.1');
  expect(Object.hasOwn(meta,'serial')).toBe(false);
  const wav=files.get('/sounds/007 kick808.wav').data;
  expect(new TextDecoder().decode(wav.subarray(0,4))).toBe('RIFF');
  expect(Buffer.from(wav).includes(Buffer.from('TNGE'))).toBe(true);
  const dataPos=wav.findIndex((_,i)=>i>=12&&
    wav[i]===100&&wav[i+1]===97&&wav[i+2]===116&&wav[i+3]===97);
  expect(dataPos).toBeGreaterThan(0);
  const pcmSize=new DataView(wav.buffer,wav.byteOffset,wav.byteLength).getUint32(dataPos+4,true);
  expect(pcmSize).toBe(128);
});

test('official whole-device PAK has project TARs and WAV with no samples rewritten',async({page})=>{
  await openBackup(page);
  await page.evaluate(()=>{
    window.__officialSaves=[];
    window.showSaveFilePicker=async ({suggestedName})=>({
      async createWritable(){return{
        async write(blob){window.__officialSaves.push({
          name:suggestedName,bytes:[...new Uint8Array(await blob.arrayBuffer())]
        });},async close(){}
      };}
    });
  });
  await page.locator('#ep133-backup-official-device').click();
  await expect(page.locator('#ep133-backup-phase')).toHaveText('RESULT',{timeout:30000});
  const save=await page.evaluate(()=>window.__officialSaves[0]);
  expect(save.name).toMatch(/\.pak$/);
  const files=zipMembers(Buffer.from(save.bytes));
  expect(files.has('/projects/P01.tar')).toBe(true);
  expect(files.has('/projects/P02.tar')).toBe(true);
  expect(files.has('/sounds/007 kick808.wav')).toBe(true);
  expect(files.has('/meta.json')).toBe(true);
  expect(JSON.parse(new TextDecoder().decode(files.get('/meta.json').data)).pak_type).toBe('user');
});
