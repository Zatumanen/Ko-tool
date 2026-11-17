export function xyPoints(data,mode='stereo'){
  if(!['stereo','artistic'].includes(mode))throw Error('Unknown XY mode');
  if(mode==='stereo'&&data.channelCount!==2)return null;
  const left=mode==='stereo'?data.leftTime:data.time,right=mode==='stereo'?data.rightTime:data.time;
  const delay=mode==='artistic'?Math.max(1,Math.round(data.sampleRate*.0017)):0;
  const count=Math.min(left?.length||0,right?.length||0),points=[];
  for(let i=delay;i<count;i++){
    const x=left[i],y=right[i-delay];
    // Break a trace at invalid samples; never connect across a missing measurement.
    points.push(Number.isFinite(x)&&Number.isFinite(y)?[Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y))]:null);
  }
  return points;
}
export function createPhosphorHistory(){
  let history=[];
  return{
    reset(){history=[];},
    add(points,time){
      if(!Number.isFinite(time))throw Error('Invalid XY timestamp');
      if(history.length&&time<history.at(-1).time)history=[];
      const frame={time,points:points.map(p=>p&&[...p])};
      if(history.length&&Math.floor(history.at(-1).time/(1000/30))===Math.floor(time/(1000/30)))history[history.length-1]=frame;
      else history.push(frame);
      while(history.length>16||time-history[0].time>400)history.shift();
    },
    frames(time){
      history=history.filter(f=>time>=f.time&&time-f.time<=400);
      return history.map(f=>({points:f.points,alpha:Math.exp(-(time-f.time)/90)}));
    }
  };
}
