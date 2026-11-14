import{test,expect}from '@playwright/test';

test('versioned dist works under the production /Ko-tool/ base path',async({page})=>{
  const errors=[],badResources=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.origin==='http://127.0.0.1:4174'&&response.status()>=400&&/\.(?:html|js|css|wasm|json)$/.test(url.pathname))
      badResources.push(url.pathname+': '+response.status());
  });
  const response=await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#desktop-apps')).toBeVisible();
  await expect(page.locator('#app-icon')).toBeVisible();
  await expect(page.locator('#my-ep-icon')).toBeVisible();
  await expect(page.locator('#visuals-icon')).toBeVisible();

  const build=await page.request.get('./build-version.json');
  expect(build.status()).toBe(200);
  const {version}=await build.json();
  expect(version).toMatch(/^[a-zA-Z0-9._-]+$/);
  await page.locator('#app-icon').click();
  await expect(page.locator('#main-window')).toBeVisible();
  await page.locator('#visuals-icon').click();
  await expect(page.locator('#visuals-root')).toBeVisible();

  const resources=await page.evaluate(()=>performance.getEntriesByType('resource')
    .map(entry=>entry.name).filter(url=>{
      const parsed=new URL(url);
      return parsed.origin===location.origin&&/\.(js|css)(?:\?|$)/.test(parsed.pathname);
    }));
  expect(resources.length).toBeGreaterThanOrEqual(5);
  for(const url of resources)
    expect(new URL(url).searchParams.get('v'),url).toBe(version);
  expect(badResources).toEqual([]);
  expect(errors).toEqual([]);
});
