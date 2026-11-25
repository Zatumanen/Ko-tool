import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync,mkdirSync,mkdtempSync,writeFileSync,copyFileSync,rmSync}from 'node:fs';
import{execFileSync,spawnSync}from 'node:child_process';
import{tmpdir}from 'node:os';
import path from 'node:path';
import{
  deploymentStatus,renderReleaseEvidence,validateEvidenceChange,validateEvidenceDocs,validateReleaseEvidence
}from '../scripts/check-release-evidence.mjs';

const registry=()=>JSON.parse(readFileSync(new URL('../docs/release-evidence.json',import.meta.url),'utf8'));

test('the checked-in evidence record and documentation agree',()=>{
  const current=registry();
  assert.deepEqual(validateReleaseEvidence(current),[]);
  const docs=Object.fromEntries(['README.md','docs/PROJECT_STATE.md','docs/IMPLEMENTATION_MATRIX.md','docs/RELEASE.md']
    .map(name=>[name,readFileSync(new URL('../'+name,import.meta.url),'utf8')]));
  assert.deepEqual(validateEvidenceDocs(current,docs),[]);
});

test('historical Sequencer software claims fail when older than the source record',()=>{
  const current=registry();
  current.features.find(row=>row.id==='SEQ-STANDALONE').code='IMPLEMENTED';
  const generated=renderReleaseEvidence(current,'README.md');
  const historical=generated.replace(/(SEQ-STANDALONE[^\n]+)IMPLEMENTED/,'$1MISSING');
  assert.notEqual(historical,generated);
  assert.match(validateEvidenceDocs(current,{'README.md':historical}).join('\n'),/README\.md.*differs/);
});

test('a manual Pages run and a served version remain distinct from current main',()=>{
  const current=registry();
  current.checkpoint.SOURCE_SHA='a'.repeat(40);
  current.checkpoint.PUBLISHED_SHA='b'.repeat(40);
  current.checkpoint.LIVE_SHA=current.checkpoint.PUBLISHED_SHA;
  assert.equal(deploymentStatus(current.checkpoint),'MATCH');
  current.checkpoint.LIVE_SHA=current.checkpoint.SOURCE_SHA;
  assert.equal(deploymentStatus(current.checkpoint),'DRIFT');
  assert.match(renderReleaseEvidence(current,'docs/RELEASE.md'),/DRIFT/);
  current.checkpoint.LIVE_SHA=null;
  assert.equal(deploymentStatus(current.checkpoint),'UNKNOWN');
});

test('green CI or a Linear Done status cannot establish HIL PASS or a release GO',()=>{
  const current=registry();
  const feature=current.features.find(row=>row.id==='SEQ-LIVE');
  feature.hil='PASS';
  feature.hilEvidence={kind:'real-device',model:'test device',firmware:'synthetic',date:'2026-11-24',
    scope:'Synthetic CI evidence for a deliberately invalid claim.',
    sourceSha:current.checkpoint.TESTED_SHA,url:current.checkpoint.tests+'/job/123'};
  current.decision='GO';
  const result=validateReleaseEvidence(current).join('\n');
  assert.match(result,/SEQ-LIVE.*physical/);
  assert.match(result,/GO.*open/);
});

test('a deployment cannot cite the CI run as its own publication evidence',()=>{
  const current=registry();
  current.checkpoint.publish=current.checkpoint.tests;
  assert.match(validateReleaseEvidence(current).join('\n'),/distinct.*Pages/i);
});

test('HIL and owner approvals require scoped source and real calendar dates',()=>{
  const current=registry();
  const feature=current.features.find(row=>row.id==='EP136-SIDEKICK');
  feature.hil='PASS';feature.owner='PASS';
  const url='https://linear.app/clouded/issue/ZAT-51';
  feature.hilEvidence={kind:'real-device',scope:'Captured physical stereo routing, output and recovery.',
    model:true,firmware:{},date:'2026-02-31',sourceSha:'0'.repeat(40),url};
  feature.ownerEvidence={date:'2026-02-31',sourceSha:'0'.repeat(40),url};
  assert.match(validateReleaseEvidence(current).join('\n'),/EP136-SIDEKICK.*HIL PASS/);
  assert.match(validateReleaseEvidence(current).join('\n'),/EP136-SIDEKICK.*OWNER PASS/);
  feature.hil='NOT APPLICABLE';feature.owner='NOT APPLICABLE';
  assert.match(validateReleaseEvidence(current).join('\n'),/EP136-SIDEKICK.*hardware scope/);
});

