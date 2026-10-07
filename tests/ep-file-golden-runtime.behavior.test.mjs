import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import{execFile}from 'node:child_process';
import{promisify}from 'node:util';
import{fileURLToPath}from 'node:url';
import{
  loadGoldenFixture,
  loadGoldenManifest,
  summarizeRealCoverage
}from './helpers/ep-file-golden-fixtures.mjs';

const execFileAsync=promisify(execFile);
const root=new URL('./fixtures/ep-series/file-traces/v1/',import.meta.url);
const runner=fileURLToPath(new URL('./helpers/ep-file-golden-runtime-runner.mjs',import.meta.url));

const scenarios=[
  ['timeout','speeduppercut-synthetic-timeout-001.json','ready','safe'],
  ['late-response','speeduppercut-synthetic-late-response-001.json','ready','safe'],
  ['firmware-debug','speeduppercut-synthetic-firmware-debug-001.json','unsafe','unsafe'],
  ['interrupted-session','speeduppercut-synthetic-interrupted-session-001.json','unsafe','unsafe']
];

test('synthetic failure fixtures drive production transport and authoritative runtime without becoming hardware evidence',async t=>{
  const fixtures=[];
  for(const[coverage,file,expectedStatus,expectedSafety]of scenarios){
    await t.test(coverage,async()=>{
      const url=new URL('synthetic/'+file,root);
      const fixture=await loadGoldenFixture(url);
      fixtures.push(fixture);
      assert.equal(fixture.provenance.kind,'synthetic');
      assert.deepEqual(fixture.expectations.wire.coverage,[coverage]);
      assert.equal(fixture.expectations.runtime.length,1);
      assert.equal(fixture.expectations.runtime[0].expectedStatus,expectedStatus);
      assert.equal(fixture.expectations.runtime[0].expectedSafety,expectedSafety);

      const{stdout}=await execFileAsync(process.execPath,[runner,fileURLToPath(url)],{
        timeout:10_000,
        maxBuffer:1024*1024
      });
      const result=JSON.parse(stdout.trim());
      assert.equal(result.fixtureId,fixture.id);
      assert.equal(result.status,expectedStatus);
      assert.equal(result.safety,expectedSafety);
      assert.equal(result.directRuntimeDispatch,false);
    });
  }

  const manifest=await loadGoldenManifest(new URL('manifest.json',root));
  const realFixtures=[];
  for(const entry of manifest.entries){
    if(!entry.path.startsWith('real/'))continue;
    realFixtures.push(await loadGoldenFixture(new URL(entry.path,root),{requireReal:true}));
  }
  const summary=summarizeRealCoverage(manifest,[...realFixtures,...fixtures]);
  for(const[coverage]of scenarios)assert.equal(summary.missing.has(coverage),true,coverage+' remains missing real-device evidence');

  const loaderSource=await fs.readFile(new URL('./helpers/ep-file-golden-fixtures.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(loaderSource,/dispatchDeviceRuntimeEvent|deviceRuntime\.dispatch|FILE_OPERATION_STARTED/);
});
