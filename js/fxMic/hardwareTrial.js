import{createLiveSession}from './liveSession.js';
import{createSerialTransport}from './serialTransport.js';

// The 1.0.8 stock reference shows fx.param; this is a manual trial, not an
// accepted production profile. The guide for 1.1.2 does not establish writes.
const cutoffRule={min:0,max:1,step:.01};
const profiles={
 '1.0.8':{model:'EP-2350',firmware:'1.0.8',evidenceId:'reference-only-stock-1.0.8',
  manualTrial:true,parameters:{LOWPASS:{cutoff:cutoffRule}}},
 '1.1.2':{model:'EP-2350',firmware:'1.1.2',evidenceId:'diagnostics-only-stock-1.1.2',
  manualTrial:true,parameters:{}}
};

export function createHardwareTrial({makeTransport=createSerialTransport,onChange=()=>{}}={}){
 let session=null,phase='idle',original=null,target=null,restorePending=false,busy=false;
 const snapshot=()=>({...(session?.snapshot()??{state:'disconnected',identity:null,current:null}),
  phase,original,target,restorePending,busy,hasSession:Boolean(session)});

 async function connect(firmware,{allowReplInterrupt=false}={}){
  if(session||restorePending||busy)throw Error('Disconnect and resolve any pending restoration first');
  if(!Object.hasOwn(profiles,firmware))throw Error('Unsupported stock firmware');
  const profile=profiles[firmware],transport=makeTransport({probeProfile:profile,allowReplInterrupt});
  const active=createLiveSession({transport,timeoutMs:60000,verifyBeforeWrite:true,onChange:()=>{if(session===active)onChange();},
   resolveProfile:identity=>identity.model===profile.model&&identity.firmware===firmware?profile:null});
  session=active;busy=true;phase='idle';original=target=null;
  try{
   const{current,identity}=await active.connect();
   if(session!==active)return;
   const row=current.list[0],value=row?.cutoff,rounded=Math.round(value*100);
   if(firmware==='1.0.8'&&identity.firmwareVerified!==false&&!current.hasModulation&&current.list.length===1&&row?.effect==='LOWPASS'&&Math.abs(value*100-rounded)<1e-7){
    original=value;target=(rounded>=50?rounded-5:rounded+5)/100;
   }
   phase='read';
  }finally{if(session===active)busy=false;}
  return snapshot();
 }

 async function apply(confirmed){
  if(!session||original===null)throw Error('Write unavailable for this firmware or preset');
  if(!confirmed)throw Error('Confirm the backup and test preset before applying');
  if(busy||phase!=='read')throw Error('Only one change is allowed per trial');
  const active=session;
  busy=true;phase='applying';
  try{
   await active.setParameter({row:0,param:'cutoff',value:target},{beforeSend:()=>{restorePending=true;}});
   if(session===active)phase='changed';
  }catch(error){
   if(session===active)phase='uncertain';
   throw error;
  }finally{if(session===active)busy=false;}
 }

 async function restore(){
  if(!session||busy||phase!=='changed')throw Error('USB recovery is unavailable; restore the preset on the device');
  const active=session;
  busy=true;phase='restoring';
  try{
   await active.setParameter({row:0,param:'cutoff',value:original});
   if(session===active){restorePending=false;phase='restored';}
  }catch(error){
   if(session===active)phase='uncertain';
   throw error;
  }finally{if(session===active)busy=false;}
 }

 async function disconnect(){
  const active=session;session=null;busy=false;
  if(restorePending)phase='uncertain';
  else{phase='idle';original=target=null;}
  await active?.disconnect();
 }

 function acknowledgeRecovery(){
  if(session||busy)throw Error('Disconnect first');
  restorePending=false;phase='idle';original=target=null;
 }
 return{snapshot,connect,apply,restore,disconnect,acknowledgeRecovery};
}
