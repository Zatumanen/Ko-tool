import{EFFECTS}from './profile.js';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function previewCoverage(preset){
 const notes=['Approximation only. WAV substitutes microphone input in Mic route. Sample route enters at SAMPLE; earlier FX do not affect it.'];
 let playable=true;
 for(const e of preset?.list||[]){
  if(e.BUS){playable=false;notes.push('BUS routing is not simulated; audition disabled.');}
  if(['HARMONY','SSB'].includes(e.effect))notes.push(e.effect+': not simulated (dry bypass).');
  if(e.effect==='DELAY')notes.push('DELAY cross-feed is not simulated; other controls affect the approximation.');
 }
 return{playable,notes};
}
export function modulatedPreset(preset,{handle=0,shake=0,time=0}={}){
 const p=structuredClone(preset),lfo=p.lfo&&{...p.lfo};
 if(p.handle?.target==='lfo'&&lfo)lfo[p.handle.param]=(lfo[p.handle.param]??(p.handle.param==='speed'?1:0))+(p.handle.depth||0)*handle;
 const add=(m,amount)=>{
  if(!m||m.target==='lfo')return;
  const e=p.list[m.row],range=EFFECTS[e?.effect]?.[m.param];if(!range)return;
  e[m.param]=clamp((e[m.param]??range[2])+(m.depth||0)*amount,range[0],range[1]);
 };
 add(p.handle,handle);add(p.shake,shake);
 if(lfo){
  const cycle=time*Math.max(0,lfo.speed??1)+(lfo.phase||0),phase=cycle-Math.floor(cycle);
  const shape=lfo.shape||'sine';
  const value=shape==='square'?(phase<.5?1:-1):shape==='sawtooth'?2*phase-1:shape==='random'?2*((Math.sin(Math.floor(cycle)*127.1+1)*43758.5453)%1+1)%2-1:Math.sin(phase*2*Math.PI);
  add(lfo,value);
 }
 return p;
}

