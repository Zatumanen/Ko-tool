// Display-only rotated vectors; no audio processing or pan/Mid-Side output.
export function stereoAnalysis(left,right,channels){
  const unavailable=status=>({status,correlation:null,balance:null});
  if(channels===1)return unavailable('mono');
  if(channels!==2)return unavailable('invalid');
  if(!left?.length||left.length!==right?.length)return unavailable('invalid');
  let dot=0,l2=0,r2=0;
  for(let i=0;i<left.length;i++){
    const l=left[i],r=right[i];if(!Number.isFinite(l)||!Number.isFinite(r))return unavailable('invalid');
    dot+=l*r;l2+=l*l;r2+=r*r;
  }
  if(!Number.isFinite(dot+l2+r2))return unavailable('invalid');
  if(l2+r2===0)return unavailable('silence');
  const l=Math.sqrt(l2),r=Math.sqrt(r2);
  return{status:'stereo',correlation:l2&&r2?Math.max(-1,Math.min(1,dot/(l*r))):null,balance:(r-l)/(r+l)};
}
export function createPlasmaDensity(){
  const density=new Float32Array(4096),counts=new Float32Array(4096);let last=null;
  return{
    reset(){density.fill(0);last=null;},
    update(points,time){
      if(!Number.isFinite(time))throw Error('Invalid plasma timestamp');
      if(last!==null&&time<last){density.fill(0);last=null;}
      const fade=last===null?0:Math.exp(-(time-last)/180);last=time;counts.fill(0);
      const add=(x,y,weight)=>{if(!Number.isFinite(x+y+weight)||Math.abs(x)+Math.abs(y)<1e-8)return;const col=Math.max(0,Math.min(63,Math.round((x+1)*31.5))),row=Math.max(0,Math.min(63,Math.round((1-y)*31.5)));counts[row*64+col]+=weight;};
      if(points instanceof Float32Array)for(let i=0;i<points.length;i+=3)add(points[i],points[i+1],points[i+2]);
      else for(const [x,y]of points)add(x,y,1/Math.max(1,points.length));
      for(let i=0;i<4096;i++)density[i]=density[i]*fade+Math.min(1,Math.sqrt(counts[i]*128))*(1-fade);
      return density.slice();
    }
  };
}
export function plasmaRaster(density,size){
  if(size===64)return density;
  if(size!==32||density.length!==4096)throw Error('Invalid plasma raster');
  return Float32Array.from({length:1024},(_,i)=>{const y=Math.floor(i/32)*2,x=(i%32)*2,k=y*64+x;return Math.max(density[k],density[k+1],density[k+64],density[k+65]);});
}

// Independent Hann-windowed stereo FFT projection. Radius encodes frequency,
// ellipse encodes L/R phase and relative amplitude; brightness encodes band energy.
export function createSpectralPlasma(){
  const n=2048,window=Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n));
  const cos=Float64Array.from({length:n/2},(_,i)=>Math.cos(-2*Math.PI*i/n)),sin=Float64Array.from({length:n/2},(_,i)=>Math.sin(-2*Math.PI*i/n));
  const lr=new Float64Array(n),li=new Float64Array(n),rr=new Float64Array(n),ri=new Float64Array(n),energy=new Float64Array(n/2);
  const output=new Float32Array(n/2*16*3),phases=Array.from({length:16},(_,i)=>[Math.cos(2*Math.PI*i/16),Math.sin(2*Math.PI*i/16)]);
  function fft(input,re,im){
    for(let i=0;i<n;i++){re[i]=input[i]*window[i];im[i]=0;}
    for(let i=1,j=0;i<n;i++){
      let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
      if(i<j){const value=re[i];re[i]=re[j];re[j]=value;}
    }
    for(let length=2;length<=n;length*=2)for(let start=0;start<n;start+=length)for(let j=0;j<length/2;j++){
      const a=start+j,b=a+length/2,k=j*n/length,tr=re[b]*cos[k]-im[b]*sin[k],ti=re[b]*sin[k]+im[b]*cos[k],ar=re[a],ai=im[a];
      re[a]=ar+tr;im[a]=ai+ti;re[b]=ar-tr;im[b]=ai-ti;
    }
  }
  return{
    project(left,right,rate){
      if(left.length!==n||right.length!==n||!Number.isFinite(rate)||rate<1000)throw Error('Invalid spectral plasma input');
      fft(left,lr,li);fft(right,rr,ri);
      const upper=Math.min(20000,rate/2),first=Math.max(1,Math.ceil(20*n/rate)),last=Math.min(n/2-1,Math.floor(upper*n/rate));
      let total=0,maximum=0,count=0;
      for(let k=first;k<=last;k++){energy[k]=lr[k]**2+li[k]**2+rr[k]**2+ri[k]**2;total+=energy[k];maximum=Math.max(maximum,energy[k]);}
      if(!Number.isFinite(total)||total<1e-16)return output.subarray(0,0);
      for(let k=first;k<=last;k++){
        if(energy[k]<maximum*1e-8)continue;
        const amplitude=Math.max(Math.hypot(lr[k],li[k]),Math.hypot(rr[k],ri[k]));if(!amplitude)continue;
        const radius=.1+.9*(1-Math.log(k*rate/n/20)/Math.log(upper/20)),weight=energy[k]/total/16;
        for(const [c,s]of phases){
          const l=(lr[k]*c-li[k]*s)/amplitude,r=(rr[k]*c-ri[k]*s)/amplitude;
          output[count++]=(r-l)*radius/2;output[count++]=(r+l)*radius/2;output[count++]=weight;
        }
      }
      return output.subarray(0,count);
    }
  };
}
