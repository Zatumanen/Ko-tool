import{TE_SYSEX_FILE_CAPABILITY_READ}from './constants.js';
import{
  parseProjectArchive,validateProjectArchive,compareProjectArchiveMembers,preflightProjectSampleDependencies
}from './projectArchive.js?v=20260930-5';
import{
  assertProjectTransportSupported,assertProjectAuthoringSupported,assertProjectReloadSupported
}from './projectProfile.js?v=20260930-5';
import{createProjectRuntimeGate}from './projectRuntime.js?v=20260930-5';
import{createProjectRecoveryCheckpoint}from './projectRecovery.js?v=20260930-5';
import{createProjectTransactionJournal}from './projectTransactionJournal.js?v=20260930-5';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const positiveActive=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>0?number:null;
};

export function assertProjectWriteActiveGuard({
  destinationFid,activeProjectFid,requireInactive=false,expectedActiveProjectFid=null
}={}){
  const destination=Number(destinationFid),active=Number(activeProjectFid);
  if(!Number.isInteger(destination)||destination<=0)
    throw new Error('Project write guard requires a valid destination FID.');
  if(!Number.isInteger(active)||active<=0)
    throw new Error('Project write guard requires a valid active project FID.');
  if(requireInactive&&active===destination)
    throw new Error('Refusing project write: destination project is currently active.');
  if(expectedActiveProjectFid!=null&&active!==Number(expectedActiveProjectFid))
    throw new Error('Refusing project write: active project changed after preflight.');
  return active;
}

