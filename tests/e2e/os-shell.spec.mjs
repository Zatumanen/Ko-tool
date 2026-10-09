import {test,expect} from '@playwright/test';

test('legacy entry point remains available and has a reversible OS Preview launcher',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#main-window')).toBeVisible();
  await expect(page.locator('#my-ep-icon')).toBeVisible();
  await page.locator('#os-preview-icon').click();
  await expect(page).toHaveURL(/\/os\/index\.html$/);
  await expect(page.getByRole('heading',{name:'Samples',exact:true})).toBeVisible();
  await expect(page.getByText('NO DEVICE SESSION')).toBeVisible();
  await page.locator('#os-legacy').click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('#main-window')).toBeVisible();
});

test('OS workspaces, theme and honesty guards behave on desktop',async({page})=>{
  await page.goto('/os/index.html');
  await expect(page.locator('body')).toHaveAttribute('data-os-theme','studio');
  await expect(page.getByText('DEMO SIGNAL / NOT DEVICE AUDIO')).toBeVisible();
  await page.locator('[data-view=sequencer]').click();
  await expect(page.getByRole('heading',{name:'Sequencer',exact:true})).toBeVisible();
  await expect(page.getByText('See the whole groove.')).toBeVisible();
  await page.locator('[data-view=device]').click();
  await expect(page.getByText('Real hardware. No guesses.')).toBeVisible();
  await expect(page.getByText('This shell does not connect or request USB-MIDI access.')).toBeVisible();
  await page.locator('#os-theme').click();
  await expect(page.locator('body')).toHaveAttribute('data-os-theme','classic');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-os-theme','classic');
  await expect(page.getByRole('heading',{name:'Device',exact:true})).toBeVisible();
  await page.locator('[data-view=community]').click();
  await expect(page.getByText('Share sounds, not restrictions.')).toBeVisible();
});

test('OS preview keeps direct access to the current converter and My EP',async({page})=>{
  await page.goto('/os/index.html#os-samples');
  await expect(page.getByRole('heading',{name:'Sample laboratory'})).toBeVisible();
  await page.locator('#os-legacy').click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('#audio-upload')).toBeAttached();

  await page.goto('/os/index.html');
  const [deviceTab]=await Promise.all([page.context().waitForEvent('page'),page.locator('#launch-my-ep').click()]);
  await deviceTab.waitForLoadState();
  await expect(deviceTab).toHaveURL(/\/index\.html#my-ep$/);
  await expect(deviceTab.locator('#my-ep-icon')).toBeAttached();
  await expect(page).toHaveURL(/\/os\/index\.html$/);
  await deviceTab.close();
});

test('OS layout avoids horizontal document overflow on small screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/os/index.html');
  await expect(page.locator('#os-navigation')).toBeVisible();
  const sizes=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:document.documentElement.clientWidth
  }));
  expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth+2);
  await page.locator('[data-view=settings]').click();
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
});
