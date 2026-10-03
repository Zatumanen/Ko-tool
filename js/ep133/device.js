import{IDENTITY_SYSEX,TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET_PAGED,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_INFO,TE_SYSEX_FILE_MOVED,TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,TE_SYSEX_FILE_EVENT_FILE_MOVED,STATUS_OK}from './constants.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from './sysex.js';
import{metadataStringToObject,parseNullTerminatedString}from './packing.js';
import{compareFirmwareVersions}from './capabilityEvidence.js?v=20261001-1';
import{dispatchDeviceRuntimeEvent,getDeviceRuntimeSnapshot}from './deviceRuntime.js?v=20261003-1';

let input=null,output=null,identityCode=0,initialized=false,deviceInfo=null,midiAccess=null,connectingPromise=null;
let deviceUnsafe=false,deviceUnsafeReason='';
let strictFirmwareDebugDepth=0,strictFirmwareDebugLabel='guarded FILE transaction';
let firmwareDebugSequence=0,lastFirmwareDebugText='',lastFirmwareDebugAt=0;
const FIRMWARE_DEBUG_PREFLIGHT_MS=1200,FIRMWARE_DEBUG_GRACE_MS=2500;
const listeners=new Map(),pending=new Map(),connectionListeners=new Set(),fileEventListeners=new Set(),midiActivityListeners=new Set(),unexpectedFileTrafficListeners=new Set();
const recentlyExpiredRequestIds=new Map();
const LATE_RESPONSE_TTL_MS=5000;
const MIN_FIRMWARE={
  TE032AS001:{beta:'0.100.38',production:'2.0.5'},
  TE032AS005:{beta:'0.2.13',production:'1.0.2'},
  TE032AS006:{beta:'0.4.7',production:'1.0.5'}
};
function validateFirmware(sku,metadata){
  const version=String(metadata?.os_version||'');
  if(version.startsWith('0.1.0'))return;
  const minimums=MIN_FIRMWARE[sku];
  if(!minimums||!version)throw new Error('EP-series firmware version could not be verified.');
  const channel=version.startsWith('0.')?'beta':'production';
  const minimum=minimums[channel];
  if(compareFirmwareVersions(version,minimum)<0)throw new Error(`EP-series firmware ${version} is too old for ${sku}. Minimum supported version is ${minimum}.`);
}

export function parseFirmwareDebugFrame(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  if(data.length<7||data[0]!==0xF0||data[1]!==0x00||data[2]!==0x20||data[3]!==0x76||data[5]!==0x33||data.at(-1)!==0xF7)return null;
  return new TextDecoder().decode(data.slice(6,-1)).trim()||'unknown firmware debug frame';
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
  const state={
    connected:isConnected(),
    unsafe:deviceUnsafe,
    unsafeReason:deviceUnsafeReason,
    device:deviceInfo?{...deviceInfo,deviceKey:output?.id||deviceInfo.metadata?.serialNumber||deviceInfo.metadata?.serial||null}:null
  };
  for(const listener of connectionListeners){try{listener(state);}catch(error){console.warn('EP connection listener failed',error)}}
}
function notifyMidiActivity(direction,detail={}){
  for(const listener of midiActivityListeners){try{listener({direction,...detail});}catch(error){console.warn('EP MIDI activity listener failed',error)}}
}
function rememberExpiredRequest(requestId){
  const now=Date.now();
  for(const[id,expiresAt]of recentlyExpiredRequestIds)if(expiresAt<=now)recentlyExpiredRequestIds.delete(id);
  recentlyExpiredRequestIds.set(Number(requestId)||0,now+LATE_RESPONSE_TTL_MS);
}
function consumeExpiredRequest(requestId){
  const id=Number(requestId)||0,expiresAt=recentlyExpiredRequestIds.get(id)||0;
  if(!expiresAt)return false;
  recentlyExpiredRequestIds.delete(id);
  return expiresAt>Date.now();
}
function notifyUnexpectedFileTraffic(detail={}){
  const event={...detail,at:Date.now()};
  for(const listener of unexpectedFileTrafficListeners){try{listener(event);}catch(error){console.warn('EP unexpected FILE traffic listener failed',error)}}
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
  const debugText=parseFirmwareDebugFrame(data);
  if(debugText){
    firmwareDebugSequence+=1;
    lastFirmwareDebugText=debugText;
    lastFirmwareDebugAt=Date.now();
    console.warn('EP firmware/debug SysEx:',debugText);
    if(strictFirmwareDebugDepth>0){
      const reason='Firmware debug SysEx during '+strictFirmwareDebugLabel+': '+debugText;
      dispatchDeviceRuntimeEvent({type:'FIRMWARE_DEBUG_DETECTED',connectionEpoch:getDeviceRuntimeSnapshot().connection.epoch,reason});
      enterUnsafeState(reason);
    }
    return;
  }
  if(data[1]===0x7E){
    const p=pending.get(0);
    if(p?.identityWait){pending.delete(0);p.resolve({kind:'identity',data,inputPort});}
    return;
  }
  const msg=parseTeSysex(data);
  if(!msg)return;
  notifyMidiActivity('rx',{command:msg.command,requestId:msg.requestId});
  const fileEventTypes=new Set([TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,TE_SYSEX_FILE_EVENT_FILE_MOVED]);
  const eventType=msg.command===TE_SYSEX_FILE?msg.rawData?.[0]:undefined;
  if(msg.command===TE_SYSEX_FILE&&fileEventTypes.has(eventType)&&!pending.has(msg.requestId)){
    const rawData=msg.rawData.slice(1);
    let parsed=null;
    try{parsed=parseFileEvent(eventType,rawData);}catch(error){console.warn('EP file event parse failed',error);}
    if(parsed)for(const listener of fileEventListeners){try{listener({type:eventType,data:parsed,rawData,inputPort});}catch(error){console.warn('EP file event listener failed',error)}}
    return;
  }
  const p=pending.get(msg.requestId);
  if(p){
    if(p.inputPort&&p.inputPort!==inputPort)return;
    pending.delete(msg.requestId);
    p.resolve(msg);
  }else if(msg.command===TE_SYSEX_FILE&&!msg.isRequest){
    if(consumeExpiredRequest(msg.requestId))return;
    notifyUnexpectedFileTraffic({requestId:msg.requestId,status:msg.status,rawData:msg.rawData.slice(),inputPort});
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
    pending.set(0,{
      identityWait:true,
      resolve:v=>{clearTimeout(timer);pending.delete(0);resolve(v);},
      reject:error=>{clearTimeout(timer);pending.delete(0);reject(error);}
    });
  });
}

