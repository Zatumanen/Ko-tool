import{test,expect}from '@playwright/test';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const fakeEpScript=path.join(here,'fake-ep-browser.js');

const openMyEp=async page=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect.poll(()=>page.evaluate(()=>{
    const status=document.querySelector('#ep133-status')?.textContent||'';
    const overlay=document.querySelector('#ep133-connection-overlay')?.textContent||'';
    return status.startsWith('SYNCED ·')&&!status.includes('LOADING')&&overlay===''?'SYNCED':status+'|'+overlay;
  }),{timeout:7000}).toBe('SYNCED');
  await expect(page.locator('.ep133-sample-row.occupied')).toHaveCount(2);
};

const mutationRequests=entries=>entries.filter(entry=>
  entry.sub===2||entry.sub===6||entry.sub===12||(entry.sub===7&&entry.type===1)
);

test('My EP opens the same waveform/chop editor read-only and downloads a local candidate',async({page})=>{
  await openMyEp(page);
  await page.locator('[data-slot="7"]').click();
  const button=page.locator('#ep133-sample-waveform');
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  const start=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await button.click();
  await expect(page.locator('#waveform-editor')).toBeVisible();
  await expect(page.locator('.waveform-editor-title')).toContainText('MY EP · WAVEFORM / CHOP');
  await expect(page.locator('.waveform-editor-file')).toContainText('SLOT 007');

  await page.locator('[data-chop-mode="even"]').click();
  await page.locator('[data-chop-target]').fill('4');
  await page.locator('[data-chop-target]').press('Enter');
  await expect(page.locator('[data-chop-status]')).toHaveText('4 SLICES');

  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-waveform-apply]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('kick808-edited.wav');
  await expect(page.locator('#waveform-editor')).toHaveCount(0);

  const mutations=await page.evaluate(startIndex=>{
    const entries=window.__fakeEp.requestLog.slice(startIndex);
    return entries.filter(entry=>entry.sub===2||entry.sub===6||entry.sub===12||(entry.sub===7&&entry.type===1));
  },start);
  expect(mutationRequests(mutations)).toEqual([]);
});
