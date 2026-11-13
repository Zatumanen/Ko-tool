import{test,expect}from '@playwright/test';

async function expectWindowTitleInViewport(page){
  const title=await page.locator('#main-window .title-bar').boundingBox();
  expect(title).not.toBeNull();
  const viewport=page.viewportSize();
  expect(title.x).toBeGreaterThanOrEqual(-1);
  expect(title.y).toBeGreaterThanOrEqual(-1);
  expect(title.x+title.width).toBeLessThanOrEqual(viewport.width+1);
  expect(title.y).toBeLessThan(viewport.height);
}

test('SpeedUpperCut stays reachable when docking and undocking DevTools',async({page})=>{
  await page.setViewportSize({width:1180,height:940});
  await page.goto('/');
  const win=page.locator('#main-window');
  await expect(win).toBeVisible();
  await expectWindowTitleInViewport(page);

  // Docked DevTools resize the page without a reload or a user drag.
  await page.setViewportSize({width:720,height:760});
  await expectWindowTitleInViewport(page);
  expect(await win.evaluate(element=>getComputedStyle(element).transform)).toBe('none');

  await page.setViewportSize({width:1180,height:940});
  await expectWindowTitleInViewport(page);
  await page.setViewportSize({width:440,height:690});
  await expectWindowTitleInViewport(page);
});

test('dragged SpeedUpperCut remains reachable across viewport changes',async({page})=>{
  await page.setViewportSize({width:1180,height:940});
  await page.goto('/');
  const bar=page.locator('#main-window .title-bar');
  const title=await bar.boundingBox();
  expect(title).not.toBeNull();

  await page.mouse.move(title.x+60,title.y+12);
  await page.mouse.down();
  await page.mouse.move(title.x+220,title.y+60,{steps:5});
  await page.mouse.up();
  await expectWindowTitleInViewport(page);

  await page.setViewportSize({width:620,height:760});
  await expectWindowTitleInViewport(page);
  await page.setViewportSize({width:1180,height:940});
  await expectWindowTitleInViewport(page);
});