let requestQueue=Promise.resolve();
let connectionEpoch=0;

function unsafeError(){
  return new Error('EP-series FILE safety lock is active. Power-cycle the device, then reload this page before sending more FILE traffic. '+deviceUnsafeReason);
}

function enterUnsafeState(reason){
  if(deviceUnsafe)return;
  deviceUnsafe=true;
  deviceUnsafeReason=String(reason||'Unknown EP-series FILE session failure.');
  dispatchDeviceRuntimeEvent({
    type:'DEVICE_MARKED_UNSAFE',
    connectionEpoch:getDeviceRuntimeSnapshot().connection.epoch,
    reason:deviceUnsafeReason
  });
  connectionEpoch+=1;
  requestQueue=Promise.resolve();
  for(const p of pending.values()){
    try{p.reject?.(unsafeError());}catch{}
  }
  pending.clear();
  recentlyExpiredRequestIds.clear();
  notifyConnection();
}

export function isDeviceUnsafe(){return deviceUnsafe;}
export function markDeviceUnsafe(reason){enterUnsafeState(reason);}
export function isRequestTimeoutError(error){return error?.code==='EP_SERIES_TIMEOUT'||error?.name==='EPSeriesTimeoutError';}
export async function passiveFirmwareDebugPreflight(duration=FIRMWARE_DEBUG_PREFLIGHT_MS,label='guarded FILE transaction'){
  if(deviceUnsafe)throw unsafeError();
  if(!initialized||!input||!output)throw new Error('EP-series device is not connected.');
  const wait=Math.max(0,Number(duration)||0);
  const startedAt=Date.now();
  const sequence=firmwareDebugSequence;
  if(lastFirmwareDebugAt&&startedAt-lastFirmwareDebugAt<=wait){
    enterUnsafeState('Firmware debug SysEx was already active before '+String(label||'guarded FILE transaction')+': '+lastFirmwareDebugText);
    throw unsafeError();
  }
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  if(deviceUnsafe)throw unsafeError();
  if(firmwareDebugSequence!==sequence){
    enterUnsafeState('Firmware debug SysEx detected during passive preflight for '+String(label||'guarded FILE transaction')+': '+lastFirmwareDebugText);
    throw unsafeError();
  }
}

