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
  await page.locator('#os-nav-extras summary').click();
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
  await page.locator('#os-nav-extras summary').click();
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
  await page.locator('#launch-my-ep').click();
  await expect(page).toHaveURL(/\/os\/index\.html#os-device$/);
  await expect(page.locator('#os-device-dock')).toBeVisible();
  const frame=page.frameLocator('#os-embedded-my-ep');
  await expect(frame.locator('#os-embedded-launch-button')).toBeVisible();
  await expect(frame.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#os-runtime-label')).toHaveText('NO DEVICE SESSION');
  await page.locator('#os-device-hide').click();
  await expect(page.locator('#os-device-dock')).toBeHidden();
  await expect(page.locator('#os-runtime-label')).toHaveText('NO DEVICE SESSION');
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

test('U1 navigation exposes primary workspaces, preserves secondary deep links and legacy Chop access',async({page})=>{
 await page.goto('/os/index.html#os-samples');
 const extras=page.locator('#os-nav-extras');
 await expect(extras).not.toHaveAttribute('open');
 await expect(page.locator('[data-view=samples]')).toBeVisible();
 await expect(page.locator('[data-view=projects]')).toBeVisible();
 await expect(page.locator('[data-view=device]')).toBeVisible();
 await expect(page.locator('[data-view=settings]')).toBeVisible();
 await expect(page.locator('[data-view=sequencer]')).toBeHidden();
 await expect(page.locator('#os-open-original-waveform')).toHaveAttribute('href','../index.html');
 await page.goto('/os/index.html#os-community');
 await expect(extras).toHaveAttribute('open');
 await expect(page.locator('[data-view=community]')).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('heading',{name:'Community',exact:true})).toBeVisible();
 await page.locator('[data-view=samples]').click();
 await expect(extras).not.toHaveAttribute('open');
 await page.locator('#os-nav-extras summary').focus();
 await page.keyboard.press('Enter');
 await expect(extras).toHaveAttribute('open');
 await page.locator('[data-view=visualizers]').click();
 await expect(page.locator('#meter-source')).toContainText('DEMO SIGNAL');
 await page.locator('#os-runtime-trigger').click();
 await expect(page).toHaveURL(/#os-device$/);
 await expect(extras).not.toHaveAttribute('open');
});

test('U1 secondary nav remains usable without horizontal document overflow on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/os/index.html#os-sequencer');
 const extras=page.locator('#os-nav-extras');
 await expect(extras).toHaveAttribute('open');
 await expect(page.locator('[data-view=sequencer]')).toHaveAttribute('aria-current','page');
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(await overflow()).toBeLessThanOrEqual(2);
 await page.locator('[data-view=projects]').click();
 await expect(extras).not.toHaveAttribute('open');
 expect(await overflow()).toBeLessThanOrEqual(2);
 await page.locator('[data-view=samples]').click();
 await expect(page.locator('#os-open-original-waveform')).toBeVisible();
 expect(await overflow()).toBeLessThanOrEqual(2);
});

test('U1 Settings diagnostics opens read-only Device status, not an unrelated legacy page',async({page})=>{
 await page.goto('/os/index.html#os-settings');
 await page.getByRole('button',{name:'OPEN DEVICE DIAGNOSTICS'}).click();
 await expect(page).toHaveURL(/#os-device$/);
 await expect(page.locator('#os-runtime-diagnostics')).toBeVisible();
 await expect(page.locator('#os-diag-heading')).toHaveText('Device status unavailable');
 const frame=page.frameLocator('#os-embedded-my-ep');
 await expect(frame.locator('#os-embedded-launch-button')).toBeVisible();
 await expect(frame.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
});
