#!/usr/bin/env node
import{execFileSync}from 'node:child_process';
import{existsSync,readFileSync,writeFileSync}from 'node:fs';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const registryPath='docs/release-evidence.json';
const documentNames=['README.md','docs/PROJECT_STATE.md','docs/IMPLEMENTATION_MATRIX.md','docs/RELEASE.md'];
const shaKeys=['SOURCE_SHA','TESTED_SHA','MERGED_SHA','PUBLISHED_SHA','LIVE_SHA'];
const requiredJobs=['codex-preflight','unit','build-pages','browser-e2e'];
const codeStates=new Set(['IMPLEMENTED','PARTIAL','MISSING','BROKEN','BLOCKED']);
const automaticStates=new Set(['PASS','PARTIAL','NOT TESTED','FAIL']);
const hilStates=new Set(['PASS','SCOPED','HIL PENDING','BLOCKED','NOT APPLICABLE']);
const ownerStates=new Set(['PASS','SCOPED','PENDING','BLOCKED']);
const browserOnly=new Set(['SUC-FOLDERS','VIS-BASE','VIS-TRIGGER','VIS-SPECTRUM','VIS-SPECTROGRAM','VIS-THEMES-PERF',
  'VIS-XY','VIS-STEREO','VIS-OUTPUT','VIS-LUFS','VIS-RECORDER','FXM-OFFLINE']);
const enrollmentScripts=new Set(['scripts/check-release-evidence.mjs','scripts/check-implementation-audit.mjs']);
const publicSummary=new Set(['MEP-PADS-WRITE','MEP-PAK-RESTORE','SEQ-STANDALONE','SEQ-LIVE','FXM-LIVE','EP136-SIDEKICK']);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&
  Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const run=value=>typeof value==='string'&&/^https:\/\/github\.com\/Zatumanen\/Ko-tool\/actions\/runs\/\d+$/.test(value);
const pr=value=>typeof value==='string'&&/^https:\/\/github\.com\/Zatumanen\/Ko-tool\/pull\/\d+$/.test(value);
const evidenceLink=value=>typeof value==='string'&&/^https:\/\/(linear\.app\/clouded\/|github\.com\/Zatumanen\/Ko-tool\/)/.test(value)&&!/\/actions\//.test(value);
const evidencePath=value=>typeof value==='string'&&(value==='index.html'||/^(js|css|tests|docs|scripts)\/[\w./-]+$/.test(value))&&!value.includes('..');
const notes=value=>typeof value==='string'&&value.trim().length>=24&&!/[\r\n|]/.test(value);
const productionPath=value=>value==='index.html'||/^(js|css|scripts)\//.test(value);
const testPath=value=>typeof value==='string'&&/^tests\/.*\.(?:test|spec)\.[cm]?[jt]s$/.test(value);
const label=value=>typeof value==='string'&&value.trim().length>0&&value.length<=80&&!/[\r\n|]/.test(value);
const validUpdate=(update,paths)=>sha(update?.baseSha)&&notes(update.note)&&Array.isArray(update.tests)&&
  update.tests.length>0&&Array.isArray(paths)&&update.tests.every(name=>testPath(name)&&paths.includes(name));

export function deploymentStatus({PUBLISHED_SHA,LIVE_SHA}){
  if(!PUBLISHED_SHA||!LIVE_SHA)return 'UNKNOWN';
  return PUBLISHED_SHA===LIVE_SHA?'MATCH':'DRIFT';
}

