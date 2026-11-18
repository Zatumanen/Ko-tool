import{test,expect}from '@playwright/test';
import{fileURLToPath}from 'node:url';
const fakeEpScript=fileURLToPath(new URL('./fake-ep-browser.js',import.meta.url));

test('standalone Sequencer observes My EP session without connection requests or FILE traffic',async({page})=>{
  await page.addInitScript({path:fakeEpScript});
  await page.goto('/');
  const icon=page.getByRole('button',{name:'Open Sequencer',exact:true});
  await icon.focus();await page.keyboard.press('Enter');
  const app=page.getByRole('dialog',{name:'Sequencer',exact:true});
  await expect(app).toBeVisible();
  for(const width of [710,375]){
    await page.setViewportSize({width,height:800});
    const rect=await app.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x+rect.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:1280,height:800});
  await expect(app.locator('[data-sequencer-status]')).toHaveText('EP DISCONNECTED');
  expect(await page.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);
  expect(await page.evaluate(()=>window.__fakeEp.requestLog.length)).toBe(0);
  await app.getByRole('button',{name:'Open My EP',exact:true}).click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED ·');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  await expect(app.locator('[data-sequencer-status]')).toHaveText('EP SESSION READY');
  await page.locator('#ep133-close').click();
  const before=await page.evaluate(()=>({requests:window.__fakeEp.requestLog.length,access:window.__fakeEp.midiAccessRequests.length}));
  await app.getByRole('button',{name:'Close Sequencer',exact:true}).click();
  await expect(app).toBeHidden();
  await icon.click();
  await expect(app.locator('[data-sequencer-status]')).toHaveText('EP SESSION READY');
  expect(await page.evaluate(()=>({requests:window.__fakeEp.requestLog.length,access:window.__fakeEp.midiAccessRequests.length}))).toEqual(before);
  await expect(app.getByRole('button',{name:'Live · HIL pending',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.__fakeEp.disconnect());
  await expect(app.locator('[data-sequencer-status]')).toHaveText('EP DISCONNECTED');
  await expect(app.locator('[data-sequencer-identity]')).toHaveText('');
  await app.focus();await page.keyboard.press('Escape');
  await expect(app).toBeHidden();await expect(icon).toBeFocused();
  expect(await page.evaluate(()=>window.__fakeEp.requestLog.filter(x=>x.command===5&&(x.sub===2||x.sub===6||x.sub===12||(x.sub===7&&x.type===1))))).toEqual([]);
});

test('Sequencer cannot acquire an EP session owned by another tab',async({context})=>{
  await context.addInitScript({path:fakeEpScript});
  const first=await context.newPage(),second=await context.newPage();
  await first.goto('/');await first.locator('#my-ep-icon').click();
  await expect(first.locator('#ep133-status')).toContainText('SYNCED ·');
  await second.goto('/');await second.locator('#sequencer-icon').click();
  const app=second.getByRole('dialog',{name:'Sequencer',exact:true});
  await app.getByRole('button',{name:'Open My EP',exact:true}).click();
  await expect(second.locator('#ep133-connection-overlay')).toHaveText('OPEN IN ANOTHER KO-TOOL TAB');
  await expect(app.locator('[data-sequencer-status]')).toHaveText('EP SESSION UNAVAILABLE');
  expect(await second.evaluate(()=>window.__fakeEp.midiAccessRequests.length)).toBe(0);
  expect(await second.evaluate(()=>window.__fakeEp.requestLog.length)).toBe(0);
});
