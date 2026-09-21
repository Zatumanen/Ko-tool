export function unpackInPlace(packedBytes){
  let writeIndex=0,msbIndex=0,bitIndex=0,readIndex=1;
  let msbByte=packedBytes[0]??0;
  while(readIndex<packedBytes.length){
    const msb=(msbByte&(1<<bitIndex)?1:0)<<7;
    packedBytes[writeIndex++]=msb|(packedBytes[readIndex++]&0x7f);
    bitIndex++;
    if(bitIndex>6){
      readIndex++;
      bitIndex=0;
      msbIndex+=8;
      msbByte=packedBytes[msbIndex]??0;
    }
  }
  return packedBytes.subarray(0,writeIndex);
}
export function packToBuffer(data,out){
  let outIndex=1,msbIndex=0;
  for(let i=0;i<data.length;i++){
    const pos=i%7;
    out[msbIndex]|=(data[i]>>7)<<pos;
    out[outIndex++]=data[i]&0x7f;
    if(pos===6&&i<data.length-1){msbIndex+=8;outIndex++;}
  }
}
export function packedLength(n){return n+n?Math.ceil(n/7):0}
export function parseNullTerminatedString(buffer,start){
  let end=start;
  while(end<buffer.length&&buffer[end]!==0)end++;
  return new TextDecoder().decode(buffer.subarray(start,end));
}
export function metadataStringToObject(s){
  const out={};
  for(const entry of s.split(';')){const i=entry.indexOf(':');if(i>0)out[entry.slice(0,i)]=entry.slice(i+1);}
  return out;
}
