import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{
  TE_SYSEX_FILE,
  TE_SYSEX_FILE_INIT,
  TE_SYSEX_FILE_PUT,
  TE_SYSEX_FILE_PUT_TYPE_INIT,
  TE_SYSEX_FILE_PUT_TYPE_DATA,
  TE_SYSEX_FILE_GET,
  TE_SYSEX_FILE_GET_TYPE_INIT,
  TE_SYSEX_FILE_GET_TYPE_DATA,
  TE_SYSEX_FILE_CAPABILITY_READ
}from '../js/ep133/constants.js';

const u16=(data,offset)=>(data[offset]<<8)|data[offset+1];
const u32=(data,offset)=>((data[offset]<<24)|(data[offset+1]<<16)|(data[offset+2]<<8)|data[offset+3])>>>0;
const be16=value=>Uint8Array.from([(value>>8)&0xff,value&0xff]);
const initResponse=chunkSize=>{
  const data=new Uint8Array(5);
  new DataView(data.buffer).setUint32(1,chunkSize);
  return data;
};
const concat=parts=>{
  const size=parts.reduce((sum,part)=>sum+part.length,0);
  const out=new Uint8Array(size);
  let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}
  return out;
};

test('filesystem executes real multi-page PUT/EOF/GET behavior and fails closed on interrupted PUT',async t=>{
  const files=new Map();
  const putTransactions=[];
  const getDataPageSize=7;
  const chunkSize=48;
  let currentPut=null;
  let mode='normal';

  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const raw=request.rawData;
      const subcommand=raw[0];

      if(subcommand===TE_SYSEX_FILE_INIT){
        return{payload:initResponse(chunkSize)};
      }

      if(subcommand===TE_SYSEX_FILE_PUT&&raw[1]===TE_SYSEX_FILE_PUT_TYPE_INIT){
        const destinationId=u16(raw,3);
        currentPut={
          destinationId,
          parentId:u16(raw,5),
          declaredSize:u32(raw,7),
          pages:[],
          eofPage:null
        };
        putTransactions.push(currentPut);
        return{payload:be16(destinationId)};
      }

      if(subcommand===TE_SYSEX_FILE_PUT&&raw[1]===TE_SYSEX_FILE_PUT_TYPE_DATA){
        const page=u16(raw,2);
        const data=raw.slice(4);
        currentPut?.pages.push({page,data:data.slice()});

        if(mode==='interrupt-put'&&page===1)return{drop:true};

        if(data.length===0&&currentPut){
          currentPut.eofPage=page;
          const payload=concat(currentPut.pages.filter(item=>item.data.length).map(item=>item.data));
          files.set(currentPut.destinationId,{
            data:payload,
            name:'behavior',
            flags:TE_SYSEX_FILE_CAPABILITY_READ
          });
        }
        return{};
      }

      if(subcommand===TE_SYSEX_FILE_GET&&raw[1]===TE_SYSEX_FILE_GET_TYPE_INIT){
        const nodeId=u16(raw,2);
        const file=files.get(nodeId);
        if(!file)return{status:3,payload:new TextEncoder().encode('invalid id\0')};
        const name=new TextEncoder().encode(file.name);
        const payload=new Uint8Array(8+name.length);
        const view=new DataView(payload.buffer);
        view.setUint16(0,nodeId);
        payload[2]=file.flags;
        view.setUint32(3,file.data.length);
        payload.set(name,7);
        payload[7+name.length]=0;
        return{payload};
      }

      if(subcommand===TE_SYSEX_FILE_GET&&raw[1]===TE_SYSEX_FILE_GET_TYPE_DATA){
        const page=u16(raw,2);
        const file=files.values().next().value;
        const start=page*getDataPageSize;
        const chunk=file.data.slice(start,start+getDataPageSize);
        const payload=new Uint8Array(2+chunk.length);
        new DataView(payload.buffer).setUint16(0,page);
        payload.set(chunk,2);
        return{payload};
      }

      return{};
    }
  });

  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  await t.test('PUT sends contiguous data pages plus the required empty EOF page',async()=>{
    const source=Uint8Array.from({length:41},(_,index)=>(index*29+7)&0xff);
    const fileId=await filesystem.putFile({
      data:source,
      filename:'behavior',
      parentId:42,
      destinationId:7,
      timeout:200,
      capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]
    });

    assert.equal(fileId,7);
    assert.equal(putTransactions.length,1);
    const tx=putTransactions[0];
    assert.equal(tx.declaredSize,source.length);
    assert.ok(tx.pages.length>=2);
    assert.equal(tx.pages.at(-1).data.length,0);
    assert.equal(tx.eofPage,tx.pages.length-1);
    assert.deepEqual(tx.pages.map(item=>item.page),tx.pages.map((_,index)=>index));

    const stored=files.get(7);
    assert.deepEqual([...stored.data],[...source]);
  });

  await t.test('GET stops exactly at the declared size and reconstructs the stored bytes',async()=>{
    const expected=files.get(7).data;
    const result=await filesystem.getFile(7);
    assert.equal(result.name,'behavior');
    assert.equal(result.size,expected.length);
    assert.deepEqual([...result.data],[...expected]);
    assert.equal(device.isDeviceUnsafe(),false);
  });

  await t.test('an interrupted PUT after stream open activates the filesystem safety lock',async()=>{
    mode='interrupt-put';
    const source=Uint8Array.from({length:60},(_,index)=>(index*11)&0xff);

    await assert.rejects(
      filesystem.putFile({
        data:source,
        filename:'interrupted',
        parentId:42,
        destinationId:8,
        timeout:25,
        capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]
      }),
      error=>error?.name==='EPSeriesTimeoutError'||/timeout/i.test(String(error?.message||error))
    );

    assert.equal(device.isDeviceUnsafe(),true);
    await assert.rejects(
      filesystem.getFile(7),
      /FILE safety lock is active/
    );
  });

  device.disconnectEp133();
  fake.restore();
});
