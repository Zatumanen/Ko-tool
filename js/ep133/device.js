import{IDENTITY_SYSEX,TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,STATUS_OK}from './constants.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from './sysex.js';
import{metadataStringToObject}from './packing.js';

let input=null,output=null,identityCode=0,initialized=false;
const listeners=new Map(),pending=new Map();

function onMessage(inputPort,event){
  const data=new Uint8Array(event.data||[]);
  if(data[0]!==0xF0)return;
  if(data[1]===0x7E){
    const p=pending.get(0);
    if(p?.identityWait){pending.delete(0);p.resolve({kind:'identity',data,inputPort});}
    return;
  }
  const msg=parseTeSysex(data);
  if(!msg)return;
  const p=pending.get(msg.requestId);
  if(p){pending.delete(msg.requestId);p.resolve(msg);}
}

function stopListeners(){
  for(const[port,fn]of listeners)port.removeEventListener('midimessage',fn);
  listeners.clear();
}

function startListeners(inputs){
  stopListeners();
  for(const port of inputs){
    const fn=e=>onMessage(port,e);
    port.addEventListener('midimessage',fn);
    listeners.set(port,fn);
  }
}

function waitForIdentity(timeout=2000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(0);reject(new Error('EP-series identity timeout'));},timeout);
    pending.set(0,{identityWait:true,resolve:v=>{clearTimeout(timer);resolve(v);}});
  });
}

async function sendRequest(command,payload=new Uint8Array(),timeout=20000){
  if(!output||!input)throw new Error('EP-series device is not connected.');
  const frame=buildTeSysex(command,payload,identityCode,output.id);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(frame.id);reject(new Error(`EP-series request timeout (command ${command})`));},timeout);
    pending.set(frame.id,{resolve:v=>{
      clearTimeout(timer);
      if(v.status!==STATUS_OK)reject(new Error(`EP-series device returned status ${v.status}`));
      else resolve(v);
    }});
    try{output.send(frame.bytes);}
    catch(error){clearTimeout(timer);pending.delete(frame.id);reject(error);}
  });
}

export async function connectEp133(){
  if(!navigator.requestMIDIAccess)throw new Error('Web MIDI is not supported by this browser.');
  const access=await navigator.requestMIDIAccess({sysex:true});
  const inputs=[...access.inputs.values()];
  const outputs=[...access.outputs.values()];
  if(!outputs.length||!inputs.length)throw new Error('No MIDI ports found. Connect an EP-series device by USB and try again.');

  startListeners(inputs);
  let found=null;
  for(const out of outputs){
    try{
      const identityPromise=waitForIdentity();
      out.send(IDENTITY_SYSEX);
      const identity=await Promise.race([identityPromise,new Promise(r=>setTimeout(()=>r(null),2200))]);
      if(identity){
        const parsed=parseIdentityResponse(identity.data);
        if(parsed&&isSupportedEpSku(parsed.sku)){
          found={out,parsed,input:identity.inputPort};
          break;
        }
      }
    }catch{}
  }

  if(!found){
    stopListeners();
    throw new Error('Supported EP-series device was not found on the available MIDI ports. Supported models: EP-133 (64/128 MB), EP-40, EP-1320.');
  }

  output=found.out;
  input=found.input;
  const greet=await sendRequest(TE_SYSEX_GREET);
  if(!greet||greet.status!==STATUS_OK)throw new Error('EP-series GREET failed.');
  identityCode=greet.identityCode;
  initialized=true;
  return{sku:found.parsed.sku,metadata:metadataStringToObject(new TextDecoder().decode(greet.rawData)),input,output};
}

export function disconnectEp133(){
  stopListeners();
  for(const p of pending.values())p.reject?.(new Error('Disconnected'));
  pending.clear();
  input=null;
  output=null;
  initialized=false;
}

export function isConnected(){return initialized&&!!input&&!!output;}

export function requestRead(command,payload=new Uint8Array(),timeout=5000){
  if(command!==TE_SYSEX_FILE)return Promise.reject(new Error(`EP-series read-only command rejected: ${command}`));
  const subcommand=payload[0];
  if(subcommand!==TE_SYSEX_FILE_INIT&&subcommand!==TE_SYSEX_FILE_LIST&&subcommand!==TE_SYSEX_FILE_GET){
    return Promise.reject(new Error(`EP-series read-only FILE subcommand rejected: ${subcommand}`));
  }
  return sendRequest(command,payload,timeout);
}

export function getMidiPorts(){return{input,output};}
