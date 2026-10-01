import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');

const installFake=async page=>{
  await page.addInitScript({path:fakeEpScript});
};

const openMyEp=async page=>{
  await page.goto('/');
  expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.midiAccessRequests.length),{
    message:'My EP should request Web MIDI after acquiring the device session'
  }).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.requestCount),{
    message:'Fake EP should receive GREET after identity discovery'
  }).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>{
    const status=document.querySelector('#ep133-status')?.textContent||'';
    const overlay=document.querySelector('#ep133-connection-overlay')?.textContent||'';
    if(status.startsWith('SYNCED ·')&&!status.includes('LOADING')&&overlay==='')return'SYNCED';
    return JSON.stringify({
      status,
      overlay,
      error:document.querySelector('#error-message')?.textContent||document.querySelector('.error-message')?.textContent||'',
      requests:window.__fakeEp.requestLog,
      snapshot:window.__fakeEp.snapshot()
    });
  }),{message:'My EP should finish GREET and sample-library bootstrap',timeout:7000}).toBe('SYNCED');
  await expect(page.locator('.ep133-sample-row.occupied')).toHaveCount(2);
};

const wav16Mono=(sampleRate=46875,frames=64)=>{
  const dataSize=frames*2;
  const buffer=Buffer.alloc(44+dataSize);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataSize,4);buffer.write('WAVE',8);
  buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);
  buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(dataSize,40);
  for(let i=0;i<frames;i++)buffer.writeInt16LE(Math.round(Math.sin(i/5)*12000),44+i*2);
  return [...buffer];
};

test('My EP connects, syncs, searches, renames, uploads, moves and deletes through the real DOM',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick808');
  await expect(page.locator('[data-slot="8"] [data-name-input]')).toHaveValue('snare');

  await page.locator('[data-tab="1"]').click();
  await expect(page.locator('[data-slot="7"]')).toHaveCount(0);

  const search=page.locator('#ep133-sample-search');
  await search.fill('kick808 7007');
  await expect(page.locator('.ep133-sample-row')).toHaveCount(1);
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/search-match/);
  await expect(page.locator('#ep133-search-count')).toHaveText('1 MATCH');

  await search.fill('46875');
  await expect(page.locator('.ep133-sample-row')).toHaveCount(2);
  await expect(page.locator('#ep133-search-count')).toHaveText('2 MATCHES');
  await search.press('ArrowDown');
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
  await search.press('ArrowDown');
  await expect(page.locator('[data-slot="8"]')).toHaveClass(/selected/);

  await search.fill('008');
  await expect(page.locator('.ep133-sample-row')).toHaveCount(1);
  await expect(page.locator('[data-slot="8"]')).toBeVisible();

  await search.fill('definitely-no-match');
  await expect(page.locator('.ep133-sample-row')).toHaveCount(0);
  await expect(page.locator('#ep133-search-count')).toHaveText('0 MATCHES');
  await expect(page.locator('.ep133-search-empty')).toHaveText('NO MATCHES');

  await page.locator('#ep133-search-clear').click();
  await expect(page.locator('#ep133-search-count')).toBeHidden();
  await expect(page.locator('.ep133-sample-row')).toHaveCount(99);

  const name=page.locator('[data-slot="7"] [data-name-input]');
  await name.dblclick();
  await expect(page.locator('[data-slot="7"] [data-name-input]')).not.toHaveAttribute('readonly','');
  await page.locator('[data-slot="7"] [data-name-input]').fill('kick-new');
  await page.locator('[data-slot="7"] [data-name-input]').press('Enter');
  await expect.poll(()=>page.evaluate(()=>{
    const mutation=window.__fakeEp.requestLog.find(item=>item.command===5&&item.sub===7&&item.type===1);
    const error=document.querySelector('#error-message')?.textContent||'';
    const technical=document.querySelector('#log-tab')?.textContent||'';
    return mutation?{sent:true,id:(mutation.raw[2]<<8)|mutation.raw[3],raw:mutation.raw}:{
      sent:false,error,technical,requests:window.__fakeEp.requestLog
    };
  }),{message:'Rename should send FILE METADATA SET',timeout:7000}).toMatchObject({sent:true,id:7});
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(x=>x.id===7)?.meta?.name),{
    message:'Fake EP should commit renamed metadata after METADATA SET'
  }).toBe('kick-new');
  await expect(page.locator('[data-slot="7"] [data-name-input]')).toHaveValue('kick-new');

  const wav=wav16Mono();
  await page.evaluate(bytes=>{
    const file=new File([new Uint8Array(bytes)],'hat.wav',{type:'audio/wav'});
    const dt=new DataTransfer();dt.items.add(file);
    const row=document.querySelector('[data-slot="9"]');
    row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },wav);
  await expect.poll(()=>page.evaluate(()=>{
    const snapshot=window.__fakeEp.snapshot();
    if(snapshot.some(x=>x.id===9))return'uploaded';
    return JSON.stringify({
      error:document.querySelector('#error-message')?.textContent||document.querySelector('.error-message')?.textContent||'',
      technical:document.querySelector('#log-tab')?.textContent||'',
      requests:window.__fakeEp.requestLog,
      snapshot
    });
  }),{message:'WAV drop should complete FILE PUT into slot 9',timeout:10000}).toBe('uploaded');
  await expect(page.locator('[data-slot="9"]')).toHaveClass(/occupied/);

  await page.locator('[data-slot="8"]').dragTo(page.locator('[data-slot="10"]'));
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===10))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===8))).toBe(false);
  await expect(page.locator('[data-slot="10"]')).toHaveClass(/occupied/);
  await expect(page.locator('[data-slot="8"]')).toHaveClass(/empty/);

  await page.locator('[data-slot="10"]').click();
  await page.locator('[data-slot="10"] [data-delete-row]').click();
  await expect(page.locator('#ep133-confirm-dialog')).not.toHaveAttribute('hidden','');
  await page.locator('#ep133-confirm-ok').click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(x=>x.id===10))).toBe(false);
  await expect(page.locator('[data-slot="10"]')).toHaveClass(/empty/);

  expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests)).toEqual([{sysex:true}]);
});

