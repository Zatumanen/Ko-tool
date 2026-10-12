import{TE_SYSEX_FILE_EVENT_METADATA_UPDATED}from '../constants.js?v=20261001-1';

/**
 * Follow a device-selected pad without triggering playback.
 * The official EP Sample Tool derives PAD_CHANGED from group "active"
 * metadata and uses the pad's "sym" value as the sound FID.
 */
export function createDevicePadSelectionController({
  isConnected=()=>false,isSynchronized=()=>false,getMemory=()=>null,
  sampleStore,withFileTransaction,getFileInfo,getFileMetadata,listDirectory,
  captureBatchSession=()=>null,assertBatchSession=()=>{},
  logTechnical=()=>{},schedule=(fn,delay)=>setTimeout(fn,delay),
  cancelSchedule=handle=>clearTimeout(handle)
}={}){
  let lastPadId=null,seq=0,pending=null;
  const read=fn=>typeof withFileTransaction==='function'
    ?withFileTransaction('active EP pad selection',fn)
    :fn({getFileInfo,getFileMetadata,listDirectory});

  const padForProject=async(ops,projectId)=>{
    const info=await ops.getFileInfo(projectId);
    const number=String(info?.fileName||'').padStart(2,'0');
    if(!/^\d{2}$/.test(number))return null;
    const projectPath='/projects/'+number;
    const children=await ops.listDirectory(projectId,projectPath);
    const groups=children.find(node=>node.fileName===projectPath+'/groups');
    if(!groups)return null;
    const groupId=Number((await ops.getFileMetadata(groups.nodeId))?.active);
    if(!groupId)return null;
    return Number((await ops.getFileMetadata(groupId))?.active)||null;
  };
  const resolvePadId=async(ops,event)=>{
    const id=Number(event?.data?.nodeId);
    const meta=event?.data?.metadata||{};
    if(Number.isInteger(meta.sym)&&id===lastPadId)return id;
    if(!Number.isInteger(meta.active)||meta.active<=0)return null;
    const owner=await ops.getFileInfo(id);
    const name=String(owner?.fileName||'');
    if(/^[ABCD]$/i.test(name)){
      const parent=await ops.getFileInfo(owner.parentId);
      if(String(parent?.fileName||'').toLowerCase()!=='groups')return null;
      return meta.active;
    }
    if(name.toLowerCase()==='groups')
      return Number((await ops.getFileMetadata(meta.active))?.active)||null;
    if(name.toLowerCase()==='projects')
      return padForProject(ops,meta.active);
    return null;
  };
  const handle=async(event,token,version)=>{
    if(!isConnected()||!isSynchronized())return;
    try{
      const selection=await read(async ops=>{
        const padId=await resolvePadId(ops,event);
        if(!padId)return null;
        const metadata=await ops.getFileMetadata(padId);
        return{padId,sym:Number(metadata?.sym)};
      });
      assertBatchSession(token);
      if(version!==seq||!isConnected()||!isSynchronized()||!selection)return;
      lastPadId=selection.padId;
      const sym=selection.sym;
      if(Number.isInteger(sym)&&sym>=1&&sym<=999&&sampleStore?.getSlot(sym)?.file)
        getMemory()?.selectSlots([sym],{activeId:sym,preview:false,navigate:true});
    }catch(error){logTechnical('ACTIVE EP PAD READ',error);}
  };
  const handleFileEvent=event=>{
    if(event?.type!==TE_SYSEX_FILE_EVENT_METADATA_UPDATED||!isConnected()||!isSynchronized())return;
    const meta=event?.data?.metadata;
    if(!meta||!(Number.isInteger(meta.active)||Number.isInteger(meta.sym)))return;
    const token=captureBatchSession(),version=++seq;
    if(pending!=null)cancelSchedule(pending);
    pending=schedule(()=>{pending=null;void handle(event,token,version);},70);
  };
  const reset=()=>{seq++;lastPadId=null;if(pending!=null)cancelSchedule(pending);pending=null;};
  return{handleFileEvent,reset};
}
