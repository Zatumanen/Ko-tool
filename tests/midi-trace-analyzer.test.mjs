import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeMidiEvent} from '../js/ep133/midiEvents.js';
import {createMidiDiagnostics} from '../js/sequencer/midiDiagnostics.js';
import {analyzeMidiTrace,formatMidiTraceReport,MAX_TRACE_EVENTS,MAX_TRACE_BYTES} from '../js/sequencer/midiTraceAnalyzer.js';

const event=(data,timestamp,extra={})=>({...decodeMidiEvent(data),timestamp,session:1,connectionEpoch:7,model:'TE032AS001',firmware:'2.5.1',...extra});
const trace=(events=[],captureLimit=MAX_TRACE_EVENTS)=>{
 let deliver;
 const diagnostics=createMidiDiagnostics({getSession:()=> 'synthetic',canStart:()=>true,now:()=>0,captureLimit,
  subscribe:fn=>{deliver=fn;return{unsubscribe(){}};}});
 diagnostics.start();deliver({events,dropped:0});diagnostics.stop();
 return diagnostics.exportTrace({buildVersion:'synthetic-test'})??{
  format:'ko-tool-passive-midi-events',schemaVersion:1,evidence:'UNVERIFIED',hilStatus:'PENDING',appBuildVersion:'synthetic-test',
  wallClockStartedAt:new Date(0).toISOString(),wallClockStoppedAt:new Date(0).toISOString(),
  timestampDomain:'Web MIDI event.timeStamp (ms)',stopReason:'manual',
  decodedMessageTypes:['note-on','note-off','clock','start','continue','stop','song-position'],
  loss:{observerDropped:0,captureLimit:8192,captureLimitReached:false,deliveredButNotStored:0},events:[]};
};
const codes=result=>result.warnings.map(w=>w.code);

test('actual schema-v1 exporter output yields facts, transport/SPP relationships and immutable input',()=>{
 const input=trace([event([0xFA],0),event([0x92,60,100],1),event([0xF8],10),event([0xF8],30),
  event([0x92,60,0],40),event([0xFC],50),event([0xF2,1,2],55),event([0xFB],60)]);
 const before=structuredClone(input),r=analyzeMidiTrace(input);
 assert.deepEqual(r.integrity.errors,[]);assert.equal(r.integrity.acceptedEvents,8);
 assert.deepEqual(r.counts,{'note-on':1,'note-off':1,clock:2,start:1,continue:1,stop:1,'song-position':1});
 assert.deepEqual(r.clocks.intervals.map(i=>i.deltaMs),[20]);
 assert.equal(r.timeline[2].position,257);assert.equal(r.timeline[2].previousTransport.type,'stop');
 assert.equal(r.timeline[2].sincePreviousTransportMs,5);assert.equal(r.timeline[2].nextTransport.type,'continue');
 assert.equal(r.metadata.contexts[0].model,'TE032AS001');assert.equal(r.hilStatus,'PENDING');
 assert.deepEqual(input,before);assert.ok(!codes(r).some(c=>c.startsWith('TRANSPORT_')));
 const text=formatMidiTraceReport(r);
 for(const heading of ['Trace metadata','Integrity','Event counts','Transport timeline','Clock observations','Evidence limitations','HIL status'])assert.ok(text.includes(heading));
 assert.match(text,/origin.*unverified/i);assert.match(text,/absence.*not.*proof/i);
 assert.match(text,/not.*BPM/i);assert.match(text,/not.*absolute/i);
});

test('damaged MIDI bytes, SPP range, wrong channel/note/velocity/type and incomplete records are rejected',()=>{
 const cases=[{data:[0x90,60,255]},{data:[0xF2,128,0]}, {position:16384}, {channel:17},
  {note:128},{velocity:-1},{type:'clock'},{timestamp:NaN},{timestamp:-1},{session:'private'},
  {connectionEpoch:null},{data:[0xF2,0]}, {channel:undefined}, {model:''}, {firmware:3}];
 for(const patch of cases){
  const base=Object.hasOwn(patch,'position')?event([0xF2,1,2],1):event([0x90,60,100],1);
  const input=trace([{...base,...patch}]);
  const r=analyzeMidiTrace(input);assert.ok(r.integrity.errors.length,JSON.stringify(patch));
  assert.equal(r.integrity.acceptedEvents,0);assert.equal(r.counts.clock,0);
 }
 for(const value of [null,[],{},'bad'])assert.ok(analyzeMidiTrace({...trace(),events:[value]}).integrity.errors.length);
});

