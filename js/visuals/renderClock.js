const RATES=[60,30,15],WINDOW=2000;
// Drawing-budget heuristics, not measured host CPU/RAM acceptance thresholds.
export function createRenderClock({initialFps=60}={}){
  if(!RATES.includes(initialFps))throw Error('Unsupported Canvas rate');
  let fps=initialFps,sampleDue=null,paintDue=null,last=null,start=null,cost=0,paints=0,gaps=0,gapCount=0,stable=0;
  function suspend(){sampleDue=null;paintDue=null;last=null;start=null;cost=0;paints=0;gaps=0;gapCount=0;stable=0;}
  const advance=(due,period,time)=>due+(Math.floor((time+.5-due)/period)+1)*period;
  return{
    get fps(){return fps},suspend,
    reset(){fps=initialFps;suspend();},
    recordPaint(ms){if(Number.isFinite(ms)&&ms>=0){cost+=ms;paints++;}},
    step(time){
      if(!Number.isFinite(time))throw Error('Invalid render time');
      if(last!==null&&(time<last||time-last>500))suspend();
      if(start===null){start=time;sampleDue=time;paintDue=time;}
      if(last!==null&&time>last){gaps+=time-last;gapCount++;}last=time;
      if(time-start>=WINDOW){
        const index=RATES.indexOf(fps),mean=paints?cost/paints:0,gap=gapCount?gaps/gapCount:Infinity;
        if(index<2&&(mean>1000/fps*.65||gap>1000/fps*1.8)){fps=RATES[index+1];stable=0;paintDue=time;}
        else if(index>0&&paints&&mean<1000/RATES[index-1]*.4&&gap<1000/RATES[index-1]*1.3){
          if(++stable>=3){fps=RATES[index-1];stable=0;paintDue=time;}
        }else stable=0;
        start=time;cost=0;paints=0;gaps=0;gapCount=0;
      }
      const sample=time+.5>=sampleDue,paint=time+.5>=paintDue;
      if(sample)sampleDue=advance(sampleDue,1000/30,time);
      if(paint)paintDue=advance(paintDue,1000/fps,time);
      return{sample,paint,fps};
    }
  };
}
export function rectVisible(rect,clip,width,height){
  return Math.max(rect.left,clip.left,0)<Math.min(rect.right,clip.right,width)&&Math.max(rect.top,clip.top,0)<Math.min(rect.bottom,clip.bottom,height);
}
