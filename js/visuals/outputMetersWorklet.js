import{createOutputMeters}from './outputMeters.js';
class VisualsOutputMeters extends AudioWorkletProcessor{
  constructor(){
    super();this.meters=createOutputMeters(sampleRate);this.frames=0;this.inFlight=false;this.epoch=0;
    this.port.onmessage=event=>{
      if(event.data?.reset){this.meters.reset();this.frames=0;this.inFlight=false;this.epoch=event.data.epoch??this.epoch;}
      else if(event.data?.ack)this.inFlight=false;
    };
  }
  process(inputs){
    const channels=inputs[0];if(!channels?.length)return true;
    this.meters.push(channels);this.frames+=channels[0].length;
    // ACK bounds the main-thread queue. Pending maxima/CLIP continue accumulating.
    if(!this.inFlight&&this.frames>=sampleRate/30){
      this.frames=0;this.inFlight=true;this.port.postMessage({...this.meters.take(),epoch:this.epoch});
    }
    return true;
  }
}
registerProcessor('visuals-output-meters',VisualsOutputMeters);
