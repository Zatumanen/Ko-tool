import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,waitFor}from './helpers/fake-ep-midi.mjs';
import{
  TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_INFO,
  TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET_PAGED
}from '../js/ep133/constants.js';

test('device transport executes real queue, timeout, disconnect and debug safety behavior',async t=>{
  let mode='normal',releaseFirst=null,held=false;
  const enc=new TextEncoder();
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const subcommand=request.rawData[0];

      if(mode==='serialize'){
        if(!held){
          held=true;
          return new Promise(resolve=>{
            releaseFirst=()=>resolve({payload:new Uint8Array()});
          });
        }
        return{};
      }

      if(mode==='reject'&&subcommand===TE_SYSEX_FILE_INFO){
        return{status:3,payload:enc.encode('invalid id\0')};
      }

      if(mode==='timeout'&&subcommand===TE_SYSEX_FILE_LIST)return{drop:true};
      if(mode==='late'&&subcommand===TE_SYSEX_FILE_INFO)return{delay:40};

      if(mode==='hold')return new Promise(()=>{});

      if(mode==='debug'){
        return{drop:true,debug:'err lfs 6327'};
      }

      return{};
    }
  });
  fake.install();
  const device=await import('../js/ep133/device.js?behavior-device=20260929');
  const unexpectedTraffic=[];
  const stopUnexpectedTraffic=device.onUnexpectedFileTraffic(event=>unexpectedTraffic.push(event));

  await t.test('connects through fake Web MIDI using the real identity and GREET path',async()=>{
    const connected=await device.connectEp133();
    assert.equal(connected.sku,'TE032AS006');
    assert.equal(connected.metadata.os_version,'2.5.1');
    assert.equal(device.isConnected(),true);
    assert.deepEqual(fake.midiAccessRequests,[{sysex:true}]);
    const greet=fake.requests.find(request=>request.command===TE_SYSEX_GREET);
    assert.equal(greet?.identityCode,0x3c);
  });

  await t.test('serializes requests so the second SysEx is not sent before the first resolves',async()=>{
    mode='serialize';
    held=false;
    releaseFirst=null;
    const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
    const first=device.requestRead(
      TE_SYSEX_FILE,
      Uint8Array.from([TE_SYSEX_FILE_LIST,0,0,0,0]),
      200
    );
    const second=device.requestRead(
      TE_SYSEX_FILE,
      Uint8Array.from([TE_SYSEX_FILE_INFO,0,1]),
      200
    );

    await waitFor(()=>fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length===before+1);
    assert.equal(
      fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length,
      before+1
    );

    releaseFirst();
    await first;
    await second;
    assert.equal(
      fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length,
      before+2
    );
    mode='normal';
  });

  await t.test('turns a nonzero firmware status into the device rejection error',async()=>{
    mode='reject';
    await assert.rejects(
      device.requestRead(
        TE_SYSEX_FILE,
        Uint8Array.from([TE_SYSEX_FILE_INFO,0,7]),
        200
      ),
      /EP-series device returned status 3: invalid id/
    );
    assert.equal(device.isDeviceUnsafe(),false);
    mode='normal';
  });

  await t.test('a plain read timeout rejects but does not poison the device session',async()=>{
    mode='timeout';
    await assert.rejects(
      device.requestRead(
        TE_SYSEX_FILE,
        Uint8Array.from([TE_SYSEX_FILE_LIST,0,0,0,0]),
        20
      ),
      error=>error?.name==='EPSeriesTimeoutError'&&error?.code==='EP_SERIES_TIMEOUT'
    );
    assert.equal(device.isDeviceUnsafe(),false);

    mode='normal';
    await device.requestRead(
      TE_SYSEX_FILE,
      Uint8Array.from([TE_SYSEX_FILE_INFO,0,7]),
      200
    );
  });

  await t.test('late response to our own timed-out request is not reported as external FILE traffic',async()=>{
    const before=unexpectedTraffic.length;
    mode='late';
    await assert.rejects(
      device.requestRead(
        TE_SYSEX_FILE,
        Uint8Array.from([TE_SYSEX_FILE_INFO,0,7]),
        10
      ),
      error=>error?.name==='EPSeriesTimeoutError'
    );
    await new Promise(resolve=>setTimeout(resolve,70));
    assert.equal(unexpectedTraffic.length,before);
    assert.equal(device.isDeviceUnsafe(),false);
    mode='normal';
  });

  await t.test('unmatched FILE response is surfaced as possible external-tool traffic',async()=>{
    const before=unexpectedTraffic.length;
    fake.emitResponse({requestId:0x6aa,command:TE_SYSEX_FILE,payload:new Uint8Array()});
    await waitFor(()=>unexpectedTraffic.length===before+1);
    assert.equal(unexpectedTraffic.at(-1)?.requestId,0x6aa);
    assert.equal(device.isDeviceUnsafe(),false);
  });

  await t.test('disconnect invalidates the in-flight request and prevents the queued request from being sent',async()=>{
    mode='hold';
    const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
    const first=device.requestRead(
      TE_SYSEX_FILE,
      Uint8Array.from([TE_SYSEX_FILE_INFO,0,1]),
      500
    );
    const second=device.requestRead(
      TE_SYSEX_FILE,
      Uint8Array.from([TE_SYSEX_FILE_INFO,0,2]),
      500
    );

    await waitFor(()=>fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length===before+1);
    fake.disconnect();

    await assert.rejects(first,/Disconnected|not connected/);
    await assert.rejects(second,/Disconnected|not connected/);
    assert.equal(
      fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length,
      before+1
    );

    mode='normal';
    fake.reconnect();
    const connected=await device.connectEp133();
    assert.equal(connected.sku,'TE032AS006');
    assert.equal(device.isConnected(),true);
  });

  await t.test('read and write gates reject the opposite METADATA operation before sending it',async()=>{
    const before=fake.requests.length;
    await assert.rejects(
      device.requestRead(TE_SYSEX_FILE,Uint8Array.from([TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,0,7])),
      /read-only METADATA subcommand rejected/
    );
    await assert.rejects(
      device.requestRead(TE_SYSEX_FILE,Uint8Array.from([TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET_PAGED,0,0])),
      /read-only METADATA subcommand rejected/
    );
    await assert.rejects(
      device.requestFile(TE_SYSEX_FILE,Uint8Array.from([TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_GET,0,7,0,0])),
      /write METADATA subcommand rejected/
    );
    assert.equal(fake.requests.length,before);
  });

  await t.test('firmware debug SysEx inside a strict transaction enters the fail-closed unsafe state',async()=>{
    mode='debug';
    await assert.rejects(
      device.withStrictFirmwareDebugGuard(
        ()=>device.requestRead(
          TE_SYSEX_FILE,
          Uint8Array.from([TE_SYSEX_FILE_INFO,0,9]),
          100
        ),
        'behavioral debug test',
        {preflightMs:0}
      ),
      /FILE safety lock is active/
    );
    assert.equal(device.isDeviceUnsafe(),true);

    await assert.rejects(
      device.requestRead(
        TE_SYSEX_FILE,
        Uint8Array.from([TE_SYSEX_FILE_INFO,0,10]),
        100
      ),
      /FILE safety lock is active/
    );
  });

  stopUnexpectedTraffic();
  device.disconnectEp133();
  fake.restore();
});
