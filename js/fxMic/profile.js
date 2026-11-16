// Independently authored from the public stock guide; evidence in docs/testing/fx-mic-studio.md.
const unit=[0,1,.5];
export const EFFECTS=Object.freeze({
  BALANCE:{balance:unit},
  LOWPASS:{cutoff:[0,1,.5]}, HIGHPASS:{cutoff:[0,1,0]},
  DIST:{amount:[0,40,10],mix:[0,1,.5],'lowpass-cutoff':[0,1,1],'highpass-cutoff':[0,1,0]},
  DELAY:{time:[0,1.1,.3],echo:[0,1,.3],'wet-level':[0,1,.3],'dry-level':[0,1,1],'lowpass-cutoff':[0,1,1],'highpass-cutoff':[0,1,0],'cross-feed':[0,1,0],balance:unit},
  REVERB:{time:[0,1,.4],'wet-level':[0,1,.3],'dry-level':[0,1,1],'spring-mix':[0,1,0],'highpass-cutoff':[0,1,0]},
  EQUALISER:{cutoff:unit,Q:unit,gain:[-1,1,0]},
  HARMONY:{pitch:[.5,2,1],'dry-level':[0,1,.5]},
  RING:{frequency:[0,20000,400],mix:[0,1,.5]},
  SSB:{frequency:[-20000,20000,0]},
  SAMPLE:{speed:[0,4,1],pitch:[-24,24,0],level:[0,1,1],balance:unit}
});
export const SINGLETONS=new Set(['DELAY','REVERB','HARMONY','SSB']);
export const PLAYMODES=['oneshot','hold','startstop'];
export const SHAPES=['sine','square','sawtooth','random'];
export const STOCK_PROFILE=Object.freeze({id:'stock-guide-v1',slots:4,maxRate:96000,maxRows:16,
  budgetBytes:1000000,warningBytes:900000,
  label:'Stock guide · conservative 1 MB budget · hardware capacity unverified'});
// There are no K.O. TOOL EP-2350 physical acceptance records yet.
// Do not turn a third-party report or a successful fake transport into an entry.
export function resolveLiveProfile(){return null;}
export function newEffect(name){
  if(!Object.hasOwn(EFFECTS,name))throw Error('Unknown effect: '+name);
  return{effect:name,...Object.fromEntries(Object.entries(EFFECTS[name]).map(([k,v])=>[k,v[2]]))};
}