export function validateReleaseEvidence(registry,{hasFile=name=>existsSync(path.join(root,name))}={}){
  const errors=[];
  const checkpoint=registry?.checkpoint;
  if(registry?.schemaVersion!==1||!checkpoint||!Array.isArray(registry.features)||!registry.releaseGates)
    return ['Invalid release-evidence shape.'];
  for(const key of shaKeys){
    if(!sha(checkpoint[key])&&!(['PUBLISHED_SHA','LIVE_SHA'].includes(key)&&checkpoint[key]===null))
      errors.push('Invalid evidence '+key);
  }
  if(!run(checkpoint.tests)||requiredJobs.some(name=>checkpoint.jobs?.[name]!=='success'))
    errors.push('TESTED_SHA requires a CI run and all four successful jobs.');
  if(!pr(checkpoint.merge))errors.push('MERGED_SHA requires a merged PR link.');
  if(checkpoint.PUBLISHED_SHA?!(run(checkpoint.publish)&&checkpoint.publishEvent==='workflow_dispatch'):!!checkpoint.publish)
    errors.push('PUBLISHED_SHA and a verified manual Pages run must be recorded together.');
  if(checkpoint.publish&&checkpoint.publish===checkpoint.tests)errors.push('CI and manual Pages require distinct runs for Pages publication.');
  if(checkpoint.LIVE_SHA&&(checkpoint.liveUrl!=='https://zatumanen.github.io/Ko-tool/build-version.json'||!date(checkpoint.liveObservedAt)))
    errors.push('LIVE_SHA requires a dated observation of the public build-version.');

  const ids=new Set(),stages=new Set();
  for(const feature of registry.features){
    if(!feature||typeof feature!=='object'){errors.push('Invalid feature record.');continue;}
    const{id,stage,scope,code,automated,hil,owner,paths,verification,sourceSha,testedSha}=feature;
    if(typeof id!=='string'||!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(id)||ids.has(id))errors.push('Invalid or duplicate feature '+id);
    ids.add(id);stages.add(stage);
    if(!Number.isInteger(stage)||stage<1||stage>6||typeof scope!=='string'||!/^[^|\r\n]+$/.test(scope))errors.push(id+' has invalid scope.');
    if(!codeStates.has(code)||!automaticStates.has(automated)||!hilStates.has(hil)||!ownerStates.has(owner))errors.push(id+' has an invalid evidence status.');
    if(!sha(sourceSha)||!notes(verification))errors.push(id+' needs an exact source SHA and a verification summary.');
    if(!Array.isArray(paths)||!paths.length||paths.some(p=>!evidencePath(p)||!hasFile(p)))errors.push(id+' has missing or unsafe evidence paths.');
    if(automated==='PASS'&&(!sha(testedSha)||(testedSha!==checkpoint.TESTED_SHA&&!run(feature.ci))||
      !Array.isArray(paths)||!paths.some(p=>typeof p==='string'&&testPath(p))))
      errors.push(id+' automated PASS needs a tested SHA and test paths.');
    if(hil==='NOT APPLICABLE'&&!browserOnly.has(id))errors.push(id+' has a required hardware scope.');
    if(feature.evidenceUpdate!==undefined&&!validUpdate(feature.evidenceUpdate,paths))errors.push(id+' has invalid regression evidence.');
    if(feature.pullRequest!==undefined&&!pr(feature.pullRequest))errors.push(id+' has an invalid PR link.');
    const real=feature.hilEvidence;
    if(hil==='PASS'&&!(real?.kind==='real-device'&&notes(real.scope)&&label(real.model)&&label(real.firmware)&&date(real.date)&&real.sourceSha===sourceSha&&evidenceLink(real.url)))
      errors.push(id+' HIL PASS requires physical device evidence, exact firmware, scope, date and SHA.');
    const accepted=feature.ownerEvidence;
    if(owner==='PASS'&&!(date(accepted?.date)&&accepted.sourceSha===sourceSha&&evidenceLink(accepted.url)))
      errors.push(id+' OWNER PASS requires an explicit, dated owner record tied to the source SHA.');
  }
  if(stages.size!==6||[...publicSummary].some(id=>!ids.has(id)))errors.push('The evidence registry must cover all six stages and required release claims.');

  const gates=['distributionRights','hostAcceptance','securityReview'];
  for(const key of gates){
    const gate=registry.releaseGates[key];
    if(!gate||!['PASS','PENDING','BLOCKED'].includes(gate.status)||!notes(gate.reason)||
      (gate.status==='PASS'&&(!sha(gate.sourceSha)||!evidenceLink(gate.url))))errors.push('Missing or invalid release gate '+key);
  }
  if(!['GO','NO-GO'].includes(registry.decision))errors.push('Invalid release decision.');
  if(registry.decision==='GO'){
    const exact=sha(registry.rcSha)&&['SOURCE_SHA','TESTED_SHA','MERGED_SHA'].every(key=>checkpoint[key]===registry.rcSha);
    const accepted=registry.features.every(row=>row?.code==='IMPLEMENTED'&&row.automated==='PASS'&&row.testedSha===registry.rcSha&&row.sourceSha===registry.rcSha&&
      (row.hil==='PASS'||row.hil==='NOT APPLICABLE'&&browserOnly.has(row.id))&&row.owner==='PASS');
    if(!exact||!accepted||gates.some(key=>registry.releaseGates[key]?.status!=='PASS'||registry.releaseGates[key]?.sourceSha!==registry.rcSha))
      errors.push('Release GO conflicts with open code, automation, hardware, owner or release gates.');
  }
  return errors;
}

