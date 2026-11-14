import{defineConfig}from '@playwright/test';

export default defineConfig({
  testDir:'./tests/pages-dist',
  testMatch:'*.spec.mjs',
  timeout:45000,
  expect:{timeout:7000},
  fullyParallel:false,
  workers:1,
  use:{
    baseURL:'http://127.0.0.1:4174/Ko-tool/',
    browserName:'chromium',
    headless:true,
    trace:'retain-on-failure'
  },
  webServer:{
    command:'node scripts/serve-pages.mjs',
    url:'http://127.0.0.1:4174/Ko-tool/',
    reuseExistingServer:false,
    timeout:10000
  },
  reporter:[['line']]
});
