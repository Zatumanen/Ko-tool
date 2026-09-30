import{defineConfig}from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:'*.spec.mjs',
  timeout:45000,
  expect:{timeout:7000},
  fullyParallel:false,
  workers:1,
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    headless:true,
    trace:'retain-on-failure'
  },
  webServer:{
    command:'node tests/e2e/server.mjs',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:false,
    timeout:10000
  },
  reporter:[['line']]
});
