import{IDENTITY_SYSEX,TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_DELETE,STATUS_OK}from './constants.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from './sysex.js';
import{metadataStringToObject}from './packing.js';

let input=null,output=null,identityCode=0,initialized=false,deviceInfo=null,midiAccess=null,connectingPromise=null;
const listeners=new Map(),pending=new Map(),connectionListeners=new Set();

function notifyConnection(){
  const state={connected:isConnected(),device:deviceInfo?{...deviceInfo,deviceKey:output?.id||deviceInfo.metadata?.serialNumber||deviceInfo.metadata?.serial||null}:null};
  for(const listener of connectionListeners){try{listener(state);}catch{}}
}

function handleMidiStateChange(){
  if(!initialized)return;
  if(input?.state==='disconnected'||output?.state==='disconnected')disconnectEp133();
}

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
  if(p){
    if(p.inputPort&&p.inputPort!==inputPort)return;
    pending.delete(msg.requestId);
    p.resolve(msg);
  }
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

let requestQueue=Promise.resolve();
let connectionEpoch=0;

async function sendRequest(command,payload=new Uint8Array(),timeout=20000){
  const epoch=connectionEpoch;
  const task=requestQueue.then(async()=>{
    if(epoch!==connectionEpoch||!output||!input)throw new Error('EP-series device is not connected.');
    const frame=buildTeSysex(command,payload,identityCode,output.id);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(frame.id);reject(new Error(`EP-series request timeout (command ${command})`));},timeout);
      pending.set(frame.id,{inputPort:input,resolve:v=>{clearTimeout(timer);if(v.status!==STATUS_OK)reject(new Error(`EP-series device returned status ${v.status}`));else resolve(v);}});
      try{output.send(frame.bytes);}catch(error){clearTimeout(timer);pending.delete(frame.id);reject(error);}
    });
  });
  requestQueue=task.catch(()=>{});
  return task;
}

export async function connectEp133(){
  if(initialized){
    if(input?.state==='connected'&&output?.state==='connected')return{sku:deviceInfo?.sku,metadata:deviceInfo?.metadata,input,output};
    disconnectEp133();
  }
  if(connectingPromise)return connectingPromise;
  connectingPromise=(async()=>{
  if(!navigator.requestMIDIAccess)throw new Error('Web MIDI is not supported by this browser.');
  const access=midiAccess||await navigator.requestMIDIAccess({sysex:true});
  midiAccess=access;
  midiAccess.onstatechange=handleMidiStateChange;
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
        if(parsed&&isSupportedEpSku(parsed.sku)){found={out,parsed,input:identity.inputPort};break;}
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
  deviceInfo={sku:found.parsed.sku,metadata:metadataStringToObject(new TextDecoder().decode(greet.rawData))};
  notifyConnection();
  return{...deviceInfo,input,output};
  })();
  try{return await connectingPromise;}finally{connectingPromise=null;}
}

export function disconnectEp133(){
  connectionEpoch+=1;
  requestQueue=Promise.resolve();
  stopListeners();
  for(const p of pending.values())p.reject?.(new Error('Disconnected'));
  pending.clear();
  input=null;output=null;initialized=false;identityCode=0;deviceInfo=null;
  notifyConnection();
}

export function isConnected(){return initialized&&!!input&&!!output;}

const READ_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_METADATA]);
const WRITE_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_PLAYBACK]);

export function requestRead(command,payload=new Uint8Array(),timeout=5000){
  if(command!==TE_SYSEX_FILE)return Promise.reject(new Error(`EP-series read-only command rejected: ${command}`));
  const subcommand=payload[0];
  if(!READ_SUBCOMMANDS.has(subcommand))return Promise.reject(new Error(`EP-series read-only FILE subcommand rejected: ${subcommand}`));
  return sendRequest(command,payload,timeout);
}

export function requestFile(command,payload=new Uint8Array(),timeout=20000){
  if(command!==TE_SYSEX_FILE)return Promise.reject(new Error(`EP-series FILE command rejected: ${command}`));
  const subcommand=payload[0];
  if(!WRITE_SUBCOMMANDS.has(subcommand))return Promise.reject(new Error(`EP-series unsupported FILE subcommand: ${subcommand}`));
  return sendRequest(command,payload,timeout);
}

export function getMidiPorts(){return{input,output};}

export function onConnectionChange(listener){
  if(typeof listener!=='function')return()=>{};
  connectionListeners.add(listener);
  try{listener({connected:isConnected(),device:deviceInfo});}catch{}
  return()=>connectionListeners.delete(listener);
}
