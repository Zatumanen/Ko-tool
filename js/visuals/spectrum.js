// Display projection of Web Audio FFT magnitudes, not an equalizer or calibrated SPL.
export function spectrumCurve(bins,sampleRate,count=256){
  if(!Number.isFinite(sampleRate)||sampleRate<1000||!bins?.length||!Number.isInteger(count)||count<2||count>4096)throw Error('Invalid spectrum data');
  const spacing=sampleRate/(bins.length*2),upper=Math.min(20000,(bins.length-1)*spacing),lower=20;
  if(upper<=lower)throw Error('Insufficient spectrum bandwidth');
  const finite=x=>Number.isFinite(x)?Math.max(-100,Math.min(0,x)):-100;
  return Array.from({length:count},(_,i)=>{
    const hz=lower*(upper/lower)**(i/(count-1));
    const next=lower*(upper/lower)**(Math.min(count-1,i+.5)/(count-1));
    const previous=lower*(upper/lower)**(Math.max(0,i-.5)/(count-1));
    const at=hz/spacing,a=Math.floor(at),fraction=at-a;
    let db=finite(bins[a])*(1-fraction)+finite(bins[Math.min(bins.length-1,a+1)])*fraction;
    // Include every bin covered by this pixel band so narrow tones cannot disappear.
    for(let k=Math.max(1,Math.ceil(previous/spacing));k<=Math.min(bins.length-1,Math.floor(next/spacing));k++)db=Math.max(db,finite(bins[k]));
    return{hz,db};
  });
}
export function createSpectrumSmoother(){
  let values=null,last=null;
  return{
    reset(){values=null;last=null;},
    update(points,timeMs){
      if(!Number.isFinite(timeMs))throw Error('Invalid spectrum timestamp');
      if(!values||values.length!==points.length||timeMs<last||values.some((v,i)=>v.hz!==points[i].hz))values=points.map(p=>({...p}));
      else{
        const dt=(timeMs-last)/1000;
        values=points.map((p,i)=>({hz:p.hz,db:values[i].db+(p.db-values[i].db)*(1-Math.exp(-dt/(p.db>values[i].db ? .04 : .3)))}));
      }
      last=timeMs;return values.map(p=>({...p}));
    }
  };
}
