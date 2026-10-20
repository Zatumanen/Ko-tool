import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('Pages never deploys automatically after a push', async () => {
  const workflow = await read('.github/workflows/deploy-pages.yml');
  const triggers = workflow.split(/^permissions:/m, 1)[0];
  assert.match(triggers, /\bon:\s*\n\s+workflow_dispatch:/);
  assert.doesNotMatch(triggers, /^\s+push:/m);
  assert.doesNotMatch(triggers, /^\s+pull_request:/m);
});

test('manual release requires passing Node/build/browser verification', async () => {
  const workflow = await read('.github/workflows/deploy-pages.yml');
  assert.match(workflow, /^  verify:\s*$/m);
  assert.match(workflow, /^  deploy:\s*\n    needs: verify\s*\n    if: github\.ref == 'refs\/heads\/main'/m);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run build:pages/);
  assert.match(workflow, /run: npm run test:e2e/);
  assert.match(workflow, /name: github-pages/);
});