test('root structure, timestamps, schema, evidence claims and inconsistent loss metadata fail validation',()=>{
 for(const value of [null,[],{},'text',42])assert.ok(analyzeMidiTrace(value).integrity.errors.length);
 for(const patch of [{schemaVersion:2},{format:'wrong'},{events:null},{hilStatus:'PASS'},{evidence:'VERIFIED'},
  {wallClockStartedAt:'bad'},{wallClockStoppedAt:'1969-01-01T00:00:00.000Z'}, {decodedMessageTypes:['clock']},
  {loss:{observerDropped:-1,captureLimit:8192,captureLimitReached:'yes',deliveredButNotStored:0}}]){
  const r=analyzeMidiTrace({...trace(),...patch});assert.ok(r.integrity.errors.length);assert.equal(r.hilStatus,'PENDING');
 }
 const input=trace([event([0xF8],1)]);input.loss.deliveredButNotStored=1;
 assert.ok(analyzeMidiTrace(input).integrity.errors.length);
 input.loss.deliveredButNotStored={valueOf:0,toString:0};
 assert.ok(analyzeMidiTrace(input).integrity.errors.length);
});

test('transport ambiguity is diagnostic, preserves observed order and never invents missing Start',()=>{
 const input=trace([event([0xFC],0),event([0xFB],1),event([0xFB],2),event([0xFA],3),event([0xFA],4),event([0xFC],5),event([0xFC],6)]);
 const r=analyzeMidiTrace(input);
 for(const code of ['TRANSPORT_STOP_WITHOUT_START','TRANSPORT_CONTINUE_WITHOUT_START','TRANSPORT_CONTINUE_WHILE_RUNNING','TRANSPORT_REPEATED_START','TRANSPORT_REPEATED_STOP'])assert.ok(codes(r).includes(code),code);
 assert.equal(r.timeline.length,7);assert.equal(r.counts.start,2);assert.deepEqual(r.integrity.errors,[]);
});

test('received Clock intervals expose gaps/irregularity without estimating dropped events or BPM',()=>{
 const r=analyzeMidiTrace(trace([0,20,40,80,105,125].map(t=>event([0xF8],t))));
 assert.deepEqual(r.clocks.intervals.map(i=>i.deltaMs),[20,20,40,25,20]);
 assert.equal(r.clocks.medianPositiveMs,20);assert.ok(codes(r).includes('CLOCK_GAP_OBSERVED'));
 assert.ok(codes(r).includes('CLOCK_IRREGULAR_INTERVAL'));assert.equal('bpm' in r.clocks,false);
 assert.equal('missingEvents' in r.clocks,false);assert.equal(r.hypotheses.length,0);
});

test('equal, decreasing and large receipt timestamps are retained and explicitly warned',()=>{
 const r=analyzeMidiTrace(trace([0,0,5,3,3000].map(t=>event([0xF8],t))));
 for(const code of ['TIMESTAMP_EQUAL','TIMESTAMP_DECREASED','TIMESTAMP_LARGE_GAP'])assert.ok(codes(r).includes(code));
 assert.deepEqual(r.clocks.intervals.map(i=>i.deltaMs),[0,5,-2,2997]);
});

test('clock heuristics stay within a session and absolute gaps survive intervening Note events',()=>{
 const fast=[0,10,20,30,40,50,60].map(t=>event([0xF8],t));
 const slow=[0,100,200,300].map(t=>event([0xF8],t,{session:2,connectionEpoch:8}));
 const r=analyzeMidiTrace(trace([...fast,...slow]));
 assert.ok(!codes(r).some(c=>c==='CLOCK_GAP_OBSERVED'||c==='CLOCK_IRREGULAR_INTERVAL'));
 const gap=analyzeMidiTrace(trace([event([0xF8],0),event([0x90,60,1],900),event([0xF8],1500)]));
 assert.ok(codes(gap).includes('CLOCK_LARGE_GAP'));
 assert.ok(!codes(analyzeMidiTrace(trace([event([0xF8],0),event([0xF8],1500)]),{largeGapMs:2000})).includes('CLOCK_LARGE_GAP'));
});

test('loss and capture capacity remain unverified evidence, including exact limit with no within-batch omissions',()=>{
 const input=trace([event([0xF8],1),event([0xF8],2)]);
 input.loss={observerDropped:9,captureLimit:2,captureLimitReached:true,deliveredButNotStored:3};input.stopReason='limit';
 const r=analyzeMidiTrace(input);assert.deepEqual(r.integrity.errors,[]);
 for(const code of ['OBSERVER_DROPPED','CAPTURE_LIMIT_REACHED','DELIVERED_NOT_STORED'])assert.ok(codes(r).includes(code));
 input.loss.deliveredButNotStored=0;assert.deepEqual(analyzeMidiTrace(input).integrity.errors,[]);
});