test('a second Ko-tool tab is blocked while the first tab owns the EP session',async({context})=>{
  const first=await context.newPage();
  const second=await context.newPage();
  await installFake(first);
  await installFake(second);
  await openMyEp(first);

  await second.goto('/');
  await second.locator('#my-ep-icon').click();
  await expect(second.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(second.locator('#ep133-connection-overlay')).toHaveText('OPEN IN ANOTHER KO-TOOL TAB');
  expect(await second.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);

  await first.close();
  await second.locator('#ep133-close').click();
  await second.locator('#my-ep-icon').click();
  await expect(second.locator('#ep133-connection-overlay')).toHaveText('');
  await expect(second.locator('#ep133-status')).toContainText('SYNCED');
  expect(await second.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(1);
});

test('strict mutation firmware debug enters the unsafe recovery state in the browser',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await page.evaluate(()=>window.__fakeEp.debugNextMutation());
  const input=page.locator('[data-slot="7"] [data-name-input]');
  await input.dblclick();
  await page.locator('[data-slot="7"] [data-name-input]').fill('unsafe-test');
  await page.locator('[data-slot="7"] [data-name-input]').press('Enter');
  await expect.poll(()=>page.evaluate(()=>{
    const sent=window.__fakeEp.requestLog.some(item=>item.command===5&&item.sub===7&&item.type===1);
    return sent?'sent':JSON.stringify({
      error:document.querySelector('#error-message')?.textContent||'',
      technical:document.querySelector('#log-tab')?.textContent||'',
      requests:window.__fakeEp.requestLog
    });
  }),{
    message:'Unsafe scenario should reach the strict METADATA SET mutation',
    timeout:7000
  }).toBe('sent');

  await expect(page.locator('#ep133-connection-overlay')).toHaveText('POWER CYCLE EP · THEN RELOAD');
  await expect(page.locator('#ep133-status')).toContainText('EP FILE SAFETY LOCK');
  await expect(page.locator('#ep133-browser')).toHaveClass(/device-disconnected/);
});


test('My EP Projects view lists and inspects projects without sending any mutation command',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('#ep133-projects-panel')).toBeVisible();
  await expect(page.locator('#ep133-samples-panel')).toBeHidden();

  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
  await expect(page.locator('[data-project="01"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-project-inspector')).toContainText('P01');
  await expect(page.locator('#ep133-project-inspector')).toContainText('READ ONLY');
  await expect(page.locator('#ep133-project-inspector')).toContainText('ACTIVE');
  await expect(page.locator('#ep133-project-inspector')).toContainText('123.5');
  await expect(page.locator('#ep133-project-inspector')).toContainText('REVERB');
  await expect(page.locator('#ep133-project-inspector')).toContainText('007');
  await expect(page.locator('#ep133-project-inspector')).toContainText('008');
  await expect(page.locator('#ep133-project-inspector')).toContainText('009');
  await expect(page.locator('#ep133-project-inspector')).toContainText('2/3 AVAILABLE');
  await expect(page.locator('#ep133-project-inspector')).toContainText('1 MISSING');
  await expect(page.locator('[data-dependency-slot="007"]')).toContainText('kick808');
  await expect(page.locator('[data-dependency-slot="007"]')).toContainText('AVAILABLE');
  await expect(page.locator('[data-dependency-slot="008"]')).toContainText('snare');
  await expect(page.locator('[data-dependency-slot="009"]')).toContainText('MISSING');
  await expect(page.locator('#ep133-project-inspector')).toContainText('A01');
  await expect(page.locator('#ep133-project-inspector')).toContainText('D01');

  const mutationRequests=await page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>
    item.command===5&&(
      item.sub===2||
      item.sub===6||
      item.sub===12||
      (item.sub===7&&item.type===1)
    )
  ));
  expect(mutationRequests).toEqual([]);

  await page.locator('[data-project="02"]').click();
  await expect(page.locator('[data-project="02"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-project-inspector')).toContainText('P02');
  await expect(page.locator('#ep133-project-inspector .ep-project-inspector-head b')).toHaveCount(0);

  await page.locator('#ep133-view-samples').click();
  await expect(page.locator('#ep133-samples-panel')).toBeVisible();
  await expect(page.locator('#ep133-projects-panel')).toBeHidden();
});


