import{pathToFileURL}from 'node:url';
import{loadGoldenFixture}from './ep-file-golden-fixtures.mjs';
import{createFakeEpMidi,importFilesystemPair}from './fake-ep-midi.mjs';
import{TE_SYSEX_FILE}from '../../js/ep133/constants.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
const fromHex=value=>{
  const hex=String(value||'');
  if(!hex.length||hex.length%2!==0||!/^[0-9a-f]+$/i.test(hex))throw new Error('Golden runtime transport payloadHex is invalid.');
  return Uint8Array.from(Buffer.from(hex,'hex'));
};

const fixturePath=process.argv[2];
if(!fixturePath)throw new Error('Golden runtime runner requires a fixture path.');
const fixture=await loadGoldenFixture(pathToFileURL(fixturePath));
const transport=fixture.expectations?.transport;
if(!transport||typeof transport!=='object')throw new Error('Golden runtime fixture is missing transport expectations.');

const fake=createFakeEpMidi({
  onRequest:request=>{
    if(request.command!==TE_SYSEX_FILE)return{};
    if(transport.operation==='put-stream'){
      const raw=request.rawData;
      if(raw[0]===1)return{payload:Uint8Array.from([0,0,0,2,0])};
      if(raw[0]===2&&raw[1]===0)return{payload:Uint8Array.from([0,7])};
      if(raw[0]===2&&raw[1]===1&&transport.action==='disconnect-on-put-data'){
        return{drop:true,disconnect:true,disconnectDelay:0};
      }
      return{};
    }
    if(transport.action==='drop')return{drop:true};
    if(transport.action==='delay')return{payload:new Uint8Array(),delay:Number(transport.delayMs)||0};
    if(transport.action==='debug')return{
      drop:true,
      debug:String(transport.debug||'err'),
      debugDelay:Number(transport.debugDelayMs)||0
    };
    return{};
  }
});

fake.install();
let device=null;
try{
  const pair=await importFilesystemPair();
  device=pair.device;
  pair.filesystem.resetFileSystemState();
  const fileTransport=await import(`../../js/ep133/fileTransport.js?v=${pair.token}`);
  const{getDeviceRuntimeSnapshot}=await import('../../js/ep133/deviceRuntime.js');

  await device.connectEp133();

  let operationError=null;
  try{
    if(transport.operation==='raw-read'){
      await fileTransport.withFileTransportTransaction(
        'golden runtime '+fixture.id,
        ()=>device.requestRead(
          TE_SYSEX_FILE,
          fromHex(transport.payloadHex),
          Number(transport.timeoutMs)||50
        ),
        {strict:transport.strict===true}
      );
    }else if(transport.operation==='put-stream'){
      const put=transport.put||{};
      await fileTransport.putFile({
        data:fromHex(put.dataHex),
        filename:String(put.filename||'golden.wav'),
        parentId:Number(put.parentId),
        destinationId:Number(put.destinationId),
        timeout:Number(transport.timeoutMs)||100
      });
    }else{
      throw new Error('Unsupported golden runtime transport operation '+String(transport.operation));
    }
  }catch(error){
    operationError=error;
  }

  if(!operationError)throw new Error('Golden failure scenario unexpectedly completed without an error.');
  await sleep(transport.settleMs);

  const snapshot=getDeviceRuntimeSnapshot();
  process.stdout.write(JSON.stringify({
    fixtureId:fixture.id,
    status:snapshot.status,
    safety:snapshot.safety.status,
    directRuntimeDispatch:false,
    errorName:String(operationError?.name||'Error'),
    errorCode:operationError?.code||null
  }));
}finally{
  try{if(device?.isConnected?.())device.disconnectEp133();}catch{}
  fake.restore();
}