export function createEmulation({AudioContextClass=globalThis.AudioContext,onEnd=()=>{}}={}){
 let context=null,source=null,timer=null,epoch=0,preset=null,controls={handle:0,shake:0},updates=[];
 const stop=()=>{
  epoch++;if(timer!==null)clearInterval(timer);timer=null;
  if(source){source.onended=null;try{source.stop();}catch{}source=null;}
  const old=context;context=null;updates=[];if(old)void old.close().catch(()=>{});
 };
 const tick=()=>{
  if(!context||!preset)return;
  const p=modulatedPreset(preset,{...controls,time:context.currentTime});updates.forEach(fn=>fn(p));
 };
 const param=(p,row,key)=>p.list[row]?.[key]??EFFECTS[p.list[row]?.effect]?.[key]?.[2]??0;
 async function play(bytes,nextPreset,{route='mic',loop=true}={}){
  stop();const generation=epoch;preset=structuredClone(nextPreset);
  if(!previewCoverage(preset).playable)throw Error('BUS preview unavailable');
  const ctx=new AudioContextClass();context=ctx;
  try{
   await ctx.resume();const decoded=await ctx.decodeAudioData(bytes.slice().buffer);
   if(generation!==epoch||context!==ctx)return false;
   source=ctx.createBufferSource();source.buffer=decoded;source.loop=loop;
   let tail=source;
   const append=node=>{tail.connect(node);tail=node;};
   const set=(audioParam,value)=>audioParam.setTargetAtTime(value,ctx.currentTime,.015);
   const hz=x=>Math.min(ctx.sampleRate*.45,20*Math.pow(1000,clamp(x,0,1)));
   const filter=(type,row,key)=>{const n=ctx.createBiquadFilter();n.type=type;append(n);updates.push(p=>set(n.frequency,hz(param(p,row,key))));return n;};
   const sampleRow=preset.list.findIndex(e=>e.effect==='SAMPLE');
   if(route==='sample'&&sampleRow<0)throw Error('This preset has no SAMPLE row');
   for(let row=0;row<preset.list.length;row++){
    if(route==='sample'&&row<sampleRow)continue;
    const e=preset.list[row],type=e.effect;
    if(type==='SAMPLE'){
     if(route!=='sample')continue;
     const gain=ctx.createGain(),pan=ctx.createStereoPanner();append(gain);append(pan);
     updates.push(p=>{set(gain.gain,param(p,row,'level'));set(pan.pan,2*param(p,row,'balance')-1);set(source.playbackRate,param(p,row,'speed')*2**(param(p,row,'pitch')/12));});
    }else if(type==='BALANCE'){
     const pan=ctx.createStereoPanner();append(pan);updates.push(p=>set(pan.pan,2*param(p,row,'balance')-1));
    }else if(type==='LOWPASS'||type==='HIGHPASS')filter(type.toLowerCase(),row,'cutoff');
    else if(type==='EQUALISER'){
     const n=filter('peaking',row,'cutoff');updates.push(p=>{set(n.Q,.1+param(p,row,'Q')*10);set(n.gain,param(p,row,'gain')*12);});
    }else if(type==='DIST'){
     filter('highpass',row,'highpass-cutoff');filter('lowpass',row,'lowpass-cutoff');
     const shaper=ctx.createWaveShaper(),dry=ctx.createGain(),wet=ctx.createGain(),sum=ctx.createGain();
     tail.connect(dry).connect(sum);tail.connect(shaper).connect(wet).connect(sum);tail=sum;
     let previous=-1;updates.push(p=>{
      const drive=param(p,row,'amount'),mix=param(p,row,'mix');set(dry.gain,1-mix);set(wet.gain,mix);
      if(drive!==previous){previous=drive;shaper.curve=Float32Array.from({length:257},(_,i)=>Math.tanh((i/128-1)*(1+drive))/Math.tanh(1+drive));}
     });
    }else if(type==='DELAY'){
     const delay=ctx.createDelay(1.2),feedback=ctx.createGain(),wet=ctx.createGain(),dry=ctx.createGain(),sum=ctx.createGain(),low=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),pan=ctx.createStereoPanner();
     low.type='lowpass';high.type='highpass';tail.connect(dry).connect(sum);tail.connect(delay).connect(high).connect(low);low.connect(feedback).connect(delay);low.connect(wet).connect(pan).connect(sum);tail=sum;
     updates.push(p=>{set(delay.delayTime,Math.max(.001,param(p,row,'time')));set(feedback.gain,Math.min(.95,param(p,row,'echo')));set(dry.gain,param(p,row,'dry-level'));set(wet.gain,param(p,row,'wet-level'));set(low.frequency,hz(param(p,row,'lowpass-cutoff')));set(high.frequency,hz(param(p,row,'highpass-cutoff')));set(pan.pan,param(p,row,'balance')*2-1);});
    }else if(type==='REVERB'){
     const conv=ctx.createConvolver(),dry=ctx.createGain(),wet=ctx.createGain(),sum=ctx.createGain(),hp=ctx.createBiquadFilter();hp.type='highpass';
     const impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*2),ctx.sampleRate);
     for(let c=0;c<2;c++){const a=impulse.getChannelData(c);for(let i=0;i<a.length;i++)a[i]=Math.sin(i*127.1+c*91.7)*Math.exp(-i/ctx.sampleRate*3)*.2;}
     conv.buffer=impulse;tail.connect(dry).connect(sum);tail.connect(conv).connect(hp).connect(wet).connect(sum);tail=sum;
     updates.push(p=>{set(dry.gain,param(p,row,'dry-level'));set(wet.gain,param(p,row,'wet-level')*(.2+.8*param(p,row,'time'))*(1+.25*param(p,row,'spring-mix')));set(hp.frequency,hz(param(p,row,'highpass-cutoff')));});
    }else if(type==='RING'){
     const ring=ctx.createGain(),osc=ctx.createOscillator(),wet=ctx.createGain(),dry=ctx.createGain(),sum=ctx.createGain();ring.gain.value=0;osc.connect(ring.gain);tail.connect(ring).connect(wet).connect(sum);tail.connect(dry).connect(sum);osc.start();tail=sum;
     updates.push(p=>{set(osc.frequency,param(p,row,'frequency'));const mix=param(p,row,'mix');set(wet.gain,mix);set(dry.gain,1-mix);});
    }
   }
   const master=ctx.createGain();master.gain.value=.4;append(master);tail.connect(ctx.destination);
   tick();source.onended=()=>{if(generation===epoch){stop();onEnd();}};source.start();timer=setInterval(tick,33);return true;
  }catch(error){if(generation===epoch)stop();throw error;}
 }
 return{play,stop,update(next){preset=structuredClone(next);tick();},setControls(next){controls={...controls,...next};tick();},get active(){return !!source;}};
}
