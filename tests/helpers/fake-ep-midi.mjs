import fs from 'node:fs/promises';
import{packedLength,packToBuffer}from '../../js/ep133/packing.js';
import{parseTeSysex}from '../../js/ep133/sysex.js';
import{
  MIDI_SYSEX_START,MIDI_SYSEX_END,TE_MIDI_ID,MIDI_SYSEX_TE,
  IDENTITY_SYSEX,TE_SYSEX_GREET,BIT_REQUEST_ID_AVAILABLE
}from '../../js/ep133/constants.js';

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const sameBytes=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function waitFor(predicate,{timeout=500,interval=1}={}){
  const deadline=Date.now()+timeout;
  for(;;){
    if(predicate())return;
    if(Date.now()>=deadline)throw new Error('Timed out waiting for fake EP condition.');
    await wait(interval);
  }
}

function identityResponseForSku(sku){
  const match=String(sku||'').match(/^TE(\d{3})AS(\d{3})$/);
  if(!match)throw new Error('Fake EP requires a TE###AS### SKU.');
  const product=Number(match[1]),assembly=Number(match[2]);
  return Uint8Array.from([
    0xf0,0x7e,0x00,0x06,0x02,...TE_MIDI_ID,
    product&0x7f,(product>>7)&0x7f,
    assembly&0x7f,(assembly>>7)&0x7f,
    0,0,0,0,0xf7
  ]);
}

function responseFrame(request,{identityCode,status=0,payload=new Uint8Array()}={}){
  const raw=bytes(payload);
  const packedSize=packedLength(raw.length);
  const frame=new Uint8Array(11+packedSize);
  frame.set([
    MIDI_SYSEX_START,...TE_MIDI_ID,identityCode,MIDI_SYSEX_TE,
    BIT_REQUEST_ID_AVAILABLE|((request.requestId>>7)&0x1f),
    request.requestId&0x7f,request.command,status&0x7f
  ],0);
  if(packedSize)packToBuffer(raw,frame.subarray(10,10+packedSize));
  frame[frame.length-1]=MIDI_SYSEX_END;
  return frame;
}

function debugFrame(text,identityCode){
  const data=new TextEncoder().encode(String(text||'err'));
  return Uint8Array.from([
    MIDI_SYSEX_START,...TE_MIDI_ID,identityCode,0x33,...data,MIDI_SYSEX_END
  ]);
}

class FakeMidiInput{
  constructor(id='fake-ep-input'){
    this.id=id;
    this.type='input';
    this.state='connected';
    this.connection='open';
    this.listeners=new Set();
  }
  addEventListener(type,listener){if(type==='midimessage')this.listeners.add(listener);}
  removeEventListener(type,listener){if(type==='midimessage')this.listeners.delete(listener);}
  emit(data){
    const event={data:bytes(data)};
    for(const listener of [...this.listeners])listener(event);
  }
}

class FakeMidiOutput{
  constructor(onSend,id='fake-ep-output'){
    this.id=id;
    this.type='output';
    this.state='connected';
    this.connection='open';
    this.sent=[];
    this.onSend=onSend;
  }
  send(data){
    const copy=bytes(data).slice();
    this.sent.push(copy);
    this.onSend(copy);
  }
}

export function createFakeEpMidi({
  sku='TE032AS006',
  osVersion='2.5.1',
  serial='FAKE-EP-0001',
  identityCode=0x33,
  onRequest=null
}={}){
  const input=new FakeMidiInput();
  const requests=[];
  const midiAccessRequests=[];
  let access=null;
  let navigatorDescriptor=null;
  let installed=false;

  const emitLater=(data,delay=0)=>{
    if(delay>0)setTimeout(()=>input.emit(data),delay);
    else queueMicrotask(()=>input.emit(data));
  };

  const handleRequest=async request=>{
    if(request.command===TE_SYSEX_GREET){
      const payload=new TextEncoder().encode(
        `base_sku:${sku};os_version:${osVersion};serial:${serial};`
      );
      emitLater(responseFrame(request,{identityCode,payload}));
      return;
    }
    const descriptor=onRequest?await onRequest(request,{
      input,
      output,
      access,
      requests,
      identityCode
    }):null;
    const action=descriptor||{};
    if(action.debug)emitLater(debugFrame(action.debug,identityCode),action.debugDelay||0);
    if(action.disconnect)setTimeout(()=>disconnect(),Math.max(0,Number(action.disconnectDelay)||0));
    if(action.drop)return;
    emitLater(responseFrame(request,{
      identityCode,
      status:Number(action.status)||0,
      payload:action.payload||new Uint8Array()
    }),Math.max(0,Number(action.delay)||0));
  };

  const output=new FakeMidiOutput(data=>{
    if(sameBytes(data,IDENTITY_SYSEX)){
      emitLater(identityResponseForSku(sku));
      return;
    }
    const request=parseTeSysex(data);
    if(!request||!request.isRequest)throw new Error('Fake EP received an invalid TE SysEx request.');
    requests.push({
      ...request,
      rawData:request.rawData.slice(),
      wire:data.slice()
    });
    handleRequest(request).catch(error=>queueMicrotask(()=>{throw error;}));
  });

  access={
    inputs:new Map([[input.id,input]]),
    outputs:new Map([[output.id,output]]),
    onstatechange:null
  };

  function install(){
    if(installed)return;
    installed=true;
    navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
    Object.defineProperty(globalThis,'navigator',{
      configurable:true,
      writable:true,
      value:{
        requestMIDIAccess:async options=>{
          midiAccessRequests.push(options);
          return access;
        }
      }
    });
  }

  function restore(){
    if(!installed)return;
    installed=false;
    if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);
    else delete globalThis.navigator;
  }

  function disconnect(){
    input.state='disconnected';
    output.state='disconnected';
    access.onstatechange?.({port:input});
  }

  function reconnect(){
    input.state='connected';
    output.state='connected';
  }

  return{
    input,output,access,requests,midiAccessRequests,
    install,restore,disconnect,reconnect
  };
}

export async function importFilesystemPair(){
  const source=await fs.readFile(new URL('../../js/ep133/filesystem.js',import.meta.url),'utf8');
  const token=source.match(/\.\/device\.js\?v=([^'"]+)/)?.[1];
  if(!token)throw new Error('Could not resolve the filesystem/device release token.');
  const [device,filesystem]=await Promise.all([
    import(`../../js/ep133/device.js?v=${token}`),
    import('../../js/ep133/filesystem.js')
  ]);
  return{device,filesystem,token};
}
