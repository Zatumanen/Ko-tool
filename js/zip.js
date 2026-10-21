function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function u16(v){const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,v,true);return a;}function u32(v){const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,v>>>0,true);return a;}function cat(parts){let n=parts.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n),i=0;for(const p of parts){o.set(p,i);i+=p.length;}return o;}
function text(s){return new TextEncoder().encode(s);}
/**
 * Deflate is optional. Legacy SpeedUpperCut archives remain byte-for-byte
 * stored ZIPs; only explicit official .pak export requests DEFLATE (method 8).
 */
export async function createZip(files,{compression='store'}={}){
  if(!['store','deflate'].includes(compression))throw new Error('Unsupported ZIP compression.');
  if(files.length>65535)throw new Error('ZIP64 entry counts are unsupported.');
  if(compression==='deflate'){
    try{new CompressionStream('deflate-raw');}
    catch{throw new Error('This browser does not support ZIP/Deflate export.');}
  }
  const locals=[],central=[];
  let offset=0;
  for(const file of files){
    const name=text(file.path.replace(/\\/g,'/'));
    const data=new Uint8Array(await file.blob.arrayBuffer());
    const crc=crc32(data);
    let encoded=data;
    if(compression==='deflate'){
      const stream=new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      encoded=new Uint8Array(await new Response(stream).arrayBuffer());
    }
    const method=compression==='deflate'?8:0;
    const flags=0x800; // UTF-8; known sizes and CRC, no descriptor
    const local=cat([u32(0x04034b50),u16(20),u16(flags),u16(method),u16(0),u16(0),
      u32(crc),u32(encoded.length),u32(data.length),u16(name.length),u16(0),name,encoded]);
    locals.push(local);
    const cd=cat([u32(0x02014b50),u16(20),u16(20),u16(flags),u16(method),u16(0),u16(0),
      u32(crc),u32(encoded.length),u32(data.length),u16(name.length),u16(0),
      u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    central.push(cd);offset+=local.length;
    if(offset>0xffffffff)throw new Error('ZIP64 file size is unsupported.');
  }
  const centralBytes=cat(central),localBytes=cat(locals);
  const end=cat([u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),
    u32(centralBytes.length),u32(localBytes.length),u16(0)]);
  return new Blob([localBytes,centralBytes,end],{type:'application/zip'});
}
