import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const openBackup=async(page,{projects=2,samples=null}={})=>{
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
  await openBackup(page);
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
  const errorDialog=page.locator('#error-dialog');
  if(await errorDialog.isVisible())await page.locator('#error-ok').click();
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
  const errorDialog=page.locator('#error-dialog');
  if(await errorDialog.isVisible())await page.locator('#error-ok').click();
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
