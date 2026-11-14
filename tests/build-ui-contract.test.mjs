import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');

test('Pages manual deployment publishes exactly the dist already verified on the same SHA',async()=>{
  const [workflow,pkg,index]=await Promise.all([
    read('.github/workflows/deploy-pages.yml'),read('package.json'),read('index.html')
  ]);
  const [verify,deploy]=workflow.split(/\n  deploy:\n/);
  assert.ok(verify&&deploy,'separate verification and deployment jobs required');
  assert.match(workflow,/on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflow,/on:\s*\n\s*push:/);
  assert.match(verify,/run: npm ci --no-audit --no-fund/);
  assert.match(verify,/run: npm test/);
  assert.match(verify,/run: npm run build:pages/);
  assert.match(verify,/run: npm run verify:pages/);
  assert.match(verify,/run: npm run test:e2e/);
  assert.match(verify,/run: npm run test:pages:e2e/);
  assert.match(verify,/uses: actions\/upload-artifact@v4/);
  assert.match(verify,/name: verified-pages-dist/);
  assert.match(verify,/path: dist/);

  assert.match(deploy,/needs: verify/);
  assert.match(deploy,/if: github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy,/uses: actions\/download-artifact@v4/);
  assert.match(deploy,/name: verified-pages-dist/);
  assert.match(deploy,/run: npm run verify:pages/);
  assert.match(deploy,/uses: actions\/upload-pages-artifact@v3/);
  assert.match(deploy,/uses: actions\/deploy-pages@v4/);
  assert.match(deploy,/path: dist/);
  assert.doesNotMatch(deploy,/run: npm run build:pages/);
  assert.doesNotMatch(deploy,/path: \./);
  assert.equal(JSON.parse(pkg).scripts['build:pages'],'node scripts/build-pages.mjs');
  assert.equal(JSON.parse(pkg).scripts['verify:pages'],'node scripts/check-pages-dist.mjs');
  const base=index.indexOf('css/base.css');
  const core=index.indexOf('css/my-ep.css');
  const projects=index.indexOf('css/my-ep-projects.css');
  assert.ok(base>=0&&core>base&&projects>core);
});

test('PR CI tests versioned Pages artifact and uses frozen Playwright dependencies',async()=>{
  const [workflow,pkg,lock]=await Promise.all([
    read('.github/workflows/tests.yml'),read('package.json'),read('package-lock.json')
  ]);
  const packageJson=JSON.parse(pkg),locked=JSON.parse(lock);
  assert.equal(packageJson.devDependencies['@playwright/test'],'1.65.0');
  assert.equal(locked.packages['node_modules/@playwright/test'].version,'1.65.0');
  assert.match(workflow,/run: npm ci --no-audit --no-fund/);
  assert.match(workflow,/run: npm run build:pages/);
  assert.match(workflow,/run: npm run verify:pages/);
  assert.match(workflow,/run: npm run test:e2e/);
  assert.match(workflow,/run: npm run test:pages:e2e/);
  assert.match(workflow,/runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(workflow,/run: npm install/);
});

test('My EP core and project CSS are physically separated',async()=>{
  const [core,projects]=await Promise.all([read('css/my-ep.css'),read('css/my-ep-projects.css')]);
  assert.doesNotMatch(core,/My EP Projects read-only view/);
  assert.doesNotMatch(core,/\.ep-project-editor-dialog/);
  assert.doesNotMatch(core,/\.ep-sequencer-dialog/);
  assert.match(projects,/My EP Projects read-only view/);
  assert.match(projects,/\.ep-project-editor-dialog/);
  assert.match(projects,/\.ep-sequencer-dialog/);
});

test('My EP composition root delegates DOM registry and window shell behavior',async()=>{
  const source=await read('js/ep133/ui.js');
  assert.match(source,/from '\.\/ui\/domRegistry\.js'/);
  assert.match(source,/from '\.\/ui\/windowShell\.js'/);
  assert.match(source,/const dom=getEpBrowserDom\(document\)/);
  assert.match(source,/makeDraggableWindow\(panel\.querySelector\('\.ep133-browser-window'\)/);
  assert.doesNotMatch(source,/const makeDraggable=/);
  assert.doesNotMatch(source,/const isMobileDevice=/);
  assert.doesNotMatch(source,/const open=document\.getElementById\('my-ep-icon'\)/);
});
