import {test,expect} from '@playwright/test';

test('opening the app does not fetch the reference resampling runtime',async({page})=>{
  const fetched=[];
  page.on('request',request=>{
    if(new URL(request.url()).pathname.endsWith('/resampleModule.js'))fetched.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#main-window')).toBeVisible();
  expect(fetched).toEqual([]);
});
