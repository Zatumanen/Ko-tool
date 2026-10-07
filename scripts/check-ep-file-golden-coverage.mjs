import{pathToFileURL}from 'node:url';
import{
  loadGoldenFixture,
  loadGoldenManifest,
  summarizeRealCoverage
}from '../tests/helpers/ep-file-golden-fixtures.mjs';

const sorted=values=>[...values].map(String).sort((a,b)=>a.localeCompare(b));

export function evaluateGoldenCoverageRecords(manifest,fixtures){
  const summary=summarizeRealCoverage(manifest,fixtures);
  const missing=summary.missing;
  const success=new Set(manifest.requiredRealCoverage.success||[]);
  const failure=new Set(manifest.requiredRealCoverage.failure||[]);
  const result={
    covered:sorted(summary.covered),
    missingSuccess:sorted([...missing].filter(item=>success.has(item))),
    missingFailure:sorted([...missing].filter(item=>failure.has(item)))
  };
  return Object.freeze({...result,complete:result.missingSuccess.length===0&&result.missingFailure.length===0});
}

export async function loadGoldenCoverage(manifestUrl=new URL('../tests/fixtures/ep-series/file-traces/v1/manifest.json',import.meta.url)){
  const manifest=await loadGoldenManifest(manifestUrl);
  const fixtures=[];
  for(const entry of manifest.entries){
    if(typeof entry.path!=='string'||!entry.path.trim())throw new Error('Golden manifest entry '+String(entry.id||'<unknown>')+' is missing path.');
    const fixture=await loadGoldenFixture(new URL(entry.path,manifestUrl));
    if(fixture.id!==entry.id)throw new Error('Golden manifest id/path mismatch: '+entry.id+' -> '+fixture.id);
    fixtures.push(fixture);
  }
  return evaluateGoldenCoverageRecords(manifest,fixtures);
}

export function formatGoldenCoverage(result){
  const covered=result.covered.length?result.covered.join(', '):'(none)';
  const missingSuccess=result.missingSuccess.length?result.missingSuccess.join(', '):'(none)';
  const missingFailure=result.missingFailure.length?result.missingFailure.join(', '):'(none)';
  return[
    result.complete?'EP FILE/SysEx real-device golden coverage complete.':'EP FILE/SysEx real-device golden coverage incomplete.',
    'Covered: '+covered,
    'Missing success: '+missingSuccess,
    'Missing failure: '+missingFailure
  ].join('\n');
}

async function main(){
  const result=await loadGoldenCoverage();
  console.log(formatGoldenCoverage(result));
  process.exitCode=result.complete?0:1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    console.error(error?.stack||error);
    process.exitCode=2;
  });
}
