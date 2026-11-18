#!/usr/bin/env node
/** Structural audit gate. It cannot assert that a feature works or that HIL passed. */
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PR_SECTIONS=Object.freeze([
  'Baseline and sources',
  'Existing implementation',
  'Verified gap',
  'Decision and scope',
  'Concurrent PRs and integration',
  'Tests and evidence',
  'Hardware and release'
]);
const software=new Set(['IMPLEMENTED','PARTIAL','MISSING','BLOCKED']);
const automated=new Set(['PASS','PARTIAL','NOT TESTED']);
const hardware=new Set(['SCOPED','HIL PENDING','BLOCKED','NOT APPLICABLE','PASS']);
const requiredIds=new Set([
  'MEP-REPITCH','MEP-PAK-PREVIEW','MEP-PAK-RESTORE','SUC-TO-MYEP',
  'VIS-LUFS','SEQ-STANDALONE','FXM-LIVE','EP136-SIDEKICK'
]);

const nonempty=value=>{
  const body=String(value||'')
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/^\s*[-*]\s*\[(?: |x)\]\s*/gm,'')
    .trim();
  return body.length>=32&&!/^(?:tbd|todo|n\/a|none|later|pending)(?:[.!]?)$/i.test(body);
};

export function validateMatrix(source,{hasFile=()=>true}={}){
  const errors=[];
  const start='<!-- MATRIX_ROWS_START -->',end='<!-- MATRIX_ROWS_END -->';
  const first=source.indexOf(start),last=source.indexOf(end);
  if(first<0||last<first)return ['Implementation matrix must have explicit row markers.'];
  if(!/main@[a-f0-9]{40}/.test(source.slice(0,first)))
    errors.push('Matrix snapshot must identify the reviewed main SHA.');
  const rows=source.slice(first+start.length,last).split(/\r?\n/).map(line=>line.trim())
    .filter(line=>line.startsWith('|'));
  if(rows.length<14)errors.push('Matrix must include header, separator and at least 12 scoped rows.');
  const expected=['ID','Roadmap scope','Software','Automated','Hardware','Evidence and remaining gap'];
  const parse=line=>line.split('|').slice(1,-1).map(cell=>cell.trim());
  if(JSON.stringify(parse(rows[0]||''))!==JSON.stringify(expected))
    errors.push('Matrix header differs from the required six columns.');
  const seen=new Set();
  for(const line of rows.slice(2)){
    const cells=parse(line);
    if(cells.length!==6){errors.push('Invalid matrix column count: '+line.slice(0,60));continue;}
    const [id,scope,s,a,h,evidence]=cells;
    if(!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(id))errors.push('Invalid matrix ID: '+id);
    if(seen.has(id))errors.push('Duplicate matrix ID: '+id);
    seen.add(id);
    if(!scope||!evidence)errors.push('Missing scope/evidence for '+id);
    if(!software.has(s))errors.push('Invalid Software state for '+id+': '+s);
    if(!automated.has(a))errors.push('Invalid Automated state for '+id+': '+a);
    if(!hardware.has(h))errors.push('Invalid Hardware state for '+id+': '+h);
    const quote=String.fromCharCode(96);
    const pattern=new RegExp(quote+'((?:js|tests|docs|scripts)/[^'+quote+'\\n]+)'+quote,'g');
    const refs=[...evidence.matchAll(pattern)].map(match=>match[1]);
    if(!refs.length)errors.push('No tracked evidence path for '+id);
    for(const ref of refs){
      if(ref.includes('..')||!hasFile(ref))errors.push('Missing/unsafe evidence path for '+id+': '+ref);
    }
    if(h==='PASS'&&!/\bHIL\b.*(?:[0-9]{4}-[0-9]{2}-[0-9]{2}).*(?:FW|firmware|OS)/i.test(evidence))
      errors.push('Hardware PASS needs date, scope and exact firmware evidence for '+id);
  }
  for(const id of requiredIds)if(!seen.has(id))errors.push('Missing critical scope: '+id);
  return errors;
}

export function validatePrBody(body){
  const errors=[];
  const text=String(body||'');
  const matches=[...text.matchAll(/^## (.+)\s*$/gm)];
  const sections=new Map();
  for(let i=0;i<matches.length;i++){
    const name=matches[i][1].trim();
    const start=matches[i].index+matches[i][0].length;
    const end=i+1<matches.length?matches[i+1].index:text.length;
    sections.set(name,text.slice(start,end).trim());
  }
  for(const name of PR_SECTIONS){
    if(!sections.has(name))errors.push('Missing PR audit section: '+name);
    else if(!nonempty(sections.get(name)))errors.push('Missing substantive PR audit evidence in: '+name);
  }
  if(!/main@[a-f0-9]{7,40}/i.test(sections.get('Baseline and sources')||''))
    errors.push('PR baseline must give a main commit SHA.');
  const existing=sections.get('Existing implementation')||'';
  if(!/(?:js|tests|docs|scripts)\/[\w./-]+|AGENTS\.md|not applicable[^.\n]*[.:][^\n]+/i.test(existing))
    errors.push('PR must identify inspected source path or explain why code is not applicable.');
  if(!/\b(SKIP|FIX|BUILD|HIL ONLY|RECONCILE)\b/i.test(sections.get('Decision and scope')||''))
    errors.push('PR must choose SKIP, FIX, BUILD, HIL ONLY or RECONCILE.');
  const overlap=sections.get('Concurrent PRs and integration')||'';
  if(!/\boverlap(?:ping|s)?\b/i.test(overlap)||
     !/\b(?:CI|SHA|tested|tests?|not required|blocked)\b/i.test(overlap))
    errors.push('PR must document open-PR overlap and combined-test evidence or why integration is not required.');
  const scope=sections.get('Hardware and release')||'';
  if(!/HIL|hardware|physical|not applicable/i.test(scope) ||
     !/Pages|deploy|publish|release/i.test(scope))
    errors.push('PR must explicitly state hardware acceptance and deployment/release limits.');
  return errors;
}

export function runAudit({eventPath=process.env.GITHUB_EVENT_PATH,hasFile=(name)=>existsSync(path.join(root,name))}={}){
  const file=path.join(root,'docs/IMPLEMENTATION_MATRIX.md');
  const errors=existsSync(file)?validateMatrix(readFileSync(file,'utf8'),{hasFile}):
    ['Missing docs/IMPLEMENTATION_MATRIX.md'];
  if(eventPath&&existsSync(eventPath)){
    try{
      const event=JSON.parse(readFileSync(eventPath,'utf8'));
      if(event.pull_request)errors.push(...validatePrBody(event.pull_request.body));
    }catch(error){errors.push('Cannot parse GitHub event JSON: '+String(error?.message||error));}
  }
  return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failures=runAudit();
  for(const item of failures)console.error('[FAIL] '+item);
  if(!failures.length)console.log('[PASS] Implementation matrix and PR preflight are structurally valid.');
  console.log('Audit validates evidence structure, never real-device acceptance.');
  process.exitCode=failures.length?1:0;
}
