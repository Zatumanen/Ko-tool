import {createTransientTrigger} from './transientTrigger.js';
class VisualsTrigger extends AudioWorkletProcessor {
  constructor(){
    super();this.trigger=createTransientTrigger(sampleRate);this.frames=0;
    this.inFlight=false;
    this.port.onmessage=event=>{
      if(event.data?.ack){this.inFlight=false;return;}
      try{this.trigger.configure(event.data);this.dirty=true;this.publish()}catch{this.port.postMessage({error:'Invalid trigger settings'})}
    };
  }
  publish(){
    if(this.inFlight)return;
    const state=this.trigger.snapshot();this.inFlight=true;this.dirty=false;
    this.port.postMessage(state,[state.samples.buffer]);
  }
  process(inputs){
    const channels=inputs[0];if(!channels?.length)return true;
    const mono=new Float32Array(channels[0].length);
    for(const channel of channels)for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/channels.length;
    this.dirty=this.trigger.push(mono)||this.dirty;this.frames+=mono.length;
    if(this.dirty&&this.frames>=sampleRate/30){this.frames=0;this.publish();}
    return true;
  }
}
registerProcessor('visuals-trigger',VisualsTrigger);
