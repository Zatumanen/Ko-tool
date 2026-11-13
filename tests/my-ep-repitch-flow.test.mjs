import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRepitchInput, markSpeedUppercutWav} from '../js/ep133/repitchProvenance.js';
import {prepareMyEpRepitchSample} from '../js/ep133/myEpRepitch.js';

const e = new TextEncoder();
function ch(id, content) {
  const b = new Uint8Array(8 + content.length + (content.length % 2));
  b.set(e.encode(id)); new DataView(b.buffer).setUint32(4, content.length, true);
  b.set(content, 8); return b;
}
function wav(pitch, extra={}) {
  const f=new Uint8Array(16), v=new DataView(f.buffer);
  v.setUint16(0,1,true);v.setUint16(2,1,true);v.setUint32(4,32000,true);
  v.setUint32(8,64000,true);v.setUint16(12,2,true);v.setUint16(14,16,true);
  const cs=[ch('fmt ',f)];
  if(pitch!==undefined){
    const j=e.encode(JSON.stringify({'sound.pitch':pitch,'sound.playmode':'loop',...extra}));
    const tnge=new Uint8Array(j.length+12);tnge.set(e.encode('INFO'),0);tnge.set(e.encode('TNGE'),4);
    new DataView(tnge.buffer).setUint32(8,j.length,true);tnge.set(j,12);
    cs.push(ch('LIST',tnge));
  }
  cs.push(ch('data',new Uint8Array(8)));
  const size=12+cs.reduce((n,c)=>n+c.length,0),b=new Uint8Array(size);
  b.set(e.encode('RIFF'));new DataView(b.buffer).setUint32(4,size-8,true);b.set(e.encode('WAVE'),8);
  let off=12; for(const c of cs){b.set(c,off);off+=c.length;}
  return b;
}
const file=(bytes,name='test.wav')=>new File([bytes],name,{type:'audio/wav'});
const fakePrepare=async (f, {onProgress}={}) => {
  onProgress?.(100,{status:'ready'});
  return {data: new Uint8Array(await f.arrayBuffer()),metadata:{'sound.pitch':-12}};
};

test('raw WAV gets exactly one converter invocation and verified handoff', async()=>{
  let converted=0, prepared=0;
  const convertedWav=await markSpeedUppercutWav(new Blob([wav(-12)]));
  const res=await prepareMyEpRepitchSample(file(wav()), {
    prepareDirect:async (...args)=>{prepared++;return fakePrepare(...args);},
    convert:async ()=>{converted++;return {blob:convertedWav};}
  });
  assert.equal(converted,1);assert.equal(prepared,1);
  assert.equal((await classifyRepitchInput(res.data,{filename:'test.wav'})).kind,'trusted');
});

test('trusted prepared WAV bypasses x2 entirely', async()=>{
  const marked=await markSpeedUppercutWav(new Blob([wav(-12)]));
  const r=await prepareMyEpRepitchSample(file(marked),{
    prepareDirect:fakePrepare,
    convert:async()=>{throw Error('Unexpected x2');}
  });
  assert.equal(r.metadata['sound.pitch'],-12);
});

test('legacy -12 requires explicit approval; denied approval performs no conversion', async()=>{
  let touched=false;
  await assert.rejects(()=>prepareMyEpRepitchSample(file(wav(-12)),{
    confirmAmbiguous:async()=>false,
    prepareDirect:async()=>{touched=true;}
  }),/cancelled/);
  assert.equal(touched,false);
  const r=await prepareMyEpRepitchSample(file(wav(-12)),{
    confirmAmbiguous:async()=>true, prepareDirect:fakePrepare,
    convert:async()=>{throw Error('Unexpected x2');}
  });
  assert.equal(r.metadata['sound.pitch'],-12);
});

test('processor output without provenance is rejected before direct upload', async()=>{
  let touched=false;
  await assert.rejects(()=>prepareMyEpRepitchSample(file(wav()),{
    prepareDirect:async()=>{touched=true;},
    convert:async()=>({blob:new Blob([wav(-12)])})
  }), /no matching content-bound provenance/);
  assert.equal(touched,false);
});


test('raw TE WAV preserves validated release/rootnote/pan while setting x2 compensation',async()=>{
  const source=wav(0,{'envelope.release':42,'sound.rootnote':67,'sound.pan':-3,'sample.start':0,'sample.end':4});
  const preparedOutput=await markSpeedUppercutWav(new Blob([wav(-12)]));
  let conversions=0;
  const result=await prepareMyEpRepitchSample(file(source),{
    prepareDirect:fakePrepare,
    convert:async()=>{conversions++;return{blob:preparedOutput};}
  });
  assert.equal(conversions,1);
  assert.equal(result.metadata['sound.pitch'],-12);
  assert.equal(result.metadata['envelope.release'],42);
  assert.equal(result.metadata['sound.rootnote'],67);
  assert.equal(result.metadata['sound.pan'],-3);
  assert.equal(result.metadata['sample.end'],undefined);
});

