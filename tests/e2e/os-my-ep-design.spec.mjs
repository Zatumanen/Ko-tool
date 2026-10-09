import {test,expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fakeEpScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-ep-browser.js');

const cssToken=(frame,name)=>frame.locator('html').evaluate((el,prop)=>
  getComputedStyle(el).getPropertyValue(prop).trim(),name);

test('Studio and Classic skin real My EP components without changing connection or remounting device',async({page,context})=>{
 await page.addInitScript({path:fakeEpScript});
 await page.goto('/os/index.html#os-device');
 console.log('THEME E2E A: opened OS');
 const embedded=page.frameLocator('#os-embedded-my-ep');
 await expect(embedded.locator('#os-embedded-launch-button')).toBeVisible();
 await expect.poll(()=>cssToken(embedded,'--su-surface')).toBe('#222c32');
 await expect(embedded.locator('html')).toHaveAttribute('data-os-theme','studio');
 await embedded.locator('#os-embedded-launch-button').click({timeout:8000});
 console.log('THEME E2E B: activated My EP');
 await expect(embedded.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
 await expect(page.locator('#os-runtime-label')).toContainText('READY',{timeout:18000});
 await expect(embedded.locator('[data-slot="7"]')).toHaveClass(/occupied/);
 await expect(embedded.locator('#ep133-device-head')).toHaveCSS('border-top-style','solid');
 await page.locator('#os-theme').click({timeout:8000});
 console.log('THEME E2E C: clicked theme');
 await expect(page.locator('body')).toHaveAttribute('data-os-theme','classic');
 await expect(embedded.locator('html')).toHaveAttribute('data-os-theme','classic');
 await expect.poll(()=>cssToken(embedded,'--su-surface')).toBe('#e6e8e2');
 await expect(embedded.locator('#ep133-device-head')).toHaveCSS('background-color','rgb(230, 232, 226)');
 await embedded.locator('#ep133-view-projects').click({timeout:8000});
 console.log('THEME E2E D: opened projects');
 await expect(embedded.locator('.ep-project-row')).toHaveCount(2,{timeout:10000});
 await expect(embedded.locator('.ep-project-inspector')).toBeVisible();
 const rects=await embedded.locator('#ep133-project-backup').evaluate(button=>{
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  return {viewport:{w:innerWidth,h:innerHeight},button:box(button),toolbar:box(button.closest('.ep-project-toolbar')),
   actions:box(button.parentElement),browser:box(document.querySelector('.ep-project-browser')),
   frameBody:box(document.body),visible:getComputedStyle(button).visibility,
   toolbarFlow:getComputedStyle(button.closest('.ep-project-toolbar')).flexDirection};
 });
 console.log('THEME GEOMETRY',JSON.stringify(rects));
 await embedded.locator('#ep133-project-backup').click({timeout:8000});
 console.log('THEME E2E E: clicked backup');
 await expect(embedded.locator('#ep133-backup-dialog')).toBeVisible();
 await expect(embedded.locator('#ep133-backup-dialog .ep-backup-window')).toHaveCSS('background-color','rgb(212, 215, 208)');
 await embedded.locator('#ep133-backup-close').click({timeout:8000});
 console.log('THEME E2E F: closed backup');
 await expect(embedded.locator('#ep133-backup-dialog')).toBeHidden();
 await page.locator('#os-theme').click();
 await expect(embedded.locator('html')).toHaveAttribute('data-os-theme','studio');
 await expect.poll(()=>cssToken(embedded,'--su-surface')).toBe('#222c32');
 expect(await embedded.locator('body').evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(1);
 expect(context.pages().length).toBe(1);
});

test('legacy Win95 interface is unaffected by the scoped OS device skin',async({page})=>{
 await page.goto('/');
 await expect(page.locator('html')).not.toHaveClass(/os-embedded/);
 await expect(page.locator('#main-window')).toBeVisible();
 await expect(page.locator('#my-ep-icon')).toBeVisible();
 const value=await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--su-surface').trim());
 expect(value).toBe('');
 await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
});
