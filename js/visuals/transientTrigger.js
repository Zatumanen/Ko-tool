// Min/max columns retain short impulses instead of skipping PCM between pixels.
export function waveformEnvelope(samples,width){
  const n=Math.max(1,Math.min(samples.length,Math.floor(width)));
  return Array.from({length:n},(_,i)=>{
    let min=Infinity,max=-Infinity;
    for(let j=Math.floor(i*samples.length/n);j<Math.floor((i+1)*samples.length/n);j++){min=Math.min(min,samples[j]);max=Math.max(max,samples[j]);}
    return[min,max];
  });
}
// Sample-clock attack capture. Rendering and message delivery cannot change hold time.
export function createTransientTrigger(sampleRate, initial={}) {
  if(!Number.isFinite(sampleRate)||sampleRate<1000||sampleRate>384000)throw Error('Invalid sample rate');
  let settings={threshold:.1,timeMs:200,holdMs:200},samples,tail=0,cursor=0,clock=0,nextAllowed=0,armed=true,count=0;
  function configure(next={}){
    const s={...settings,...next};
    for(const [key,min,max] of [['threshold',.001,1],['timeMs',10,1000],['holdMs',0,3000]])
      if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error('Invalid trigger '+key);
    settings=s;tail=Math.max(1,Math.round(sampleRate*s.timeMs/2000));samples=new Float32Array(tail*2);
    cursor=0;clock=0;nextAllowed=0;armed=true;count=0;
  }
  configure(initial);
  return{
    configure,
    push(block){
      let changed=false;
      for(const raw of block){
        const value=Number.isFinite(raw)?raw:0,level=Math.abs(value);
        if(level<settings.threshold*.5)armed=true;
        if(!cursor&&armed&&level>=settings.threshold&&clock>=nextAllowed){
          samples=new Float32Array(tail*2);cursor=tail;armed=false;count++;
          nextAllowed=clock+Math.max(tail,Math.round(sampleRate*settings.holdMs/1000));
        }
        if(cursor){samples[cursor++]=value;changed=true;if(cursor===samples.length)cursor=0;}
        clock++;
      }
      return changed;
    },
    snapshot:()=>({samples:samples.slice(),count,collecting:cursor!==0,timeMs:settings.timeMs})
  };
}
