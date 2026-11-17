// Bounded sampled FFT history. No interpolation across absent measurements.
export function createSpectrogramHistory(){
  let frames=[],rate=0,last=-Infinity;
  const reset=()=>{frames=[];rate=0;last=-Infinity;};
  return{
    reset,get size(){return frames.length;},
    push(values,sampleRate,time){
      if(!(values instanceof Uint8Array)||values.length!==1024||!Number.isFinite(sampleRate)||sampleRate<1000||!Number.isFinite(time)||time<last)throw Error('Invalid spectrogram frame');
      if(rate&&rate!==sampleRate)reset();rate=sampleRate;last=time;
      const frame={values:values.slice(),time,rows:null,height:0};
      // Multiple repaints within one30Hz time bucket do not grow the queue.
      if(frames.length&&Math.floor(frames.at(-1).time/ (1000/30))===Math.floor(time/(1000/30)))frames[frames.length-1]=frame;
      else frames.push(frame);
      while(frames.length>512||(frames.length&&time-frames[0].time>16000))frames.shift();
    },
    raster(width,height,now){
      if(!Number.isFinite(now)||!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Invalid spectrogram dimensions');
      const seconds=Math.min(16,Math.max(4,width/40)),w=Math.min(512,Math.max(1,Math.round(width))),h=Math.min(128,Math.max(1,Math.round(height)));
      const values=new Uint8Array(w*h),step=rate/2048,upper=Math.min(20000,1023*step);
      let index=-1;
      for(let x=0;x<w;x++){
        const at=now-(w-1-x)/w*seconds*1000;
        while(index+1<frames.length&&frames[index+1].time<=at)index++;
        const frame=frames[index];if(!frame||at-frame.time>=100)continue;
        if(frame.height!==h){
          frame.height=h;frame.rows=new Uint8Array(h);
          for(let y=0;y<h;y++){
            const lo=20*(upper/20)**((h-1-y)/h),hi=20*(upper/20)**((h-y)/h);
            const start=Math.max(1,Math.floor(lo/step)),end=Math.min(1023,Math.max(start,Math.ceil(hi/step)));
            for(let k=start;k<=end;k++)frame.rows[y]=Math.max(frame.rows[y],frame.values[k]);
          }
        }
        for(let y=0;y<h;y++)values[y*w+x]=frame.rows[y];
      }
      return{values,width:w,height:h,seconds,upperHz:upper};
    }
  };
}
