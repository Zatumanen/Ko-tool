import {decodeMidiEvent} from '../ep133/midiEvents.js';

// Same capture ceiling as the exporter. No device, filesystem or network imports.
export const MAX_TRACE_EVENTS=8192;
export const MAX_TRACE_BYTES=8*1024*1024;
const TYPES=['note-on','note-off','clock','start','continue','stop','song-position'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const text=value=>typeof value==='string'&&value.length>0&&value.length<=128;
const stamp=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&
 Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return n?(sorted[(n-1)>>1]+sorted[n>>1])/2:null;};

export function analyzeMidiTrace(trace,{largeGapMs=1000}={}){
 if(!Number.isFinite(largeGapMs)||largeGapMs<=0)throw new RangeError('largeGapMs must be positive and finite.');
 const result={metadata:{contexts:[]},integrity:{errors:[],inputEvents:0,acceptedEvents:0},
  counts:Object.fromEntries(TYPES.map(type=>[type,0])),timeline:[],clocks:{intervals:[],medianPositiveMs:null,minPositiveMs:null,maxPositiveMs:null},
  warnings:[],hypotheses:[],limitations:[
   'Event origin is unverified: metadata does not prove that the EP generated these messages.',
   'Absence of detected errors is not proof of a correct or complete sequence. Capture boundaries may omit prior/following state.',
   'Clock receipt intervals are not precise device BPM or absolute playback position; pauses, scheduling and routing can affect them.',
   'SPP values are not mapped to EP scenes/patterns. Missing events are never reconstructed.',
   'Only the exporter\'s listed decoded types are represented; this is not a complete MIDI/USB capture.'
  ],hilStatus:'PENDING'};
 const error=(code,path)=>result.integrity.errors.push({code,path});
 const warn=(code,index,detail)=>result.warnings.push({code,...(index==null?{}:{index}),detail});
 if(!record(trace)){error('TRACE_STRUCTURE','$');return result;}
 for(const[key,expected]of Object.entries({format:'ko-tool-passive-midi-events',schemaVersion:1,evidence:'UNVERIFIED',hilStatus:'PENDING',timestampDomain:'Web MIDI event.timeStamp (ms)'})){
  if(trace[key]!==expected)error('METADATA_VALUE',key);
 }
 if(!text(trace.appBuildVersion))error('METADATA_TYPE','appBuildVersion');
 else result.metadata.appBuildVersion=trace.appBuildVersion;
 result.metadata.schemaVersion=trace.schemaVersion===1?1:null;
 for(const key of ['wallClockStartedAt','wallClockStoppedAt']){
  if(!iso(trace[key]))error('WALL_CLOCK',key);else result.metadata[key]=trace[key];
 }
 if(iso(trace.wallClockStartedAt)&&iso(trace.wallClockStoppedAt)&&trace.wallClockStoppedAt<trace.wallClockStartedAt)error('WALL_CLOCK_ORDER','wallClockStoppedAt');
 if(!['manual','limit'].includes(trace.stopReason))error('STOP_REASON','stopReason');
 else result.metadata.stopReason=trace.stopReason;
 if(!Array.isArray(trace.decodedMessageTypes)||trace.decodedMessageTypes.length!==TYPES.length||
  !TYPES.every(type=>trace.decodedMessageTypes.includes(type)))error('DECODED_TYPES','decodedMessageTypes');
 const loss=trace.loss;
 if(!record(loss))error('LOSS_STRUCTURE','loss');
 else{
  for(const key of ['observerDropped','deliveredButNotStored'])if(!integer(loss[key]))error('LOSS_VALUE','loss.'+key);
  if(!integer(loss.captureLimit)||loss.captureLimit<1||loss.captureLimit>MAX_TRACE_EVENTS)error('LOSS_VALUE','loss.captureLimit');
  if(typeof loss.captureLimitReached!=='boolean')error('LOSS_VALUE','loss.captureLimitReached');
  result.metadata.loss=Object.fromEntries(['observerDropped','captureLimit','captureLimitReached','deliveredButNotStored']
   .filter(key=>key==='captureLimitReached'?typeof loss[key]==='boolean':integer(loss[key])).map(key=>[key,loss[key]]));
  if(integer(loss.observerDropped)&&loss.observerDropped>0)warn('OBSERVER_DROPPED',null,`${loss.observerDropped} reported before delivery; locations unknown.`);
  if(loss.captureLimitReached===true)warn('CAPTURE_LIMIT_REACHED',null,'Observation stopped at capacity; later input is unknown.');
  if(integer(loss.deliveredButNotStored)&&loss.deliveredButNotStored>0)warn('DELIVERED_NOT_STORED',null,`${loss.deliveredButNotStored} delivered events omitted at capacity.`);
  if((integer(loss.deliveredButNotStored)&&loss.deliveredButNotStored>0&&loss.captureLimitReached!==true)||
   (typeof loss.captureLimitReached==='boolean'&&loss.captureLimitReached!==(trace.stopReason==='limit')))error('LOSS_CONTRADICTION','loss');
 }
 if(!Array.isArray(trace.events)){error('EVENTS_STRUCTURE','events');return result;}
 result.integrity.inputEvents=trace.events.length;
 if(trace.events.length>MAX_TRACE_EVENTS){error('EVENT_LIMIT','events');return result;}
 if(record(loss)&&integer(loss.captureLimit)&&(trace.events.length>loss.captureLimit||
  (loss.captureLimitReached===true&&trace.events.length!==loss.captureLimit)))error('LOSS_COUNT_CONTRADICTION','loss.captureLimit');
 if(!trace.events.length)warn('EMPTY_TRACE',null,'No events to analyze.');
 let previous=null,previousClock=null,transport='unknown',sawStart=false,previousTransport=null,segment=0;
 const reset=()=>{previous=null;previousClock=null;transport='unknown';sawStart=false;previousTransport=null;segment++;};
 const contexts=new Set();
 for(let index=0;index<trace.events.length;index++){
  const event=trace.events[index],prefix=`events[${index}]`,before=result.integrity.errors.length;
  if(!record(event)){error('EVENT_STRUCTURE',prefix);reset();continue;}
  const decoded=decodeMidiEvent(event.data);
  if(!decoded)error('MIDI_BYTES',prefix+'.data');
  else{
   for(const[key,value]of Object.entries(decoded))if(key!=='data'&&event[key]!==value)error('DECODE_MISMATCH',prefix+'.'+key);
   for(const key of ['note','velocity','position'])if(!(key in decoded)&&Object.hasOwn(event,key))error('UNEXPECTED_DECODED_FIELD',prefix+'.'+key);
  }
  if(!stamp(event.timestamp))error('EVENT_TIMESTAMP',prefix+'.timestamp');
  for(const key of ['session','connectionEpoch'])if(!integer(event[key]))error('SESSION_VALUE',prefix+'.'+key);
  for(const key of ['model','firmware'])if(!text(event[key]))error('SOURCE_METADATA',prefix+'.'+key);
  if(result.integrity.errors.length!==before){reset();continue;}
  if(previous&&(event.session!==previous.session||event.connectionEpoch!==previous.connectionEpoch)){
   warn('SESSION_EPOCH_CHANGED',index,'Correlation reset at observed session/epoch boundary.');reset();
  }else if(previous&&(event.model!==previous.model||event.firmware!==previous.firmware)){
   warn('SOURCE_METADATA_CHANGED',index,'Correlation reset at model/firmware metadata boundary.');reset();
  }
  const context={model:event.model,firmware:event.firmware,session:event.session,connectionEpoch:event.connectionEpoch};
  const key=JSON.stringify(context);if(!contexts.has(key)){contexts.add(key);result.metadata.contexts.push(context);}
  result.integrity.acceptedEvents++;result.counts[decoded.type]++;
  if(previous){
   const delta=event.timestamp-previous.timestamp;
   if(delta===0)warn('TIMESTAMP_EQUAL',index,'Same receipt timestamp as the preceding event.');
   if(delta<0)warn('TIMESTAMP_DECREASED',index,'Receipt timestamps decrease in file order; events were not reordered.');
   if(delta>largeGapMs)warn('TIMESTAMP_LARGE_GAP',index,`Receipt interval ${delta} ms exceeds diagnostic threshold ${largeGapMs} ms.`);
  }
  if(decoded.type==='clock'){
   if(previousClock){
    const interval={fromIndex:previousClock.index,toIndex:index,segment,deltaMs:event.timestamp-previousClock.timestamp};
    result.clocks.intervals.push(interval);
    if(interval.deltaMs>largeGapMs)warn('CLOCK_LARGE_GAP',index,`Received Clock interval ${interval.deltaMs} ms exceeds threshold ${largeGapMs} ms; cause unknown.`);
   }
   previousClock={index,timestamp:event.timestamp};
  }
  if(['start','continue','stop','song-position'].includes(decoded.type)){
   const entry={index,type:decoded.type,timestamp:event.timestamp,...context,segment};
   if(decoded.type==='song-position'){
    entry.position=decoded.position;entry.previousTransport=previousTransport?{...previousTransport}:null;
    entry.sincePreviousTransportMs=previousTransport?event.timestamp-previousTransport.timestamp:null;
   }else{
    if(decoded.type==='start'){
     if(transport==='running')warn('TRANSPORT_REPEATED_START',index,'Start while the observed transport was already running.');
     transport='running';sawStart=true;
    }else if(decoded.type==='stop'){
     if(!sawStart)warn('TRANSPORT_STOP_WITHOUT_START',index,'No Start observed in this continuous segment; prior state unknown.');
     if(transport==='stopped')warn('TRANSPORT_REPEATED_STOP',index,'Repeated Stop in the observed sequence.');
     transport='stopped';
    }else{
     if(!sawStart)warn('TRANSPORT_CONTINUE_WITHOUT_START',index,'No Start observed in this continuous segment; prior state unknown.');
     if(transport==='running')warn('TRANSPORT_CONTINUE_WHILE_RUNNING',index,'Continue while the observed transport was already running.');
     transport='running';
    }
    previousTransport={index,type:decoded.type,timestamp:event.timestamp};
   }
   result.timeline.push(entry);
  }
  previous=event;
 }
 let next=null,nextSegment=null;
 for(let i=result.timeline.length-1;i>=0;i--){
  const entry=result.timeline[i];if(entry.segment!==nextSegment){next=null;nextSegment=entry.segment;}
  if(entry.type==='song-position'){entry.nextTransport=next?{...next}:null;entry.untilNextTransportMs=next?next.timestamp-entry.timestamp:null;}
  else next={index:entry.index,type:entry.type,timestamp:entry.timestamp};
 }
 const positive=result.clocks.intervals.map(i=>i.deltaMs).filter(n=>n>0),middle=median(positive);
 result.clocks.medianPositiveMs=middle;
 result.clocks.minPositiveMs=positive.length?Math.min(...positive):null;result.clocks.maxPositiveMs=positive.length?Math.max(...positive):null;
 // Compare within continuous segments only, never across devices/sessions or corruption.
 const groups=new Map();
 for(const interval of result.clocks.intervals)if(interval.deltaMs>0){
  if(!groups.has(interval.segment))groups.set(interval.segment,[]);
  groups.get(interval.segment).push(interval.deltaMs);
 }
 const medians=new Map([...groups].filter(([,values])=>values.length>=3).map(([id,values])=>[id,median(values)]));
 for(const interval of result.clocks.intervals){
  const localMedian=medians.get(interval.segment);if(localMedian===undefined)continue;
  if(interval.deltaMs>=localMedian*2)warn('CLOCK_GAP_OBSERVED',interval.toIndex,`${interval.deltaMs} ms >= 2 × segment median positive receipt interval; cause unknown.`);
  if(interval.deltaMs>0&&Math.abs(interval.deltaMs-localMedian)>localMedian*0.2)warn('CLOCK_IRREGULAR_INTERVAL',interval.toIndex,'Receipt interval differs from segment positive median by more than 20%; cause unknown.');
 }
 result.clocks.largeGapThresholdMs=largeGapMs;
 return result;
}