test('GO requires source-scoped acceptance covering the candidate SHA',()=>{
  const current=registry(),rc=current.checkpoint.TESTED_SHA,old='0'.repeat(40);
  const url='https://linear.app/clouded/issue/ZAT-69';
  current.checkpoint.SOURCE_SHA=rc;current.checkpoint.MERGED_SHA=rc;
  current.decision='GO';current.rcSha=rc;
  for(const [key,gate] of Object.entries(current.releaseGates))
    current.releaseGates[key]={...gate,status:'PASS',sourceSha:rc,url};
  for(const row of current.features){
    Object.assign(row,{code:'IMPLEMENTED',automated:'PASS',testedSha:rc,sourceSha:old,owner:'PASS',
      ownerEvidence:{date:'2026-11-25',sourceSha:old,url}});
    if(!row.paths.some(name=>name.endsWith('.test.mjs')||name.endsWith('.spec.mjs')))row.paths.push('tests/e2e/visuals.spec.mjs');
    if(row.hil!=='NOT APPLICABLE'){
      row.hil='PASS';
      row.hilEvidence={kind:'real-device',model:'Fixture model',firmware:'1.0.0',date:'2026-11-25',
        scope:'Example approval record for the source SHA used in this test.',sourceSha:old,url};
    }
  }
  assert.match(validateReleaseEvidence(current).join('\n'),/GO.*open/);
  for(const row of current.features){
    row.sourceSha=rc;row.ownerEvidence.sourceSha=rc;
    if(row.hilEvidence)row.hilEvidence.sourceSha=rc;
  }
  assert.deepEqual(validateReleaseEvidence(current),[]);
});

test('fixture data cannot be the sole proof of an automated regression',()=>{
  const current=registry();
  const row=current.features.find(feature=>feature.id==='SEQ-LIVE');
  row.paths=row.paths.filter(name=>!name.startsWith('tests/'));
  row.paths.push('tests/fixtures/visuals-loudness-golden.json');
  assert.match(validateReleaseEvidence(current,{hasFile:()=>true}).join('\n'),/SEQ-LIVE.*automated PASS/);
});

test('protected changes require a fresh base and tracked regression evidence',()=>{
  const before=registry();
  const after=structuredClone(before);
  const changed=['js/sequencer/saved.js'];
  const baseSha='a'.repeat(40),options={baseSha};
  const feature=after.features.find(row=>row.id==='SEQ-STANDALONE');
  const error=/SEQ-STANDALONE.*update/;
  assert.match(validateEvidenceChange(before,after,changed,options).join('\n'),error);
  feature.verification='Reworded the previous successful Saved Step/Piano Roll tests.';
  assert.match(validateEvidenceChange(before,after,changed,options).join('\n'),error);
  feature.evidenceUpdate={baseSha:'b'.repeat(40),tests:['tests/e2e/sequencer.spec.mjs'],
    note:'Verify Saved Step/Piano Roll on the same session with the fake EP browser scenarios.'};
  assert.match(validateEvidenceChange(before,after,changed,options).join('\n'),error);
  feature.evidenceUpdate.baseSha=baseSha;
  assert.deepEqual(validateEvidenceChange(before,after,changed,options),[]);
});

test('first evidence enrollment excludes application changes',()=>{
  const current=registry();
  assert.deepEqual(validateEvidenceChange(null,current,['docs/release-evidence.json','scripts/check-release-evidence.mjs']),[]);
  assert.match(validateEvidenceChange(null,current,['js/sequencer/saved.js']).join('\n'),/initial.*production/i);
});

test('docs-only and HIL-only exemptions cannot cover changed production code',()=>{
  const current=registry();
  assert.match(validateEvidenceChange(current,current,['tests/fixtures/setup.mjs'],
    {exception:{kind:'HIL-only',reason:'Record a controlled physical observation in test fixtures.'}}).join('\n'),/exception.*executable/);
  for(const kind of ['docs-only','HIL-only']){
    const options={exception:{kind,reason:'Recorded evidence correction for the manual Pages run.'}};
    assert.deepEqual(validateEvidenceChange(current,current,['docs/RELEASE.md'],options),[]);
    assert.match(validateEvidenceChange(current,current,['js/sequencer/saved.js'],options).join('\n'),/exception.*production/);
  }
});


test('CI reads the PR base and fails when a watched source changes without evidence',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'ko-release-evidence-test-'));
  const current=registry();
  const write=(name,value)=>{
    const target=path.join(directory,name);
    mkdirSync(path.dirname(target),{recursive:true});
    writeFileSync(target,value);
  };
  const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  try{
    for(const name of new Set(current.features.flatMap(feature=>feature.paths)))write(name,'fixture');
    for(const name of ['README.md','docs/PROJECT_STATE.md','docs/IMPLEMENTATION_MATRIX.md','docs/RELEASE.md'])
      write(name,renderReleaseEvidence(current,name));
    write('docs/release-evidence.json',JSON.stringify(current));
    write('scripts/check-release-evidence.mjs','');
    copyFileSync(new URL('../scripts/check-release-evidence.mjs',import.meta.url),path.join(directory,'scripts/check-release-evidence.mjs'));
    git('init','-q');
    git('add','.');
    git('-c','user.name=Test','-c','user.email=fixture@example.invalid','commit','-qm','baseline');
    const base=git('rev-parse','HEAD').trim();
    write('js/sequencer/saved.js','synthetic changed source');
    git('add','js/sequencer/saved.js');
    git('-c','user.name=Test','-c','user.email=fixture@example.invalid','commit','-qm','changed source');
    write('pr.json',JSON.stringify({pull_request:{base:{sha:base},body:''}}));
    const result=spawnSync(process.execPath,['scripts/check-release-evidence.mjs'],{cwd:directory,encoding:'utf8',
      env:{...process.env,GITHUB_EVENT_PATH:path.join(directory,'pr.json')}});
    assert.equal(result.status,1,result.stderr);
    assert.match(result.stderr,/SEQ-STANDALONE needs an evidence update/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
