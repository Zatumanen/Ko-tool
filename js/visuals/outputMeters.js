// Selected-input sample peaks only: no RMS, interpolation or True Peak estimate.
export const peakDb=value=>value>0?20*Math.log10(value):-Infinity;
export function createOutputMeters(sampleRate){
  if(!Number.isFinite(sampleRate)||sampleRate<1000||sampleRate>384000)throw Error('Invalid sample rate');
  const decay=Math.pow(10,-20/(20*sampleRate));
  let clock,channelCount,status,pending,hold,until,clip;
  function reset(){clock=0;channelCount=0;status='pending';pending=[0,0];hold=[0,0];until=[0,0];clip=[false,false];}
  reset();
  return{reset,
    push(channels){
      if(status==='invalid')return;
      const n=channels?.length,length=channels?.[0]?.length;
      if((n!==1&&n!==2)||!length||(channelCount&&n!==channelCount)||channels.some(c=>c.length!==length)){status='invalid';return;}
      channelCount=n;status='ready';
      for(let i=0;i<length;i++){
        clock++;
        for(let c=0;c<n;c++){
          const value=Math.abs(channels[c][i]);
          if(!Number.isFinite(value)){status='invalid';return;}
          if(clock>until[c])hold[c]*=decay;
          if(value>=hold[c]&&value>0){hold[c]=value;until[c]=clock+sampleRate;}
          pending[c]=Math.max(pending[c],value);
          if(value>=1)clip[c]=true;
        }
      }
    },
    take(){
      const visible=values=>[values[0],channelCount===2?values[1]:null];
      const state={status,channelCount,peak:visible(pending),hold:visible(hold),clip:visible(clip)};
      pending[0]=0;pending[1]=0;return state;
    }
  };
}