test('unsafe loop or cropped sample metadata fails before DSP or FILE writes',async()=>{
  const output=await markSpeedUppercutWav(new Blob([wav(-12)]));
  for(const meta of [{'sound.loopstart':0},{'sample.start':1},{'sample.end':3},
      {'time.mode':'beat'}, {'regions':[{'start':1}]}]){
    let invoked=0;
    await assert.rejects(()=>prepareMyEpRepitchSample(file(wav(0,meta)),{
      convert:async()=>{invoked++;return{blob:output};},
      prepareDirect:async()=>{invoked++;return fakePrepare(file(wav(0)));}
    }),/cannot safely preserve/, 'Expected a pre-DSP rejection for: '+JSON.stringify(meta));
    assert.equal(invoked,0);
  }
});

test('batch preflight gives only one informed prompt for many ambiguous WAV files',async()=>{
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  const items=[file(wav(-12),'a.wav'),file(wav(-12),'b.wav'),file(wav(),'c.wav')];
  let prompts=0,checks=0;
  const accepted=await preflightRepitchBatch(items,{
    assertSession:()=>{checks++;},
    confirmAmbiguous:async ({count,total})=>{prompts++;assert.equal(count,2);assert.equal(total,3);return true;}
  });
  assert.equal(prompts,1);assert.ok(checks>=7);
  assert.equal(accepted.size,2);assert.ok(accepted.has(items[0]));assert.ok(accepted.has(items[1]));
});

test('batch cancel does not classify as consent and stops before mutation',async()=>{
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  const answer=await preflightRepitchBatch([file(wav(-12))],{
    confirmAmbiguous:async()=>false
  });
  assert.equal(answer,null);
});

test('batch malformed WAV fails before consent and before any mutation',async()=>{
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  let consent=0;
  await assert.rejects(()=>preflightRepitchBatch([
    file(wav(-12),'first.wav'),file(new Uint8Array(14),'bad.wav')
  ],{confirmAmbiguous:async()=>{consent++;return true;}}), /RIFF\/WAVE/);
  assert.equal(consent,0);
});

test('batch preflight observes session changes between file read and classification',async()=>{
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  let current=true, classified=0;
  const dynamic={name:'test.wav',arrayBuffer:async()=>{current=false;return wav().buffer;}};
  await assert.rejects(()=>preflightRepitchBatch([dynamic],{
    assertSession:()=>{if(!current)throw Error('Device session changed');},
    classify:async()=>{classified++;return{kind:'raw'};}
  }),/Device session changed/);
  assert.equal(classified,0);
});

test('malformed loop sentinel and regions refuse repitch before DSP',async()=>{
  const generated=await markSpeedUppercutWav(new Blob([wav(-12)]));
  for(const meta of [{'sound.loopstart':'bad'},{'sound.loopend':-2},{regions:'bad'},
      {'sample.start':'0'},{'sample.end':'4'}]){
    let count=0;
    await assert.rejects(()=>prepareMyEpRepitchSample(file(wav(0,meta)),{
      convert:async()=>{count++;return{blob:generated};},prepareDirect:async()=>{count++;throw Error('Unexpected upload');}
    }),/cannot safely preserve/);
    assert.equal(count,0);
  }
});

test('batch preflight rejects a later unsafe sample before asking consent or starting any conversion', async () => {
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  const inputs=[file(wav(-12),'old.wav'),file(wav(0,{'sound.loopstart':1}),'unsafe.wav')];
  let prompts=0,conversions=0;
  await assert.rejects(()=>preflightRepitchBatch(inputs,{
    confirmAmbiguous:async()=>{prompts++;return true;},
    classify:async(...args)=>{
      conversions++;
      return classifyRepitchInput(...args);
    }
  }),/cannot safely preserve/);
  assert.equal(prompts,0);
  assert.equal(conversions,2,'Both inputs may be parsed, but no file is converted');
});

test('raw metadata with invalid but coercible values is rejected instead of being silently dropped', async () => {
  const {preflightRepitchBatch}=await import('../js/ep133/myEpRepitch.js');
  for (const bad of [
    {'sound.rootnote':'60'}, {'sound.pan':'0'}, {'sound.amplitude':[]},
    {'envelope.attack':'12'}, {'envelope.release':{}},
    {'sound.bpm':'90'}, {'custom.trim':5}
  ]) {
    const src=file(wav(0,bad));
    await assert.rejects(()=>preflightRepitchBatch([src]),
      /cannot safely preserve/, JSON.stringify(bad));
    await assert.rejects(()=>prepareMyEpRepitchSample(src,{
      convert:async()=>{throw Error('DSP must not run');}
    }),/cannot safely preserve/, JSON.stringify(bad));
  }
});

test('valid source BPM and unchanged sonic metadata are preserved after x2',async()=>{
  const src=wav(0,{'sound.bpm':90,'sound.rootnote':64,'sample.start':0,'sample.end':4});
  const output=await markSpeedUppercutWav(new Blob([wav(-12)]));
  const result=await prepareMyEpRepitchSample(file(src),{
    convert:async()=>({blob:output}),prepareDirect:fakePrepare
  });
  assert.equal(result.metadata['sound.bpm'],90);
  assert.equal(result.metadata['sound.rootnote'],64);
  assert.equal(result.metadata['sound.pitch'],-12);
});