test('My EP backup restore and recovery UI safely restores inactive P02 plus an empty sample dependency',async({page})=>{
  await installFake(page);
  await openMyEp(page);
  await page.evaluate(()=>{
    window.__savedBackupFiles=[];
    window.showSaveFilePicker=async options=>{
      const record={name:options?.suggestedName||'',type:'',size:0,bytes:[],closed:false};
      window.__savedBackupFiles.push(record);
      return{
        async createWritable(){
          return{
            async write(blob){
              const data=new Uint8Array(await blob.arrayBuffer());
              record.type=blob.type||'';
              record.size=data.byteLength;
              record.bytes=[...data];
            },
            async close(){record.closed=true;}
          };
        }
      };
    };
  });

  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
  await expect(page.locator('#ep133-project-inspector')).toContainText('P01');
  await page.locator('[data-project="02"]').click();
  await expect(page.locator('[data-project="02"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-project-inspector')).toContainText('2/2 AVAILABLE');

  await page.locator('#ep133-project-backup').click();
  await expect(page.locator('#ep133-backup-dialog')).toBeVisible();
  await expect(page.locator('[data-backup-panel]')).toBeVisible();
  await expect(page.locator('[data-recovery-panel]')).toBeHidden();

  await page.locator('#ep133-backup-project').click();
  await expect.poll(()=>page.evaluate(()=>window.__savedBackupFiles.length),{timeout:15000}).toBe(1);
  const rawProject=await page.evaluate(()=>window.__savedBackupFiles[0]);
  expect(rawProject.name).toBe('P02.tar');
  expect(rawProject.type).toBe('application/x-tar');
  expect(rawProject.size).toBeGreaterThan(1024);

  await page.locator('#ep133-backup-project-samples').click();
  await expect.poll(()=>page.evaluate(()=>window.__savedBackupFiles.length),{timeout:15000}).toBe(2);
  const saved=await page.evaluate(()=>window.__savedBackupFiles[1]);
  expect(saved.name).toContain('P02_samples');
  expect(saved.type).toBe('application/zip');
  expect(saved.size).toBeGreaterThan(500);
  expect(saved.closed).toBe(true);

  await page.locator('#ep133-backup-device').click();
  await expect.poll(()=>page.evaluate(()=>window.__savedBackupFiles.length),{timeout:15000}).toBe(3);
  const deviceBackup=await page.evaluate(()=>window.__savedBackupFiles[2]);
  expect(deviceBackup.name).toContain('device');
  expect(deviceBackup.size).toBeGreaterThan(saved.size);

  const backupMutationLog=await page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>
    item.command===5&&(item.sub===2||item.sub===6||item.sub===12||(item.sub===7&&item.type===1))
  ));
  expect(backupMutationLog).toEqual([]);

  await page.evaluate(()=>window.__fakeEp.removeSample(8));
  await page.locator('#ep133-restore-file').setInputFiles({
    name:saved.name,
    mimeType:'application/zip',
    buffer:Buffer.from(saved.bytes)
  });
  await expect(page.locator('#ep133-restore-summary')).toContainText('P02');
  await expect(page.locator('#ep133-restore-summary')).toContainText('RESTORE SAMPLES');
  await expect(page.locator('#ep133-restore-summary')).toContainText('1');
  await expect(page.locator('#ep133-restore-summary')).toContainText('ALREADY MATCH');
  await expect(page.locator('#ep133-restore-summary')).toContainText('0');
  await expect(page.locator('#ep133-restore-run')).toBeEnabled();

  await page.locator('#ep133-restore-run').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await page.locator('#ep133-confirm-ok').click();

  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().some(item=>item.id===8)),{timeout:15000}).toBe(true);
  await expect(page.locator('#ep133-status')).toContainText('RESTORE P02 VERIFIED',{timeout:15000});

  const mutationLog=await page.evaluate(()=>window.__fakeEp.requestLog.filter(item=>
    item.command===5&&(item.sub===2||item.sub===6||(item.sub===7&&item.type===1))
  ));
  expect(mutationLog.some(item=>item.sub===2&&item.type===0&&((item.raw[3]<<8)|item.raw[4])===8)).toBe(true);
  expect(mutationLog.some(item=>item.sub===2&&item.type===0&&((item.raw[3]<<8)|item.raw[4])===3002)).toBe(true);

  await page.locator('#ep133-backup-close').click();
  await page.locator('#ep133-project-recovery').click();
  await expect(page.locator('#ep133-backup-dialog')).toBeVisible();
  await expect(page.locator('[data-recovery-panel]')).toBeVisible();
  await expect(page.locator('[data-backup-panel]')).toBeHidden();
  await expect(page.locator('.ep-recovery-row')).toHaveCount(1,{timeout:10000});
  await expect(page.locator('#ep133-recovery-detail')).toContainText('VERIFIED');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('WRITE');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('VERIFY');

  await page.locator('#ep133-recovery-download').click();
  await expect.poll(()=>page.evaluate(()=>window.__savedBackupFiles.length)).toBe(4);
  const recoveryFile=await page.evaluate(()=>window.__savedBackupFiles[3]);
  expect(recoveryFile.name).toBe('P02.tar');
  expect(recoveryFile.size).toBeGreaterThan(1024);

  await page.locator('#ep133-recovery-restore').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await page.locator('#ep133-confirm-ok').click();
  await expect(page.locator('#ep133-status')).toContainText('RECOVERY P02 VERIFIED',{timeout:15000});
  await expect(page.locator('.ep-recovery-row')).toHaveCount(2,{timeout:10000});
});


