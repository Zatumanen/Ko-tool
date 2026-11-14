import {test,expect} from '@playwright/test';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');
const open=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
};
const fileWrites=rows=>rows.filter(row=>row.command===5&&[2,3,6].includes(row.sub));

test('My EP diagnostic export is opt-in: cancelling downloads nothing and sends no FILE writes',async({page})=>{
  await open(page);
  let downloads=0;
  page.on('download',()=>downloads++);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-export-diagnostics').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  await expect(page.locator('#ep133-confirm-message')).toContainText('Nothing is uploaded');
  await page.locator('#ep133-confirm-cancel').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  const requests=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),before);
  expect(fileWrites(requests)).toEqual([]);
  expect(downloads).toBe(0);
});

test('My EP exports a local allowlisted JSON without upload, raw logs or extra FILE traffic',async({page})=>{
  await open(page);
  // Failure text from a malicious local file must not leak through the report.
  const filename='private_EPEXY1C6_secret-key_do-not-export.wav';
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.evaluate(name=>{
    const target=document.querySelector('[data-slot="56"]');
    if(!target)throw new Error('Expected an empty sample slot');
    const dt=new DataTransfer();
    dt.items.add(new File([new Uint8Array([0,1,2,3])],name,{type:'audio/wav'}));
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },filename);
  await expect(page.locator('#log-tab')).toContainText('COULD NOT UPLOAD SAMPLE');
  // The user closes the blocking error modal before using another My EP control.
  await expect(page.locator('#error-dialog')).toBeVisible();
  await page.locator('#error-ok').click();
  await expect(page.locator('#error-dialog')).toBeHidden();
  const requests=[];
  page.on('request',req=>{if(req.method()!=='GET')requests.push(req.method()+' '+req.url());});
  await page.locator('#ep133-export-diagnostics').click();
  await expect(page.locator('#ep133-confirm-dialog')).toBeVisible();
  const downloadPending=page.waitForEvent('download');
  await page.locator('#ep133-confirm-ok').click();
  const download=await downloadPending;
  expect(download.suggestedFilename()).toBe('ko-tool-myep-diagnostics.json');
  const content=await readFile(await download.path(),'utf8');
  const parsed=JSON.parse(content);
  expect(parsed.schema).toBe('ko-tool-myep-diagnostics');
  expect(parsed.version).toBe(1);
  expect(Array.isArray(parsed.entries)).toBe(true);
  expect(parsed.entries.some(entry=>entry.type==='runtime')).toBe(true);
  expect(parsed.entries.some(entry=>entry.type==='error'&&entry.stage==='upload')).toBe(true);
  expect(content).not.toContain(filename);
  expect(content).not.toContain('EPEXY1C6');
  expect(content).not.toContain('secret-key');
  expect(content).not.toContain('stack');
  expect(content).not.toContain('deviceKey');
  expect(content).not.toContain('rawData');
  const writes=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),before);
  expect(fileWrites(writes)).toEqual([]);
  expect(requests).toEqual([]);
});

test('idle fake EP disconnect does not prevent local export or retry FILE mutations',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.evaluate(()=>window.__fakeEp.disconnect());
  await expect(page.locator('#ep133-connection-overlay')).toContainText('DISCONNECTED');
  await page.locator('#ep133-export-diagnostics').click();
  const pending=page.waitForEvent('download');
  await page.locator('#ep133-confirm-ok').click();
  const download=await pending;
  const content=JSON.parse(await readFile(await download.path(),'utf8'));
  expect(content.entries.some(x=>x.type==='runtime'&&x.connection==='disconnected')).toBe(true);
  const later=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index),before);
  expect(fileWrites(later)).toEqual([]);
});

test('denied MIDI permission is recorded only as an allowlisted connection failure',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'requestMIDIAccess',{
      configurable:true,
      value:async()=>{const error=new Error('Permission denied for secret-device EPEXY1C6');error.name='NotAllowedError';throw error;}
    });
  });
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#error-message')).toContainText('MIDI/SysEx access was denied');
  await expect(page.locator('#error-dialog')).toBeVisible();
  await page.locator('#error-ok').click();
  await expect(page.locator('#error-dialog')).toBeHidden();
  await page.locator('#ep133-export-diagnostics').click();
  const pending=page.waitForEvent('download');
  await page.locator('#ep133-confirm-ok').click();
  const download=await pending;
  const json=await readFile(await download.path(),'utf8');
  const report=JSON.parse(json);
  expect(report.entries.some(entry=>entry.type==='error'&&entry.stage==='connect'&&entry.code==='EP_UNKNOWN')).toBe(true);
  expect(json).not.toContain('secret-device');
  expect(json).not.toContain('EPEXY1C6');
  const writes=await page.evaluate(()=>window.__fakeEp.requestLog);
  expect(fileWrites(writes)).toEqual([]);
});