const markers=name=>name==='docs/IMPLEMENTATION_MATRIX.md'
  ?['<!-- MATRIX_ROWS_START -->','<!-- MATRIX_ROWS_END -->']
  :['<!-- RELEASE_EVIDENCE_START -->','<!-- RELEASE_EVIDENCE_END -->'];
const matrixRow=row=>{
  const real=row.hil==='PASS'?` HIL ${row.hilEvidence.date} FW ${row.hilEvidence.firmware} ([evidence](${row.hilEvidence.url})).`:'';
  return `| ${row.id} | ${row.scope} | ${row.code} | ${row.automated} | ${row.hil} | ${row.paths.map(p=>'`'+p+'`').join(', ')}. ${row.verification}${real} |`;
};
const publicRow=row=>`| ${row.id} | ${row.code} | ${row.automated} | ${row.hil} | ${row.owner} |`;
export function renderReleaseEvidence(registry,name){
  const[start,end]=markers(name);
  const checkpoint=registry.checkpoint;
  if(name==='docs/IMPLEMENTATION_MATRIX.md')return [start,
    '| ID | Roadmap scope | Software | Automated | Hardware | Evidence and remaining gap |',
    '| --- | --- | --- | --- | --- | --- |',...registry.features.map(matrixRow),end].join('\n');
  const lines=[start,`**K.O. TOOL 1.0 · ${registry.decision}**`,'',
    '| Checkpoint | SHA |','| --- | --- |',
    ...shaKeys.map(key=>`| ${key} | ${checkpoint[key]?`\`${checkpoint[key]}\``:'UNKNOWN'} |`),
    '',`Pages evidence · ${deploymentStatus(checkpoint)}.`,
    '',`[Checked CI](${checkpoint.tests}) · [Merged source](${checkpoint.merge})`+
      (checkpoint.publish?` · [Manual Pages run](${checkpoint.publish})`:'')+
      (checkpoint.LIVE_SHA?` · [Public version observed ${checkpoint.liveObservedAt}](${checkpoint.liveUrl})`:'')];
  if(name==='README.md')lines.push('','| ID | CODE | AUTOMATED | HIL | OWNER |','| --- | --- | --- | --- | --- |',
    ...registry.features.filter(row=>publicSummary.has(row.id)).map(publicRow));
  return [...lines,end].join('\n');
}

function findBlock(doc,name){
  const[start,end]=markers(name);
  const lo=doc.indexOf(start),hi=doc.indexOf(end);
  return lo>=0&&hi>lo&&lo===doc.lastIndexOf(start)&&hi===doc.lastIndexOf(end)
    ?[lo,hi+end.length]:null;
}
export function validateEvidenceDocs(registry,docs){
  const errors=[];
  for(const[name,source]of Object.entries(docs)){
    const doc=source.replace(/\r\n/g,'\n');
    const block=findBlock(doc,name);
    if(!block||doc.slice(...block)!==renderReleaseEvidence(registry,name))errors.push(name+' evidence block differs from the registry.');
  }
  return errors;
}

export function validateEvidenceChange(before,after,changedPaths,{baseSha,exception}={}){
  if(exception){
    if(!['docs-only','HIL-only'].includes(exception.kind)||!notes(exception.reason))return ['Invalid release evidence exception.'];
    const allowed=name=>name==='README.md'||name.startsWith('docs/')||
      (exception.kind==='HIL-only'&&name.startsWith('tests/fixtures/')&&/\.(jsonl?|csv|tsv|txt|hex|bin|wav|tar|zip|pcap)$/i.test(name));
    if(changedPaths.some(name=>!allowed(name)))return ['Release evidence exception cannot cover production code, CI, or executable tests.'];
  }
  if(!before)return changedPaths.some(name=>productionPath(name)&&!enrollmentScripts.has(name))
    ?['Initial release evidence enrollment must exclude production code changes.']:[];
  const oldRows=new Map(before.features.map(row=>[row.id,row]));
  const nextIds=new Set(after.features.map(row=>row.id));
  const errors=before.features.filter(row=>!nextIds.has(row.id)).map(row=>'Release evidence row removed: '+row.id);
  for(const row of after.features){
    const watched=new Set([...(oldRows.get(row.id)?.paths||[]),...row.paths].filter(productionPath));
    if(changedPaths.some(name=>watched.has(name))&&
      (!validUpdate(row.evidenceUpdate,row.paths)||row.evidenceUpdate.baseSha!==baseSha))
      errors.push(row.id+' needs an evidence update with the current base SHA and regression paths.');
  }
  return errors;
}

function githubChange(){
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(!eventPath)return null;
  const event=JSON.parse(readFileSync(eventPath,'utf8'));
  if(!event.pull_request)return null;
  const base=event.pull_request.base?.sha;
  if(!sha(base))throw new Error('PR base SHA is missing or malformed.');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const changed=git('diff','--name-only','--no-renames','-z',base,'HEAD','--').split('\0').filter(Boolean);
  const baseEntries=git('ls-tree','--name-only',base,'--',registryPath).trim();
  const exceptionLine=String(event.pull_request.body||'').match(/^Release evidence exception \((docs-only|HIL-only)\) (.+)$/m);
  const exception=exceptionLine?{kind:exceptionLine[1],reason:exceptionLine[2]}:undefined;
  return{before:baseEntries?JSON.parse(git('show',base+':'+registryPath)):null,changed,baseSha:base,exception};
}

function main(){
  const evidence=JSON.parse(readFileSync(path.join(root,registryPath),'utf8'));
  const errors=validateReleaseEvidence(evidence);
  if(errors.length===0){
    const docs=Object.fromEntries(documentNames.map(name=>[name,readFileSync(path.join(root,name),'utf8')]));
    if(process.argv.includes('--write-docs')){
      const updated=Object.entries(docs).map(([name,doc])=>{
        const block=findBlock(doc,name);
        if(!block)throw new Error(name+' must include one release evidence block.');
        return[name,doc.slice(0,block[0])+renderReleaseEvidence(evidence,name)+doc.slice(block[1])];
      });
      for(const[name,content]of updated)writeFileSync(path.join(root,name),content);
      return;
    }
    errors.push(...validateEvidenceDocs(evidence,docs));
    const change=githubChange();
    if(change)errors.push(...validateEvidenceChange(change.before,evidence,change.changed,{baseSha:change.baseSha,exception:change.exception}));
  }
  for(const error of errors)console.error('[FAIL] '+error);
  if(!errors.length)console.log('[PASS] Release evidence and documentation are consistent on the checked source.');
  process.exitCode=errors.length?1:0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
