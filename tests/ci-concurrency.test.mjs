import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/tests.yml',import.meta.url),'utf8');

test('CI cancels only superseded runs of the same pull request',()=>{
  assert.ok(workflow.includes('group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}'));
  assert.ok(workflow.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
  assert.ok(!workflow.includes('cancel-in-progress: true'),'main push checks must not be cancelled');
});

test('main and PR still run all four required checks',()=>{
  assert.match(workflow,/  push:\n    branches:\n      - main\n/);
  assert.match(workflow,/  pull_request:\n    branches:\n      - main\n/);
  for(const job of ['codex-preflight','unit','build-pages','browser-e2e']){
    assert.ok(workflow.includes('\n  '+job+':\n'),'missing required check: '+job);
  }
  assert.ok(workflow.includes('npm run test:e2e'));
  assert.ok(workflow.includes('npm run test:pages:e2e'));
});