test('only a limit stop is consistent with a full MIDI trace',()=>{
 const events=[event([0xF8],1),event([0xF8],2)];
 assert.deepEqual(analyzeMidiTrace(trace(events.slice(0,1),2)).integrity.errors,[]);
 const complete=trace(events,2);
 assert.equal(complete.stopReason,'limit');
 assert.deepEqual(analyzeMidiTrace(complete).integrity.errors,[]);
 const mislabeled={...complete,stopReason:'manual',
  loss:{...complete.loss,captureLimitReached:false}};
 assert.ok(analyzeMidiTrace(mislabeled).integrity.errors.some(e=>e.code==='LOSS_COUNT_CONTRADICTION'));
 const short={...complete,events:events.slice(0,1)};
 assert.ok(analyzeMidiTrace(short).integrity.errors.some(e=>e.code==='LOSS_COUNT_CONTRADICTION'));
});

test('session/epoch/model boundaries and corrupt records break sequence correlation',()=>{
 const input=trace([event([0xFA],10),event([0xF8],20),event([0xF8],2,{session:2,connectionEpoch:8}),
  event([0xFC],3,{session:2,connectionEpoch:8}),event([0xF8],4,{session:2,connectionEpoch:8,model:'other'})]);
 const r=analyzeMidiTrace(input);assert.ok(codes(r).includes('SESSION_EPOCH_CHANGED'));assert.ok(codes(r).includes('SOURCE_METADATA_CHANGED'));
 assert.equal(r.clocks.intervals.length,0);assert.ok(codes(r).includes('TRANSPORT_STOP_WITHOUT_START'));
 const damaged={...trace(),events:[event([0xFA],0),null,event([0xFC],2)]};
 assert.ok(codes(analyzeMidiTrace(damaged)).includes('TRANSPORT_STOP_WITHOUT_START'));
});

test('empty traces and event limits produce bounded analysis; unknown private fields are not echoed',()=>{
 assert.ok(codes(analyzeMidiTrace(trace())).includes('EMPTY_TRACE'));
 const input=trace();input.events=Array.from({length:MAX_TRACE_EVENTS+1},(_,i)=>event([0xF8],i));input.secret='PRIVATE-DATA';
 const r=analyzeMidiTrace(input);assert.ok(r.integrity.errors.some(e=>e.code==='EVENT_LIMIT'));
 assert.equal(r.integrity.acceptedEvents,0);assert.doesNotMatch(formatMidiTraceReport(r),/PRIVATE-DATA/);
 const full=trace(Array.from({length:MAX_TRACE_EVENTS},(_,i)=>event([0xF8],i)));
 assert.equal(analyzeMidiTrace(full).integrity.acceptedEvents,MAX_TRACE_EVENTS);
 const many=trace(Array.from({length:100},(_,i)=>event([0xFA],i)));
 assert.ok(formatMidiTraceReport(analyzeMidiTrace(many)).length<16000);
 const contexts=trace(Array.from({length:MAX_TRACE_EVENTS},(_,i)=>event([0xF8],i,{session:i})));
 assert.ok(formatMidiTraceReport(analyzeMidiTrace(contexts)).length<32768);
});

test('local CLI reads explicit regular JSON only, never modifies files, and reports malformed/large/empty input safely',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ko-midi-analyzer-'));const file=path.join(dir,'trace.json');
 const cli=fileURLToPath(new URL('../scripts/analyze-midi-trace.mjs',import.meta.url));
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
 try{
  const source=JSON.stringify(trace([event([0xFA],0),event([0xFC],10)]));await writeFile(file,source);
  let p=run(file);assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/HIL status: PENDING/);assert.equal(await readFile(file,'utf8'),source);
  p=run();assert.equal(p.status,2);assert.match(p.stderr,/Usage:/);
  p=run(file,'--output','forbidden.json');assert.equal(p.status,2);
  for(const data of ['', '{bad', 'null',JSON.stringify(trace([{...event([0xF2,1,2],0),position:16384}]))]){
   await writeFile(file,data);p=run(file);assert.equal(p.status,1);assert.match(p.stdout+p.stderr,/Integrity|JSON/);assert.doesNotMatch(p.stderr,/at .+\.mjs:/);
  }
  await writeFile(file,' '.repeat(MAX_TRACE_BYTES+1));p=run(file);assert.equal(p.status,1);assert.match(p.stderr,/size|large/i);
  await writeFile(file,Buffer.from([0xFF,0xFE]));p=run(file);assert.equal(p.status,1);assert.match(p.stderr,/UTF-8/);
  p=run(path.join(dir,'missing'));assert.equal(p.status,1);
  await mkdir(path.join(dir,'folder'));p=run(path.join(dir,'folder'));assert.equal(p.status,1);assert.match(p.stderr,/regular file/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});
