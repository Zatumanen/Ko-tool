import{IDENTITY_SYSEX,TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_INFO,TE_SYSEX_FILE_MOVED,TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,TE_SYSEX_FILE_EVENT_FILE_MOVED,STATUS_OK}from './constants.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from './sysex.js';
import{metadataStringToObject,parseNullTerminatedString}from './packing.js';

let input=null,output=null,identityCode=0,initialized=false,deviceInfo=null,midiAccess=null,connectingPromise=null;
const listeners=new Map(),pending=new Map(),connectionListeners=new Set(),fileEventListeners=new Set();
const MIN_FIRMWARE={
  TE032AS001:{beta:'0.100.38',production:'2.0.5'},
  TE032AS005:{beta:'0.2.13',production:'1.0.2'},
  TE032AS006:{beta:'0.4.7',production:'1.0.5'}
};
function compareVersion(a,b){const pa=String(a||'').split('.').map(Number),pb=String(b||'').split('.').map(Number);for(let i=0;i<3;i++){const x=Number.isFinite(pa[i])?pa[i]:0,y=Number.isFinite(pb[i])?pb[i]:0;if(x!==y)return x-y;}return 0;}
function validateFirmware(sku,metadata){
  const version=String(metadata?.os_version||'');
  if(version.startsWith('0.1.0'))return;
  const minimums=MIN_FIRMWARE[sku];
  if(!minimums||!version)throw new Error('EP-series firmware version could not be verified.');
  const channel=version.startsWith('0.')?'beta':'production';
  const minimum=minimums[channel];
  if(compareVersion(version,minimum)<0)throw new Error(`EP-series firmware ${version} is too old for ${sku}. Minimum supported version is ${minimum}.`);
}

const eventU16=(data,offset)=>(data[offset]<<8)|data[offset+1];
const eventU32=(data,offset)=>((data[offset]<<24)|(data[offset+1]<<16)|(data[offset+2]<<8)|data[offset+3])>>>0;
export function parseFileEvent(type,data=new Uint8Array()){
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  switch(type){
    case TE_SYSEX_FILE_EVENT_FILE_ADDED:
    case TE_SYSEX_FILE_EVENT_FILE_UPDATED:
      if(bytes.length<8)throw new Error('Invalid EP-series FILE_ADDED/UPDATED event.');
      return{nodeId:eventU16(bytes,0),parentId:eventU16(bytes,2),fileSize:eventU32(bytes,4),name:parseNullTerminatedString(bytes,8)};
    case TE_SYSEX_FILE_EVENT_FILE_DELETED:
      if(bytes.length<2)throw new Error('Invalid EP-series FILE_DELETED event.');
      return{nodeId:eventU16(bytes,0)};
    case TE_SYSEX_FILE_EVENT_METADATA_UPDATED:{
      if(bytes.length<3)throw new Error('Invalid EP-series METADATA_UPDATED event.');
      const json=parseNullTerminatedString(bytes,2);
      return{nodeId:eventU16(bytes,0),metadata:JSON.parse(json)};
    }
    case TE_SYSEX_FILE_EVENT_FILE_MOVED:
      if(bytes.length<6)throw new Error('Invalid EP-series FILE_MOVED event.');
      return{oldNodeId:eventU16(bytes,0),parentId:eventU16(bytes,2),nodeId:eventU16(bytes,4)};
    default:return null;
  }
}

function notifyConnection(){
  const state={connected:isConnected(),device:deviceInfo?{...deviceInfo,deviceKey:output?.id||deviceInfo.metadata?.serialNumber||deviceInfo.metadata?.serial||null}:null};
  for(const listener of connectionListeners){try{listener(state);}catch{}}
}

function handleMidiStateChange(){
  if(initialized){
    if(input?.state==='disconnected'||output?.state==='disconnected')disconnectEp133();
    return;
  }
  if(connectingPromise)return;
  const ports=[...(midiAccess?.inputs?.values?.()||[]),...(midiAccess?.outputs?.values?.()||[])];
  if(!ports.some(port=>port.state==='connected'))return;
  connectEp133().catch(()=>{});
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
  const fileEventTypes=new Set([TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,TE_SYSEX_FILE_EVENT_FILE_MOVED]);
  const eventType=msg.command===TE_SYSEX_FILE?msg.rawData?.[0]:undefined;
  if(msg.command===TE_SYSEX_FILE&&fileEventTypes.has(eventType)&&!pending.has(msg.requestId)){
    const rawData=msg.rawData.slice(1);
    let parsed=null;
    try{parsed=parseFileEvent(eventType,rawData);}catch(error){console.warn('EP file event parse failed',error);}
    if(parsed)for(const listener of fileEventListeners){try{listener({type:eventType,data:parsed,rawData,inputPort});}catch{}}
    return;
  }
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
  const metadata=metadataStringToObject(new TextDecoder().decode(greet.rawData));
  validateFirmware(found.parsed.sku,metadata);
  initialized=true;
  deviceInfo={sku:found.parsed.sku,metadata};
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

const READ_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_INFO]);
const WRITE_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_MOVED]);

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

export function onFileEvent(listener){
  if(typeof listener!=='function')return()=>{};
  fileEventListeners.add(listener);
  return()=>fileEventListeners.delete(listener);
}

export function onConnectionChange(listener){
  if(typeof listener!=='function')return()=>{};
  connectionListeners.add(listener);
  try{listener({connected:isConnected(),device:deviceInfo});}catch{}
  return()=>connectionListeners.delete(listener);
}
