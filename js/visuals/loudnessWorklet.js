import {createLoudnessMeter} from './loudness.js';
class VisualsLoudness extends AudioWorkletProcessor{
  constructor(options){
    super();this.meter=createLoudnessMeter(sampleRate,options.processorOptions.channels);this.epoch=0;this.inFlight=false;this.dirty=false;this.errorSent=false;
    this.port.onmessage=event=>{
      if(event.data?.ack){this.inFlight=false;return;}
      if(Number.isInteger(event.data?.reset)){
        this.epoch=event.data.reset;this.meter.reset();this.dirty=true;this.errorSent=false;
      }
    };
  }
  process(inputs){
    if(inputs[0]?.length)this.dirty=this.meter.push(inputs[0])||this.dirty;
    if(this.meter.error&&!this.errorSent)this.dirty=true;
    if(this.dirty&&!this.inFlight){
      this.port.postMessage({epoch:this.epoch,...this.meter.snapshot()});this.inFlight=true;this.dirty=false;if(this.meter.error)this.errorSent=true;
    }
    return true;
  }
}
registerProcessor('visuals-loudness',VisualsLoudness);
