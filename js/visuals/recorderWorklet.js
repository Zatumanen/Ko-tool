import{createPcmRecorder}from './recorderPcm.js';
class VisualsRecorder extends AudioWorkletProcessor{
  constructor(options){
    super();this.levelFrames=0;this.levelInFlight=false;this.disposed=false;
    this.recorder=createPcmRecorder({...options.processorOptions,sampleRate},packet=>this.port.postMessage(packet,packet.bytes instanceof ArrayBuffer?[packet.bytes]:[]));
    this.port.onmessage=event=>{
      const m=event.data;
      if(m.dispose){this.disposed=true;this.port.onmessage=null;this.port.close();return;}
      if(m.ack!==undefined)this.recorder.ack(m.ack);
      else if(m.levelsAck)this.levelInFlight=false;
      else this.recorder.command(m.command,m.commandId);
    };
  }
  process(inputs){
    if(this.disposed)return false;
    if(inputs[0]?.length){this.recorder.push(inputs[0]);this.levelFrames+=inputs[0][0].length;}
    if(!this.levelInFlight&&this.levelFrames>=sampleRate/10&&['recording','paused'].includes(this.recorder.state)){
      this.levelFrames=0;this.levelInFlight=true;this.port.postMessage({type:'levels',...this.recorder.levels()});
    }
    return!['done','limited','interrupted'].includes(this.recorder.state);
  }
}
registerProcessor('visuals-recorder',VisualsRecorder);