export async function withStrictFirmwareDebugGuard(operation,label='guarded FILE transaction',{preflightMs=FIRMWARE_DEBUG_PREFLIGHT_MS}={}){
  if(typeof operation!=='function')throw new TypeError('Strict firmware debug guard requires an operation.');
  const normalizedLabel=String(label||'guarded FILE transaction');
  if(strictFirmwareDebugDepth===0&&preflightMs>0)await passiveFirmwareDebugPreflight(preflightMs,normalizedLabel);
  const previousLabel=strictFirmwareDebugLabel;
  strictFirmwareDebugDepth+=1;
  strictFirmwareDebugLabel=normalizedLabel;
  try{return await operation();}
  finally{
    strictFirmwareDebugDepth=Math.max(0,strictFirmwareDebugDepth-1);
    strictFirmwareDebugLabel=previousLabel;
  }
}

export function formatDeviceRejection(response){
  const status=Number(response?.status);
  const raw=response?.rawData instanceof Uint8Array?response.rawData:new Uint8Array(response?.rawData||[]);
  const reason=raw.length?parseNullTerminatedString(raw,0).trim():'';
  return reason
    ? `EP-series device returned status ${status}: ${reason}`
    : `EP-series device returned status ${status}`;
}

async function sendRequest(command,payload=new Uint8Array(),timeout=2000){
  if(deviceUnsafe)throw unsafeError();
  const epoch=connectionEpoch;
  const task=requestQueue.then(async()=>{
    if(deviceUnsafe)throw unsafeError();
    if(epoch!==connectionEpoch||!output||!input)throw new Error('EP-series device is not connected.');
    const frame=buildTeSysex(command,payload,identityCode,output.id);
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finishReject=error=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        pending.delete(frame.id);
        reject(error);
      };
      const finishResolve=value=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        pending.delete(frame.id);
        resolve(value);
      };
      const timer=setTimeout(async()=>{
        const error=new Error(`EP-series request timeout (command ${command})`);
        error.name='EPSeriesTimeoutError';
        error.code='EP_SERIES_TIMEOUT';
        rememberExpiredRequest(frame.id);
        if(strictFirmwareDebugDepth>0){
          pending.delete(frame.id);
          const sequence=firmwareDebugSequence;
          await new Promise(resolve=>setTimeout(resolve,FIRMWARE_DEBUG_GRACE_MS));
          if(settled)return;
          if(deviceUnsafe){
            finishReject(unsafeError());
            return;
          }
          if(firmwareDebugSequence!==sequence){
            enterUnsafeState('Firmware debug SysEx started after request timeout during '+strictFirmwareDebugLabel+': '+lastFirmwareDebugText);
            finishReject(unsafeError());
            return;
          }
        }
        finishReject(error);
      },timeout);
      pending.set(frame.id,{
        inputPort:input,
        reject:finishReject,
        resolve:v=>{
          if(v.status!==STATUS_OK)finishReject(new Error(formatDeviceRejection(v)));
          else finishResolve(v);
        }
      });
      try{
        notifyMidiActivity('tx',{command,requestId:frame.id});
        output.send(frame.bytes);
      }catch(error){
        finishReject(error);
      }
    });
  });
  requestQueue=task.catch(()=>{});
  return task;
}

export async function connectEp133(){
  if(deviceUnsafe)throw unsafeError();
  if(initialized){
    if(input?.state==='connected'&&output?.state==='connected')return{sku:deviceInfo?.sku,metadata:deviceInfo?.metadata,input,output};
    disconnectEp133();
  }
  if(connectingPromise)return connectingPromise;
  dispatchDeviceRuntimeEvent({type:'CONNECT_STARTED'});
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
    if(deviceUnsafe)throw unsafeError();
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
  identityCode=found.parsed.midiId;
  const greet=await sendRequest(TE_SYSEX_GREET);
  if(!greet||greet.status!==STATUS_OK)throw new Error('EP-series GREET failed.');
  identityCode=greet.identityCode;
  const metadata=metadataStringToObject(new TextDecoder().decode(greet.rawData));
  const baseSku=String(metadata?.base_sku||'').toUpperCase();
  const effectiveSku=isSupportedEpSku(baseSku)?baseSku:found.parsed.sku;
  validateFirmware(effectiveSku,metadata);
  initialized=true;
  deviceInfo={sku:effectiveSku,identitySku:found.parsed.sku,baseSku:baseSku||null,metadata};
  connectionEpoch+=1;
  dispatchDeviceRuntimeEvent({type:'DEVICE_CONNECTED',connectionEpoch,device:{
    sku:effectiveSku,
    firmware:String(metadata?.os_version||metadata?.sw_version||''),
    deviceKey:output?.id||null,
    identityVerified:true
  }});
  notifyConnection();
  return{...deviceInfo,input,output};
  })();
  try{return await connectingPromise;}
  catch(error){
    const runtimeEpoch=getDeviceRuntimeSnapshot().connection.epoch;
    dispatchDeviceRuntimeEvent({type:'DEVICE_DISCONNECTED',connectionEpoch:runtimeEpoch,reason:String(error?.message||error)});
    throw error;
  }
  finally{connectingPromise=null;}
}