test('Verified Project Editor writes only hardware-verified fields to inactive P02 with checkpointed readback',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
  await expect(page.locator('#ep133-project-inspector')).toContainText('P01',{timeout:10000});
  await expect(page.locator('#ep133-project-edit')).toBeDisabled();
  await expect(page.locator('#ep133-project-edit')).toHaveAttribute('title',/ACTIVE PROJECT/);

  await page.locator('[data-project="02"]').click();
  await expect(page.locator('#ep133-project-inspector')).toContainText('P02',{timeout:10000});
  await expect(page.locator('#ep133-project-inspector')).toContainText('2/2 AVAILABLE');
  await expect(page.locator('#ep133-project-edit')).toBeEnabled();
  await expect(page.locator('#ep133-project-edit')).toHaveAttribute('title','HARDWARE-VERIFIED AUTHORING');

  await page.locator('#ep133-project-edit').click();
  await expect(page.locator('#ep133-project-editor-dialog')).toBeVisible();
  await expect(page.locator('[data-editor-project]')).toHaveText('P02');
  await expect(page.locator('[data-editor-evidence]')).toContainText('EP133 2.5.1');
  await expect(page.locator('[data-editor-evidence]')).toContainText('HARDWARE VERIFIED');
  await expect(page.locator('[data-editor-bpm]')).toHaveValue('123.5');
  await expect(page.locator('[data-editor-pad-select]')).toContainText('A01 · SLOT 007');

  await page.locator('[data-editor-bpm]').fill('132');
  await page.locator('[data-editor-fx-type]').selectOption('3');
  await page.locator('[data-editor-fx-p1]').fill('0.2');
  await page.locator('[data-editor-fx-p2]').fill('0.8');
  await page.locator('[data-pad-field="amplitude"]').fill('111');
  await page.locator('[data-pad-field="pitch"]').fill('-3');
  await page.locator('[data-pad-field="pan"]').fill('4');

  await expect(page.locator('#ep133-project-editor-summary')).toContainText('VERIFIED CHANGES');
  await expect(page.locator('#ep133-project-editor-summary')).toContainText('SETTINGS');
  await expect(page.locator('#ep133-project-editor-summary')).toContainText('FX');
  await expect(page.locator('#ep133-project-editor-summary')).toContainText('PAD');
  await expect(page.locator('#ep133-project-editor-save')).toBeEnabled();

  const beforeMutations=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-project-editor-save').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await page.locator('#ep133-confirm-ok').click();

  await expect(page.locator('#ep133-project-editor-dialog')).toBeHidden({timeout:15000});
  await expect(page.locator('#ep133-status')).toContainText('PROJECT P02 · VERIFIED EDIT SAVED',{timeout:15000});
  await expect(page.locator('[data-project="02"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-project-inspector')).toContainText('132');
  await expect(page.locator('#ep133-project-inspector')).toContainText('DISTORTION');

  const newMutations=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).filter(item=>
    item.command===5&&(item.sub===2||item.sub===6||item.sub===12||(item.sub===7&&item.type===1))
  ),beforeMutations);
  const puts=newMutations.filter(item=>item.sub===2&&item.type===0);
  expect(puts.length).toBe(1);
  expect((puts[0].raw[3]<<8)|puts[0].raw[4]).toBe(3002);
  expect(newMutations.some(item=>item.sub===2&&item.type===0&&(((item.raw[3]<<8)|item.raw[4])>=1)&&(((item.raw[3]<<8)|item.raw[4])<=999))).toBe(false);

  await page.locator('#ep133-project-edit').click();
  await expect(page.locator('[data-editor-bpm]')).toHaveValue('132');
  await expect(page.locator('[data-editor-fx-type]')).toHaveValue('3');
  await expect(page.locator('[data-pad-field="amplitude"]')).toHaveValue('111');
  await expect(page.locator('[data-pad-field="pitch"]')).toHaveValue('-3');
  await expect(page.locator('[data-pad-field="pan"]')).toHaveValue('4');
  await expect(page.locator('#ep133-project-editor-save')).toBeDisabled();
  await page.locator('#ep133-project-editor-cancel').click();

  await page.locator('#ep133-project-recovery').click();
  await expect(page.locator('.ep-recovery-row')).toHaveCount(1,{timeout:10000});
  await expect(page.locator('#ep133-recovery-detail')).toContainText('VERIFIED');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('WRITE');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('READBACK');
  await page.locator('#ep133-backup-close').click();
});


