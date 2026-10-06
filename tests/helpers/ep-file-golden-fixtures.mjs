import fs from 'node:fs/promises';

export const REQUIRED_REAL_SUCCESS=Object.freeze([
  'init','list','get','put','move','delete','metadata-get','metadata-set'
]);
export const REQUIRED_REAL_FAILURE=Object.freeze([
  'timeout','late-response','firmware-debug','interrupted-session'
]);

const HEX=/^[0-9a-f]+$/i;
const SHA40=/^[0-9a-f]{40}$/i;
const SHA256=/^sha256:[0-9a-f]{64}$/i;

const fail=message=>{throw new Error(`Invalid EP golden fixture: ${message}`);};
const nonempty=value=>typeof value==='string'&&value.trim().length>0;

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}

function clone(value){
  return structuredClone(value);
}

function validateRealProvenance(provenance){
  const source=provenance?.source;
  if(!source||typeof source!=='object')fail('real-device provenance requires source.');
  if(!nonempty(source.repository))fail('real-device source repository is required.');
  if(!SHA40.test(String(source.commit||'')))fail('real-device source commit must be an immutable 40-char SHA.');
  if(!nonempty(source.path))fail('real-device source path is required.');
  if(!SHA40.test(String(source.blobSha||'')))fail('real-device source blobSha must be a 40-char SHA.');
  if(!nonempty(source.license))fail('real-device source license is required.');
  if(!nonempty(provenance.captureMethod))fail('real-device captureMethod is required.');
  const device=provenance.device;
  if(!device||typeof device!=='object')fail('real-device device identity is required.');
  if(!nonempty(device.family))fail('real-device device family is required.');
  if(!nonempty(device.model))fail('real-device device model is required.');
  if(!Object.hasOwn(device,'firmware'))fail('real-device firmware must be explicit, including null when unknown.');
  if(device.firmware!==null&&!nonempty(device.firmware))fail('real-device firmware must be a nonempty string or null.');
}

function validateSyntheticProvenance(provenance){
  if(!nonempty(provenance?.generator))fail('synthetic provenance generator is required.');
  if(!nonempty(provenance?.basis))fail('synthetic provenance basis is required.');
}

function validateSanitization(sanitization){
  if(!sanitization||typeof sanitization!=='object')fail('sanitization metadata is required.');
  if(sanitization.version!==1)fail('sanitization version must be 1.');
  if(!SHA256.test(String(sanitization.sourceDigest||'')))fail('sourceDigest must be sha256:<64 hex>.');
  if(!SHA256.test(String(sanitization.fixtureDigest||'')))fail('fixtureDigest must be sha256:<64 hex>.');
  if(!Array.isArray(sanitization.transforms))fail('sanitization transforms must be an array.');
}

function validateFrames(frames){
  if(!Array.isArray(frames)||frames.length===0)fail('frames must be a nonempty array.');
  let previous=-1;
  for(let i=0;i<frames.length;i++){
    const frame=frames[i];
    if(!frame||typeof frame!=='object')fail(`frame ${i} must be an object.`);
    if(frame.index!==i)fail(`frame ${i} index must equal its array position.`);
    if(frame.direction!=='tx'&&frame.direction!=='rx')fail(`frame ${i} direction must be tx or rx.`);
    if(!Number.isFinite(frame.deltaMs)||frame.deltaMs<0||frame.deltaMs<previous)fail(`frame ${i} deltaMs must be nonnegative and monotonic.`);
    previous=frame.deltaMs;
    const hex=String(frame.hex||'');
    if(!hex.length||hex.length%2!==0||!HEX.test(hex))fail(`frame ${i} hex must be even-length hexadecimal.`);
    if(!/^f0/i.test(hex)||!/f7$/i.test(hex))fail(`frame ${i} must use SysEx F0...F7 framing.`);
  }
}

export function validateGoldenFixture(value,{requireReal=false}={}){
  if(!value||typeof value!=='object')fail('fixture must be an object.');
  const fixture=clone(value);
  if(fixture.schemaVersion!==1)fail('schemaVersion must be 1.');
  if(!nonempty(fixture.id))fail('id is required.');
  const kind=fixture.provenance?.kind;
  if(kind==='real-device')validateRealProvenance(fixture.provenance);
  else if(kind==='synthetic')validateSyntheticProvenance(fixture.provenance);
  else fail('provenance.kind must be real-device or synthetic.');
  if(requireReal&&kind!=='real-device')fail('real-device evidence is required.');
  validateSanitization(fixture.sanitization);
  const scenario=fixture.scenario;
  if(!scenario||typeof scenario!=='object'||!nonempty(scenario.operation)||!nonempty(scenario.outcome)||!nonempty(scenario.description))fail('scenario operation/outcome/description are required.');
  validateFrames(fixture.frames);
  if(!fixture.expectations||typeof fixture.expectations!=='object')fail('expectations are required.');
  return deepFreeze(fixture);
}

export function decodeFixtureFrame(frame){
  const hex=String(frame?.hex||'');
  if(!hex.length||hex.length%2!==0||!HEX.test(hex))fail('frame hex must be even-length hexadecimal.');
  return Uint8Array.from(Buffer.from(hex,'hex'));
}

export async function loadGoldenFixture(fileUrl,{requireReal=false}={}){
  const text=await fs.readFile(fileUrl,'utf8');
  return validateGoldenFixture(JSON.parse(text),{requireReal});
}

function validateManifest(value){
  if(!value||typeof value!=='object'||value.schemaVersion!==1)throw new Error('Invalid EP golden manifest: schemaVersion must be 1.');
  const required=value.requiredRealCoverage;
  if(!required||!Array.isArray(required.success)||!Array.isArray(required.failure))throw new Error('Invalid EP golden manifest: requiredRealCoverage.success/failure arrays are required.');
  const all=[...required.success,...required.failure];
  if(new Set(all).size!==all.length)throw new Error('Invalid EP golden manifest: required coverage classes must be unique.');
  if(!Array.isArray(value.entries))throw new Error('Invalid EP golden manifest: entries must be an array.');
  for(const entry of value.entries){
    if(!nonempty(entry?.id)||!Array.isArray(entry.coverage)||entry.coverage.some(item=>!nonempty(item)))throw new Error('Invalid EP golden manifest: every entry requires id and coverage[].');
  }
  return deepFreeze(clone(value));
}

export async function loadGoldenManifest(fileUrl){
  const text=await fs.readFile(fileUrl,'utf8');
  return validateManifest(JSON.parse(text));
}

export function summarizeRealCoverage(manifest,fixtures){
  const checked=validateManifest(manifest);
  const byId=new Map((fixtures||[]).map(item=>{
    const fixture=validateGoldenFixture(item);
    return[fixture.id,fixture];
  }));
  const required=new Set([...checked.requiredRealCoverage.success,...checked.requiredRealCoverage.failure]);
  const covered=new Set();
  for(const entry of checked.entries){
    const fixture=byId.get(entry.id);
    if(!fixture||fixture.provenance.kind!=='real-device')continue;
    for(const item of entry.coverage)if(required.has(item))covered.add(item);
  }
  return{covered,missing:new Set([...required].filter(item=>!covered.has(item)))};
}