// Bounded text presentation; structured results retain every accepted interval/timeline entry.
export function formatMidiTraceReport(result){
 const lines=[],show=(label,value)=>lines.push(`${label}: ${JSON.stringify(value)}`);
 show('Trace metadata',{...result.metadata,contexts:result.metadata.contexts.slice(0,8),contextCount:result.metadata.contexts.length});
 if(result.metadata.contexts.length>8)lines.push(`  ${result.metadata.contexts.length-8} additional source contexts omitted from compact report.`);
 show('Integrity',{inputEvents:result.integrity.inputEvents,acceptedEvents:result.integrity.acceptedEvents,errorCount:result.integrity.errors.length});
 for(const e of result.integrity.errors.slice(0,20))show('  error',e);
 if(result.integrity.errors.length>20)lines.push(`  ${result.integrity.errors.length-20} additional errors omitted from compact report.`);
 show('Event counts (fully validated records only)',result.counts);
 lines.push(`Transport timeline (${result.timeline.length} observed entries)`);
 for(const e of result.timeline.slice(0,24))show('  event',e);
 if(result.timeline.length>24)lines.push(`  ${result.timeline.length-24} additional timeline entries omitted from compact report.`);
 show('Clock observations',{intervalCount:result.clocks.intervals.length,medianPositiveMs:result.clocks.medianPositiveMs,
  minPositiveMs:result.clocks.minPositiveMs,maxPositiveMs:result.clocks.maxPositiveMs,largeGapThresholdMs:result.clocks.largeGapThresholdMs});
 show('  first received intervals (ms)',result.clocks.intervals.slice(0,16));
 const warningCounts={};for(const warning of result.warnings)warningCounts[warning.code]=(warningCounts[warning.code]||0)+1;
 show('Diagnostic warnings (receipt heuristics, not device verdicts)',{total:result.warnings.length,counts:warningCounts});
 for(const w of result.warnings.slice(0,24))show('  warning',w);
 if(result.warnings.length>24)lines.push(`  ${result.warnings.length-24} additional warnings omitted from compact report.`);
 lines.push('Evidence limitations');for(const l of result.limitations)lines.push('  '+l);
 lines.push('Unconfirmed hypotheses: none generated.','HIL status: PENDING');
 return lines.join('\n')+'\n';
}
