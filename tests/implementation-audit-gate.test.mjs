import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateMatrix,validatePrBody,runAudit,PR_SECTIONS} from '../scripts/check-implementation-audit.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const matrix=readFileSync(path.join(repo,'docs/IMPLEMENTATION_MATRIX.md'),'utf8');
const hasFile=name=>existsSync(path.join(repo,name));
const body=[
  '## Baseline and sources',
  'Reviewed main@23a814154047b732a6fb7884be9d9e95cdb065af; Linear issue ZAT-70 and owner roadmap decisions.',
  '## Existing implementation',
  'Reviewed AGENTS.md, docs/PROJECT_STATE.md and tests/implementation-audit-gate.test.mjs for existing checks.',
  '## Verified gap',
  'The existing GitHub workflow does not insist on an evidence matrix or source-backed PR audit in descriptions.',
  '## Decision and scope',
  'RECONCILE. Add only documentation, templates and an audit validator; do not change the EP runtime or audio bytes.',
  '## Tests and evidence',
  'Node structural regression tests executed; full CI runs on the PR head. No physical device tests were performed.',
  '## Hardware and release',
  'HIL not applicable to these docs. No firmware commands, hardware writes or Pages deploy authorized.'
].join('\n\n');

test('checked-in implementation matrix has required scopes, statuses and existing evidence paths',()=>{
  assert.deepEqual(validateMatrix(matrix,{hasFile}),[]);
  assert.deepEqual(runAudit({eventPath:null}),[]);
});

test('missing critical implementation scope is detected before a PR can pass',()=>{
  const changed=matrix.replace('| MEP-REPITCH |','| MEP-OTHER |');
  assert.match(validateMatrix(changed,{hasFile}).join('\n'),/Missing critical scope: MEP-REPITCH/);
});

test('a duplicated row and invented source path cannot masquerade as implementation proof',()=>{
  const row=matrix.split('\n').find(line=>line.startsWith('| MEP-REPITCH |'));
  const duplicated=matrix.replace('<!-- MATRIX_ROWS_END -->',row+'\n<!-- MATRIX_ROWS_END -->');
  assert.match(validateMatrix(duplicated,{hasFile}).join('\n'),/Duplicate matrix ID/);
  const invented=matrix.replace('js/ep133/myEpRepitch.js','js/ep133/fabricated-fix.js');
  assert.match(validateMatrix(invented,{hasFile}).join('\n'),/Missing\/unsafe evidence path/);
});

test('hardware PASS needs actual date and firmware evidence, not a green CI alone',()=>{
  const changed=matrix.replace(/(\| MEP-REPITCH \|[^\n]*?)\| HIL PENDING \|/,'$1| PASS |');
  assert.notEqual(changed,matrix);
  assert.match(validateMatrix(changed,{hasFile}).join('\n'),/Hardware PASS needs date, scope and exact firmware/);
});

test('complete source-backed PR preflight passes and all six mandatory headings are present',()=>{
  assert.equal(PR_SECTIONS.length,6);
  assert.deepEqual(validatePrBody(body),[]);
});

test('missing evidence sections, generic placeholders and missing baseline SHA fail',()=>{
  assert.match(validatePrBody('## Baseline and sources\n\nTBD').join('\n'),/Missing PR audit section/);
  assert.match(validatePrBody(body.replace('Reviewed main@23a814154047b732a6fb7884be9d9e95cdb065af','Reviewed recent main')).join('\n'),/PR baseline must give a main commit SHA/);
  assert.match(validatePrBody(body.replace('The existing GitHub workflow does not insist on an evidence matrix or source-backed PR audit in descriptions.','<!-- explain later -->')).join('\n'),/Missing substantive PR audit evidence in: Verified gap/);
  assert.match(validatePrBody(body.replace('RECONCILE. Add only documentation','Add only documentation')).join('\n'),/must choose SKIP, FIX, BUILD, HIL ONLY or RECONCILE/);
});

test('PR body without hardware or deployment scope cannot claim readiness',()=>{
  const changed=body.replace('HIL not applicable to these docs. No firmware commands, hardware writes or Pages deploy authorized.','Documentation work is complete; the change can be merged.');
  assert.match(validatePrBody(changed).join('\n'),/hardware acceptance and deployment/);
});

test('CI event body gate reads pull_request payload, but main push needs only static matrix',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'ko-tool-preflight-'));
  try{
    const event=path.join(dir,'event.json');
    writeFileSync(event,JSON.stringify({pull_request:{body}}));
    assert.deepEqual(runAudit({eventPath:event}),[]);
    writeFileSync(event,JSON.stringify({pull_request:{body:'## Baseline and sources\n\nTBD'}}));
    assert.match(runAudit({eventPath:event}).join('\n'),/Missing PR audit section/);
    writeFileSync(event,JSON.stringify({ref:'refs/heads/main'}));
    assert.deepEqual(runAudit({eventPath:event}),[]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