export function disconnectEp133(){
  const runtimeEpoch=getDeviceRuntimeSnapshot().connection.epoch;
  dispatchDeviceRuntimeEvent({type:'DEVICE_DISCONNECTED',connectionEpoch:runtimeEpoch,reason:'Disconnected'});
  connectionEpoch+=1;
  requestQueue=Promise.resolve();
  stopListeners();
  for(const p of pending.values())p.reject?.(new Error('Disconnected'));
  pending.clear();
  recentlyExpiredRequestIds.clear();
  input=null;output=null;initialized=false;identityCode=0;deviceInfo=null;
  notifyConnection();
}

export function isConnected(){return !deviceUnsafe&&initialized&&!!input&&!!output;}

const READ_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_INFO]);
const WRITE_SUBCOMMANDS=new Set([TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_MOVED]);

export function requestRead(command,payload=new Uint8Array(),timeout=2000){
  if(command!==TE_SYSEX_FILE)return Promise.reject(new Error(`EP-series read-only command rejected: ${command}`));
  const subcommand=payload[0];
  if(!READ_SUBCOMMANDS.has(subcommand))return Promise.reject(new Error(`EP-series read-only FILE subcommand rejected: ${subcommand}`));
  if(subcommand===TE_SYSEX_FILE_METADATA&&payload[1]!==TE_SYSEX_FILE_METADATA_GET)return Promise.reject(new Error(`EP-series read-only METADATA subcommand rejected: ${payload[1]}`));
  return sendRequest(command,payload,timeout);
}

export function requestFile(command,payload=new Uint8Array(),timeout=2000){
  if(command!==TE_SYSEX_FILE)return Promise.reject(new Error(`EP-series FILE command rejected: ${command}`));
  const subcommand=payload[0];
  if(!WRITE_SUBCOMMANDS.has(subcommand))return Promise.reject(new Error(`EP-series unsupported FILE subcommand: ${subcommand}`));
  if(subcommand===TE_SYSEX_FILE_METADATA&&payload[1]!==TE_SYSEX_FILE_METADATA_SET&&payload[1]!==TE_SYSEX_FILE_METADATA_SET_PAGED)return Promise.reject(new Error(`EP-series write METADATA subcommand rejected: ${payload[1]}`));
  return sendRequest(command,payload,timeout);
}

export function getMidiPorts(){return{input,output};}
export function getConnectedDeviceInfo(){
  if(!deviceInfo)return null;
  return{
    sku:deviceInfo.sku,
    identitySku:deviceInfo.identitySku,
    baseSku:deviceInfo.baseSku,
    metadata:{...(deviceInfo.metadata||{})}
  };
}
export function getDeviceSessionToken(){
  if(!isConnected())return null;
  const serial=deviceInfo?.metadata?.serialNumber||deviceInfo?.metadata?.serial||'';
  return [connectionEpoch,output?.id||'',input?.id||'',deviceInfo?.sku||'',serial].join(':');
}

export function onFileEvent(listener){
  if(typeof listener!=='function')return()=>{};
  fileEventListeners.add(listener);
  return()=>fileEventListeners.delete(listener);
}
export function waitForFileEvent(predicate,{timeout=500}={}){
  if(typeof predicate!=='function')return Promise.resolve(null);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      fileEventListeners.delete(listener);
      resolve(value);
    };
    const listener=event=>{
      let matches=false;
      try{matches=!!predicate(event);}catch(error){console.warn('EP file event predicate failed',error)}
      if(matches)finish(event);
    };
    const timer=setTimeout(()=>finish(null),Math.max(0,Number(timeout)||0));
    fileEventListeners.add(listener);
  });
}

export function onMidiActivity(listener){
  if(typeof listener!=='function')return()=>{};
  midiActivityListeners.add(listener);
  return()=>midiActivityListeners.delete(listener);
}
export function onUnexpectedFileTraffic(listener){
  if(typeof listener!=='function')return()=>{};
  unexpectedFileTrafficListeners.add(listener);
  return()=>unexpectedFileTrafficListeners.delete(listener);
}

export function onConnectionChange(listener){
  if(typeof listener!=='function')return()=>{};
  connectionListeners.add(listener);
  try{listener({connected:isConnected(),unsafe:deviceUnsafe,unsafeReason:deviceUnsafeReason,device:deviceInfo});}catch(error){console.warn('EP connection listener failed',error)}
  return()=>connectionListeners.delete(listener);
}
