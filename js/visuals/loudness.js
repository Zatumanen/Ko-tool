// Independently authored BS.1770-5 Annex1 mono/stereo implementation.
// Published digital48k coefficients; bilinear inverse/forward mapping for other rates.
export function kWeightingCoefficients(rate){
  if(![16000,22050,24000,32000,44100,48000,88200,96000,176400,192000].includes(rate))throw Error('Unsupported LUFS sample rate');
  const stages=[
    {b:[1.53512485958697,-2.69169618940638,1.19839281085285],a:[1,-1.69065929318241,.73248077421585]},
    {b:[1,-2,1],a:[1,-1.99004745483398,.99007225036621]}
  ];
  if(rate===48000)return stages;
  const remap=p=>{
    const r=rate/48000,c0=p[0]+p[1]+p[2],c1=2*(p[0]-p[2])*r,c2=(p[0]-p[1]+p[2])*r*r;
    return[c0+c1+c2,2*c0-2*c2,c0-c1+c2];
  };
  return stages.map(s=>{const b=remap(s.b),a=remap(s.a);return{b:b.map(v=>v/a[0]),a:a.map(v=>v/a[0])};});
}
const toLU=energy=>energy>0?-.691+10*Math.log10(energy):-Infinity;
function filter({a,b}){
  let x1=0,x2=0,y1=0,y2=0;
  return x=>{const y=b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
export function createLoudnessMeter(rate,channels){
  if(![1,2].includes(channels))throw Error('LUFS requires known mono or stereo');
  const coefficients=kWeightingCoefficients(rate),hop=rate/10,maxSamples=rate*14400;
  let filters,energies,partial,n,samples,bins,absSum,absCount,error;
  function reset(){
    filters=Array.from({length:channels},()=>coefficients.map(filter));energies=[];partial=0;n=0;samples=0;
    bins=Array.from({length:121},()=>({values:[],sum:0}));absSum=0;absCount=0;error=null;
  }
  reset();
  function integrated(){
    if(energies.length<4)return null;if(!absCount)return-Infinity;
    const threshold=Math.max(-70,toLU(absSum/absCount)-10),cut=10**((threshold+.691)/10);
    let sum=0,count=0;
    for(let i=0;i<bins.length;i++){
      const bucket=bins[i];
      if(i-70>threshold){sum+=bucket.sum;count+=bucket.values.length;}
      else if(i===120||i-69>threshold)for(const value of bucket.values)if(value>cut){sum+=value;count++;}
    }
    return count?toLU(sum/count):-Infinity;
  }
  return{
    reset,
    get error(){return error;},
    push(planes){
      if(error)return false;
      if(planes.length!==channels||!planes.every(p=>p.length===planes[0].length)){error='LUFS channel mismatch';return false;}
      let changed=false;
      for(let i=0;i<planes[0].length;i++){
        if(samples>=maxSamples){error='LUFS session limit: reset after4hours';break;}
        let energy=0;
        for(let c=0;c<channels;c++){
          let value=planes[c][i];if(!Number.isFinite(value)){error='Invalid LUFS PCM';return false;}
          for(const stage of filters[c])value=stage(value);energy+=value*value;
        }
        if(!Number.isFinite(energy)){error='Invalid LUFS energy';return false;}
        partial+=energy;n++;samples++;
        if(n===hop){
          energies.push(partial/n);if(energies.length>30)energies.shift();n=0;partial=0;changed=true;
          if(energies.length>=4){
            const mean=energies.slice(-4).reduce((a,b)=>a+b,0)/4,lu=toLU(mean);
            if(lu>-70){const bucket=bins[Math.max(0,Math.min(120,Math.floor(lu+70)))];bucket.values.push(mean);bucket.sum+=mean;absSum+=mean;absCount++;}
          }
        }
      }
      return changed;
    },
    snapshot(){
      const mean=count=>energies.length<count?null:toLU(energies.slice(-count).reduce((a,b)=>a+b,0)/count);
      return{momentary:error?null:mean(4),shortTerm:error?null:mean(30),integrated:error?null:integrated(),seconds:samples/rate,error};
    }
  };
}