test('Project Sequencer edits native patterns/scenes on inactive P02 and saves through checkpointed project PUT',async({page})=>{
  await installFake(page);
  await openMyEp(page);

  await page.locator('#ep133-view-projects').click();
  await expect(page.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
  await expect(page.locator('#ep133-project-inspector')).toContainText('P01',{timeout:10000});
  await expect(page.locator('#ep133-project-sequencer')).toBeDisabled();
  await expect(page.locator('#ep133-project-sequencer')).toHaveAttribute('title',/ACTIVE PROJECT/);

  await page.locator('[data-project="02"]').click();
  await expect(page.locator('#ep133-project-inspector')).toContainText('P02',{timeout:10000});
  await expect(page.locator('#ep133-project-inspector')).toContainText('2/2 AVAILABLE');
  await expect(page.locator('#ep133-project-sequencer')).toBeEnabled();
  await expect(page.locator('#ep133-project-sequencer')).toHaveAttribute('title','HARDWARE-VERIFIED SEQUENCER');

  await page.locator('#ep133-project-sequencer').click();
  await expect(page.locator('#ep133-sequencer-dialog')).toBeVisible();
  await expect(page.locator('[data-seq-project]')).toHaveText('P02');
  await expect(page.locator('[data-seq-evidence]')).toContainText('EP133 2.5.1');
  await expect(page.locator('#ep133-seq-pattern')).toHaveValue('A01');
  await expect(page.locator('#ep133-seq-pattern-summary')).toContainText('RAW TICK MAX');
  await expect(page.locator('[data-step="0"][data-pad="1"]')).toHaveClass(/active/);

  await page.locator('[data-step="1"][data-pad="2"]').click();
  await expect(page.locator('[data-step="1"][data-pad="2"]')).toHaveClass(/active/);
  await expect(page.locator('#ep133-seq-save')).toBeEnabled();

  await page.locator('[data-seq-auto-tick]').fill('24');
  await page.locator('[data-seq-auto-param]').selectOption('5');
  await page.locator('[data-seq-auto-value]').fill('1234');
  await page.locator('[data-seq-add-auto]').click();
  await expect(page.locator('#ep133-seq-automation')).toContainText('1234');

  await page.locator('#ep133-seq-new-pattern').fill('A02');
  await page.locator('#ep133-seq-new-pattern-bars').fill('2');
  await page.locator('#ep133-seq-create-pattern').click();
  await expect(page.locator('#ep133-seq-pattern')).toHaveValue('A02');
  await expect(page.locator('#ep133-seq-bars')).toHaveValue('2');
  await page.locator('[data-step="0"][data-pad="3"]').click();
  await expect(page.locator('[data-step="0"][data-pad="3"]')).toHaveClass(/active/);

  await page.locator('#ep133-seq-scene-index').fill('2');
  await page.locator('#ep133-seq-scene-index').press('Tab');
  await page.locator('#ep133-seq-scene-a').fill('2');
  await page.locator('#ep133-seq-scene-b').fill('1');
  await page.locator('#ep133-seq-scene-c').fill('1');
  await page.locator('#ep133-seq-scene-d').fill('1');
  await page.locator('#ep133-seq-apply-scene').click();
  await page.locator('#ep133-seq-current-scene').fill('2');
  await page.locator('#ep133-seq-song').fill('1,2');
  await page.locator('#ep133-seq-apply-song').click();

  const beforeMutations=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-seq-save').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await page.locator('#ep133-confirm-ok').click();

  await expect(page.locator('#ep133-sequencer-dialog')).toBeHidden({timeout:15000});
  await expect(page.locator('#ep133-status')).toContainText('PROJECT P02 · SEQUENCER VERIFIED',{timeout:15000});
  await expect(page.locator('[data-project="02"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-project-inspector')).toContainText('A02');

  const newMutations=await page.evaluate(start=>window.__fakeEp.requestLog.slice(start).filter(item=>
    item.command===5&&(item.sub===2||item.sub===6||item.sub===12||(item.sub===7&&item.type===1))
  ),beforeMutations);
  const puts=newMutations.filter(item=>item.sub===2&&item.type===0);
  expect(puts.length).toBe(1);
  expect((puts[0].raw[3]<<8)|puts[0].raw[4]).toBe(3002);
  expect(newMutations.some(item=>item.sub===2&&item.type===0&&(((item.raw[3]<<8)|item.raw[4])>=1)&&(((item.raw[3]<<8)|item.raw[4])<=999))).toBe(false);

  await page.locator('#ep133-project-sequencer').click();
  await expect(page.locator('#ep133-seq-pattern')).toContainText('A02');
  await page.locator('#ep133-seq-pattern').selectOption('A01');
  await expect(page.locator('[data-step="1"][data-pad="2"]')).toHaveClass(/active/);
  await expect(page.locator('#ep133-seq-automation')).toContainText('1234');
  await page.locator('#ep133-seq-pattern').selectOption('A02');
  await expect(page.locator('[data-step="0"][data-pad="3"]')).toHaveClass(/active/);
  await expect(page.locator('#ep133-seq-save')).toBeDisabled();
  await page.locator('#ep133-seq-cancel').click();

  await page.locator('#ep133-project-recovery').click();
  await expect(page.locator('.ep-recovery-row')).toHaveCount(1,{timeout:10000});
  await expect(page.locator('#ep133-recovery-detail')).toContainText('VERIFIED');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('WRITE');
  await expect(page.locator('#ep133-recovery-detail')).toContainText('READBACK');
  await page.locator('#ep133-backup-close').click();
});
