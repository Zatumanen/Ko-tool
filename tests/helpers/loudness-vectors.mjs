export function loudnessVector({rate,channels,segments}){
 const length=segments.reduce((sum,s)=>sum+Math.round(rate*s.seconds),0),planes=Array.from({length:channels},()=>new Float32Array(length));
 let offset=0,state=123456789;
 for(const segment of segments){
  const frames=Math.round(rate*segment.seconds);
  for(let i=0;i<frames;i++){
   state^=state<<13;state^=state>>>17;state^=state<<5;
   const signal=segment.noise?((state>>>0)/2147483648-1):Math.sin(2*Math.PI*(segment.hz||997)*(offset+i)/rate);
   for(let c=0;c<channels;c++)planes[c][offset+i]=signal*(Array.isArray(segment.amplitude)?segment.amplitude[c]:segment.amplitude);
  }
  offset+=frames;
 }
 return planes;
}
export function interleave(planes){
 const values=new Float32Array(planes[0].length*planes.length);for(let i=0;i<planes[0].length;i++)for(let c=0;c<planes.length;c++)values[i*planes.length+c]=planes[c][i];return values;
}