export function createProjectFilesystem({
  runFileOperation,
  withStrictFirmwareDebugGuard,
  getConnectedDeviceInfo,
  markDeviceUnsafe,
  isDeviceUnsafe,
  initRead,
  initFileSystem,
  listDirectory,
  listDeviceFiles,
  getFile,
  putFile,
  getFileMetadata,
  setFileMetadata,
  recoveryStore
}={}){
  const required={
    runFileOperation,withStrictFirmwareDebugGuard,getConnectedDeviceInfo,markDeviceUnsafe,isDeviceUnsafe,
    initRead,initFileSystem,listDirectory,listDeviceFiles,getFile,putFile,getFileMetadata,setFileMetadata
  };
  for(const[name,value]of Object.entries(required))
    if(typeof value!=='function')throw new TypeError('Project filesystem dependency '+name+' is required.');
  for(const method of ['saveCheckpoint','updateCheckpoint','getCheckpoint','listCheckpoints','deleteCheckpoint'])
    if(typeof recoveryStore?.[method]!=='function')
      throw new TypeError('Project filesystem recoveryStore.'+method+' is required.');

  const projectRuntimeGate=createProjectRuntimeGate();
  const transactionJournal=createProjectTransactionJournal({recoveryStore});
  const updateRecoveryCheckpoint=async(id,patch)=>{
    try{return await recoveryStore.updateCheckpoint(id,patch);}
    catch{return null;}
  };

  const connectedProjectProfile=(mode='transport')=>{
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('EP-series device is not connected.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    if(mode==='authoring')return assertProjectAuthoringSupported(info.sku,firmware);
    if(mode==='reload')return assertProjectReloadSupported(info.sku,firmware);
    return assertProjectTransportSupported(info.sku,firmware);
  };

  const getProjectRuntimeSettleState=()=>projectRuntimeGate.getState();
  const assertProjectRuntimeSettled=(label='project operation')=>projectRuntimeGate.assertSettled(label);
  const resetProjectRuntime=()=>projectRuntimeGate.reset();

  const getActiveNode=async nodeId=>{
    const metadata=await getFileMetadata(nodeId,'active');
    return positiveActive(metadata?.active);
  };

  const captureProjectActivation=async(projectId,projectsNodeId)=>{
    const groupRootId=projectId+100;
    const activeProject=await getActiveNode(projectsNodeId);
    const activeGroup=await getActiveNode(groupRootId);
    const activePad=activeGroup?await getActiveNode(activeGroup):null;
    return{activeProject,activeGroup,activePad,groupRootId};
  };

  const reloadProject=async(projectId,projectsNodeId,{cycle=true,activeGroup=null,activePad=null}={})=>{
    const groupRootId=projectId+100;
    let cycledProject=null;
    if(cycle){
      const projects=await listDirectory(projectsNodeId,'/projects');
      cycledProject=projects.find(item=>item.fileType==='folder'&&Number(item.nodeId)!==Number(projectId))?.nodeId||null;
      if(cycledProject){
        await setFileMetadata(projectsNodeId,{active:cycledProject});
        const cycleReadback=await getActiveNode(projectsNodeId);
        if(cycleReadback!==cycledProject)
          throw new Error(`EP project cycle readback active=${cycleReadback}, expected ${cycledProject}.`);
        await sleep(200);
      }
    }

    await setFileMetadata(projectsNodeId,{active:projectId});
    const activeProject=await getActiveNode(projectsNodeId);
    if(activeProject!==projectId)
      throw new Error(`EP project reload readback active=${activeProject}, expected ${projectId}.`);

    let groupReadback=null,padReadback=null;
    if(positiveActive(activeGroup)){
      await setFileMetadata(groupRootId,{active:activeGroup});
      groupReadback=await getActiveNode(groupRootId);
      if(groupReadback!==activeGroup)
        throw new Error(`EP group reload readback active=${groupReadback}, expected ${activeGroup}.`);
    }
    if(positiveActive(activePad)&&positiveActive(activeGroup)){
      await setFileMetadata(activeGroup,{active:activePad});
      padReadback=await getActiveNode(activeGroup);
      if(padReadback!==activePad)
        throw new Error(`EP pad reload readback active=${padReadback}, expected ${activePad}.`);
    }
    const runtimeSettle=projectRuntimeGate.markReload();
    return{
      activeProjectFid:activeProject,
      activeGroupFid:groupReadback,
      activePadFid:padReadback,
      cycledProjectFid:cycledProject,
      runtimeSettle
    };
  };

  const reloadProjectArchive=async(projectNumber,{cycle=true}={})=>
    runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
      assertProjectRuntimeSettled('project reload');
      connectedProjectProfile('reload');
      const project=String(projectNumber).padStart(2,'0');
      await initRead();
      const root=await listDirectory(0,'/');
      const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
      if(!parent)throw new Error('EP-series /projects node is not available.');
      const projects=await listDirectory(parent.nodeId,'/projects');
      const destination=projects.find(item=>item.fileName===`/projects/${project}`&&item.fileType==='folder');
      if(!destination)throw new Error(`EP-series project ${project} is not available.`);
      const state=await captureProjectActivation(destination.nodeId,parent.nodeId);
      return reloadProject(destination.nodeId,parent.nodeId,{
        cycle,activeGroup:state.activeGroup,activePad:state.activePad
      });
    },'project reload'));

  const uploadProjectArchive=async(file,{
    onProgress,timeout=15000,cycleReload=true,performReload=true,onBackup,
    requireInactive=false,expectedActiveProjectFid=null
  }={})=>runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
    assertProjectRuntimeSettled('project write');
    const match=String(file?.name||'').match(/\w*P(\d{2})\.tar$/);
    if(!match?.[1])throw new Error(`${file?.name||'file'} is not a valid project archive`);
    const project=match[1];
    const data=new Uint8Array(await file.arrayBuffer());
    if(data.byteLength===0)throw new Error('Cannot upload an empty project archive.');
    const deviceInfo=getConnectedDeviceInfo();
    if(!deviceInfo)throw new Error('EP-series device is not connected.');
    const profile=connectedProjectProfile('transport');
    if(profile.projectAuthoring)validateProjectArchive(data,{profile});
    else parseProjectArchive(data);

    await initRead();
    const root=await listDirectory(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available.');
    const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
    const occupiedSampleSlots=sounds
      ?(await listDirectory(sounds.nodeId,'/sounds'))
        .map(item=>Number(item.nodeId))
        .filter(id=>Number.isInteger(id)&&id>=1&&id<=999)
      :[];
    const sampleDependencies=profile.projectAuthoring
      ?preflightProjectSampleDependencies(data,occupiedSampleSlots,{profile})
      :{referencedSampleSlots:null,missingSampleSlots:null,allSamplesAvailable:null,semanticPreflight:false};

    const projects=await listDirectory(parent.nodeId,'/projects');
    const destination=projects.find(item=>item.fileName===`/projects/${project}`&&item.fileType==='folder');
    if(!destination)throw new Error(`EP-series project ${project} is not available.`);

    const backup=await getFile(destination.nodeId);
    if(profile.projectAuthoring)validateProjectArchive(backup.data,{profile});
    else parseProjectArchive(backup.data);
    const activation=profile.projectReloadVerified&&performReload
      ?await captureProjectActivation(destination.nodeId,parent.nodeId)
      :{activeProject:null,activeGroup:null,activePad:null,groupRootId:null};
    let activeProjectBeforeWrite=null;
    if(requireInactive||expectedActiveProjectFid!=null){
      activeProjectBeforeWrite=assertProjectWriteActiveGuard({
        destinationFid:destination.nodeId,
        activeProjectFid:await getActiveNode(parent.nodeId),
        requireInactive,
        expectedActiveProjectFid
      });
    }

    const recoveryCheckpoint=createProjectRecoveryCheckpoint({
      device:deviceInfo,
      projectNumber:project,
      destinationFid:destination.nodeId,
      parentFid:parent.nodeId,
      backup,
      candidate:data,
      activation,
      operation:'project-write'
    });
    await recoveryStore.saveCheckpoint(recoveryCheckpoint);
    await transactionJournal.completePhase(recoveryCheckpoint.id,'PRECHECK',{
      project,
      destinationFid:destination.nodeId,
      projectAuthoring:profile.projectAuthoring,
      sampleDependencies:{
        referenced:sampleDependencies.referencedSampleSlots?.length??null,
        missing:sampleDependencies.missingSampleSlots?.length??null
      },
      activeProjectBeforeWrite
    });
    await transactionJournal.beginPhase(recoveryCheckpoint.id,'CHECKPOINT',{
      originalCrc32:recoveryCheckpoint.original.crc32,
      candidateCrc32:recoveryCheckpoint.candidate.crc32
    });

    let mutationAttempted=false;
    let candidateWritten=false;
    let phase='CHECKPOINT';
    try{
      await onBackup?.({
        project,name:backup.name,size:backup.size,data:backup.data.slice(),
        recoveryCheckpointId:recoveryCheckpoint.id
      });
      await transactionJournal.completePhase(recoveryCheckpoint.id,'CHECKPOINT',{
        originalBytes:backup.data.byteLength
      });

      phase='WRITE';
      await transactionJournal.beginPhase(recoveryCheckpoint.id,'WRITE',{
        bytes:data.byteLength,
        destinationFid:destination.nodeId
      });
      mutationAttempted=true;
      await putFile({
        data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,
        metadata:null,onProgress,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]
      });
      candidateWritten=true;
      await updateRecoveryCheckpoint(recoveryCheckpoint.id,{status:'candidate-written'});
      await initFileSystem();
      await transactionJournal.completePhase(recoveryCheckpoint.id,'WRITE',{bytes:data.byteLength});

      phase='READBACK';
      await transactionJournal.beginPhase(recoveryCheckpoint.id,'READBACK',{
        destinationFid:destination.nodeId
      });
      const readback=await getFile(destination.nodeId);
      if(profile.projectAuthoring)validateProjectArchive(readback.data,{profile});
      else parseProjectArchive(readback.data);
      await transactionJournal.completePhase(recoveryCheckpoint.id,'READBACK',{
        bytes:readback.data.byteLength
      });

      const verification=compareProjectArchiveMembers(data,readback.data);

      phase='RELOAD';
      let reload=null;
      if(profile.projectReloadVerified&&performReload){
        await transactionJournal.beginPhase(recoveryCheckpoint.id,'RELOAD',{
          cycle:cycleReload
        });
        reload=await reloadProject(destination.nodeId,parent.nodeId,{
          cycle:cycleReload,
          activeGroup:activation.activeGroup,
          activePad:activation.activePad
        });
        await transactionJournal.completePhase(recoveryCheckpoint.id,'RELOAD',{
          activeProjectFid:reload.activeProjectFid
        });
      }else{
        await transactionJournal.skipPhase(recoveryCheckpoint.id,'RELOAD',{
          reason:performReload?'reload-not-hardware-verified':'reload-disabled'
        });
      }

      phase='VERIFY';
      await transactionJournal.beginPhase(recoveryCheckpoint.id,'VERIFY');
      await transactionJournal.completePhase(recoveryCheckpoint.id,'VERIFY',{
        matchedMembers:verification.matched??null,
        firmwareAddedMembers:verification.added??null
      });
      const verifiedCheckpoint=await updateRecoveryCheckpoint(recoveryCheckpoint.id,{
        status:'verified',
        verifiedAt:new Date().toISOString()
      });
      return{
        project,
        fileId:destination.nodeId,
        verification,
        reload,
        sampleDependencies,
        activeProjectBeforeWrite,
        backup:{name:backup.name,size:backup.size},
        recoveryCheckpoint:{
          id:recoveryCheckpoint.id,
          status:verifiedCheckpoint?.status||'candidate-written'
        },
        transactionJournal:await transactionJournal.getJournal(recoveryCheckpoint.id)
      };
    }catch(error){
      try{await transactionJournal.failPhase(recoveryCheckpoint.id,phase,error);}
      catch{}

      if(!mutationAttempted){
        await updateRecoveryCheckpoint(recoveryCheckpoint.id,{
          status:'aborted',
          error:String(error?.message||error)
        });
        try{await transactionJournal.markAborted(recoveryCheckpoint.id,{phase});}catch{}
        throw error;
      }

      if(!candidateWritten||isDeviceUnsafe()){
        await updateRecoveryCheckpoint(recoveryCheckpoint.id,{
          status:'requires-recovery',
          error:String(error?.message||error)
        });
        try{await transactionJournal.markRequiresRecovery(recoveryCheckpoint.id,{phase});}catch{}
        throw error;
      }
      try{
        await transactionJournal.beginPhase(recoveryCheckpoint.id,'ROLLBACK',{
          failedPhase:phase
        });
        await putFile({
          data:backup.data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,
          metadata:null,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]
        });
        await initFileSystem();
        const restored=await getFile(destination.nodeId);
        compareProjectArchiveMembers(backup.data,restored.data);
        if(profile.projectReloadVerified&&performReload)await reloadProject(
          destination.nodeId,parent.nodeId,{
            cycle:cycleReload,
            activeGroup:activation.activeGroup,
            activePad:activation.activePad
          }
        );
        error.projectRollbackSucceeded=true;
        await transactionJournal.completePhase(recoveryCheckpoint.id,'ROLLBACK',{
          restoredBytes:restored.data.byteLength
        });
        await updateRecoveryCheckpoint(recoveryCheckpoint.id,{
          status:'rolled-back',
          rollbackAt:new Date().toISOString(),
          error:String(error?.message||error)
        });
      }catch(rollbackError){
        error.projectRollbackSucceeded=false;
        error.rollbackError=rollbackError;
        try{await transactionJournal.failPhase(recoveryCheckpoint.id,'ROLLBACK',rollbackError,{failedPhase:phase});}
        catch{}
        await updateRecoveryCheckpoint(recoveryCheckpoint.id,{
          status:'rollback-failed',
          rollbackAt:new Date().toISOString(),
          error:String(error?.message||error),
          rollbackError:String(rollbackError?.message||rollbackError)
        });
        markDeviceUnsafe(
          'Project rollback failed after a project write verification error: '+
          String(rollbackError?.message||rollbackError)
        );
      }
      throw error;
    }
  },'project write transaction'));

  const getProjectRecoveryCheckpoint=id=>recoveryStore.getCheckpoint(id);
  const listProjectRecoveryCheckpoints=()=>recoveryStore.listCheckpoints();
  const deleteProjectRecoveryCheckpoint=id=>recoveryStore.deleteCheckpoint(id);
  const getProjectTransactionJournal=id=>transactionJournal.getJournal(id);

  const downloadProjectArchive=async(path,onProgress)=>
    runFileOperation(async()=>{
      await initRead();
      const files=await listDeviceFiles();
      const node=files.find(item=>item.fileName===path);
      if(!node)throw new Error(`EP-series project path not found: ${path}`);
      return getFile(node.nodeId,onProgress);
    });

  return{
    resetProjectRuntime,
    getProjectRuntimeSettleState,
    assertProjectRuntimeSettled,
    reloadProjectArchive,
    uploadProjectArchive,
    downloadProjectArchive,
    getProjectRecoveryCheckpoint,
    listProjectRecoveryCheckpoints,
    deleteProjectRecoveryCheckpoint,
    getProjectTransactionJournal
  };
}
