import{
  createEpBackupBundle,readEpBackupBundleFile,buildBundleProjectRestorePlan
}from '../backupBundle.js?v=20261001-1';
import{getEpProjectProfile}from '../projectProfile.js?v=20261001-1';
import{preflightProjectSampleDependencies}from '../projectArchive.js?v=20261001-1';
import{crc32Hex}from '../projectRecovery.js?v=20261001-1';

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const safeProject=value=>{
  const project=String(value||'').padStart(2,'0');
  if(!/^\d{2}$/.test(project))throw new Error('Select a valid project first.');
  return project;
};
const pad=value=>String(value).padStart(3,'0');
const dateStamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

const defaultSaveBlob=async(blob,name)=>{
  if(globalThis.showSaveFilePicker){
    try{
      const handle=await globalThis.showSaveFilePicker({suggestedName:name});
      const writable=await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }catch(error){
      if(error?.name==='AbortError')return false;
      if(!['NotAllowedError','SecurityError','InvalidStateError'].includes(error?.name))throw error;
    }
  }
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
};

const makeProjectFile=(project,data,name=null)=>{
  const bytesValue=bytes(data).slice();
  const fileName=name||('P'+project+'.tar');
  if(typeof File==='function')return new File([bytesValue],fileName,{type:'application/x-tar'});
  return{
    name:fileName,size:bytesValue.byteLength,type:'application/x-tar',
    async arrayBuffer(){return bytesValue.buffer.slice(bytesValue.byteOffset,bytesValue.byteOffset+bytesValue.byteLength);}
  };
};

const sameBytes=(a,b)=>{
  const left=bytes(a),right=bytes(b);
  if(left.byteLength!==right.byteLength)return false;
  for(let index=0;index<left.length;index++)if(left[index]!==right[index])return false;
  return true;
};

export function createBackupRestoreController({
  dialog,openButton,recoveryButton,closeButton,
  backupProjectButton,backupProjectSamplesButton,backupDeviceButton,
  restoreInput,restoreSummary,restoreProjectSelect,restoreButton,
  recoveryList,recoveryDetail,recoveryRestoreButton,recoveryDownloadButton,recoveryDeleteButton,
  getSelectedProject=()=>null,
  getConnectedDeviceInfo=()=>null,
  getActiveDeviceProfile=()=>null,
  sampleStore,
  withFileTransaction,
  uploadProjectArchive,
  restoreProjectRecoveryCheckpoint,
  listProjectRecoveryCheckpoints,getProjectRecoveryCheckpoint,deleteProjectRecoveryCheckpoint,
  prepareSampleTransferMetadata,
  readDevice=async()=>{},
  refreshProjects=async()=>{},
  markDeviceUnsafe=()=>{},
  confirmAction=async()=>true,
  setStatus=()=>{},setGlobalProgress=()=>{},hideGlobalProgress=()=>{},
  reportError=()=>{},saveBlob=defaultSaveBlob
}={}){
  if(!dialog||typeof withFileTransaction!=='function'||typeof uploadProjectArchive!=='function')
    throw new TypeError('Backup/restore controller dependencies are incomplete.');

  let restoreSource=null;
  let restorePlan=null;
  let selectedRecoveryId=null;
  let busy=false;

  const setBaseDisabled=(button,value)=>{
    if(!button)return;
    button.dataset.baseDisabled=String(!!value);
    button.disabled=busy||!!value;
  };
  const setBusy=value=>{
    busy=!!value;
    for(const button of [
      backupProjectButton,backupProjectSamplesButton,backupDeviceButton,
      restoreButton,recoveryRestoreButton,recoveryDownloadButton,recoveryDeleteButton
    ])if(button)button.disabled=busy||(button.dataset.baseDisabled==='true');
  };
  const open=async(mode='backup')=>{
    dialog.hidden=false;
    dialog.dataset.mode=mode;
    if(mode==='recovery')await refreshRecovery();
  };
  const close=()=>{
    if(busy)return;
    dialog.hidden=true;
  };

  const readBackupSnapshot=async(scope,projectNumber=null)=>{
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('Connect an EP-series device first.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    const profile=getEpProjectProfile(info.sku,firmware);
    return withFileTransaction('backup snapshot',async fileOps=>{
      const root=await fileOps.listDirectory(0,'/');
      const projectsRoot=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
      const soundsRoot=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      if(!projectsRoot)throw new Error('EP-series /projects node is unavailable.');
      const projectNodes=(await fileOps.listDirectory(projectsRoot.nodeId,'/projects'))
        .filter(item=>item.fileType==='folder'&&/^\/projects\/\d{2}$/.test(item.fileName))
        .sort((a,b)=>a.fileName.localeCompare(b.fileName));
      const activeMeta=await fileOps.getFileMetadata(projectsRoot.nodeId,'active');
      const activeFid=Number(activeMeta?.active)||null;
      const selected=projectNumber==null?null:safeProject(projectNumber);
      const nodes=scope==='device'
        ?projectNodes
        :projectNodes.filter(item=>item.fileName===`/projects/${selected}`);
      if(!nodes.length)throw new Error('Selected project is not available on the connected EP.');

      const soundNodes=soundsRoot
        ?await fileOps.listDirectory(soundsRoot.nodeId,'/sounds')
        :[];
      const occupied=soundNodes.map(item=>Number(item.nodeId)).filter(id=>id>=1&&id<=999);
      const projects=[];
      const referenced=new Set();

      for(let index=0;index<nodes.length;index++){
        const node=nodes[index];
        setGlobalProgress('BACKUP PROJECTS',((index+.2)/Math.max(1,nodes.length))*35);
        const file=await fileOps.getFile(node.nodeId);
        const number=node.fileName.slice(-2);
        const dependencies=profile.projectAuthoring
          ?preflightProjectSampleDependencies(file.data,occupied,{profile,strict:false})
          :{referencedSampleSlots:[],missingSampleSlots:[],allSamplesAvailable:null};
        if(scope==='project+samples')
          for(const slot of dependencies.referencedSampleSlots||[])referenced.add(slot);
        projects.push({
          project:number,data:file.data.slice(),
          active:Number(node.nodeId)===activeFid,
          dependencies
        });
      }

      const sampleNodes=scope==='device'
        ?soundNodes.filter(item=>Number(item.nodeId)>=1&&Number(item.nodeId)<=999)
        :scope==='project+samples'
          ?soundNodes.filter(item=>referenced.has(Number(item.nodeId)))
          :[];
      const samples=[];
      for(let index=0;index<sampleNodes.length;index++){
        const node=sampleNodes[index];
        setGlobalProgress('BACKUP SAMPLES',35+((index+1)/Math.max(1,sampleNodes.length))*60);
        const file=await fileOps.getFile(node.nodeId);
        const metadata=await fileOps.getFileMetadata(node.nodeId);
        samples.push({
          slot:Number(node.nodeId),
          name:String(metadata?.name||file.name||node.fileName||('sample-'+pad(node.nodeId))),
          data:file.data.slice(),
          metadata:metadata||{}
        });
      }
      return{
        info,profile,
        activeProject:projectNodes.find(node=>Number(node.nodeId)===activeFid)?.fileName?.slice(-2)||null,
        projects,samples
      };
    });
  };

  const backupProject=async()=>{
    const project=safeProject(getSelectedProject());
    setBusy(true);setGlobalProgress('BACKUP PROJECT',10);
    try{
      const snapshot=await readBackupSnapshot('project',project);
      const record=snapshot.projects[0];
      const saved=await saveBlob(new Blob([record.data],{type:'application/x-tar'}),'P'+project+'.tar');
      if(saved)setStatus('BACKUP P'+project+' SAVED');
    }finally{hideGlobalProgress();setBusy(false);}
  };

  const backupBundle=async scope=>{
    const project=scope==='project+samples'?safeProject(getSelectedProject()):null;
    setBusy(true);setGlobalProgress('BUILDING BACKUP',5);
    try{
      const snapshot=await readBackupSnapshot(scope,project);
      setGlobalProgress('BUILDING BACKUP',97);
      const bundle=await createEpBackupBundle({
        scope,device:snapshot.info,activeProject:snapshot.activeProject,
        projects:snapshot.projects,samples:snapshot.samples
      });
      const name=scope==='device'
        ?'SpeedUpperCut_device_'+dateStamp()+'.zip'
        :'SpeedUpperCut_P'+project+'_samples_'+dateStamp()+'.zip';
      const saved=await saveBlob(bundle.blob,name);
      if(saved)setStatus(
        scope==='device'
          ?`DEVICE BACKUP · ${snapshot.projects.length} PROJECTS · ${snapshot.samples.length} SAMPLES`
          :`BACKUP P${project} + ${snapshot.samples.length} SAMPLES`
      );
    }finally{hideGlobalProgress();setBusy(false);}
  };

  const authoritativeBundlePlan=async(bundle,project)=>{
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('Connect an EP-series device first.');
    if(bundle.manifest.device?.sku&&String(bundle.manifest.device.sku)!==String(info.sku||'').toUpperCase())
      throw new Error('Backup SKU does not match the connected EP device.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    const profile=getEpProjectProfile(info.sku,firmware);
    if(!profile.projectAuthoring)
      throw new Error('Project restore is not hardware-verified for the connected firmware.');
    return withFileTransaction('backup restore preflight',async fileOps=>{
      const root=await fileOps.listDirectory(0,'/');
      const soundsRoot=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      if(!soundsRoot)throw new Error('EP-series /sounds node is unavailable.');
      const soundNodes=await fileOps.listDirectory(soundsRoot.nodeId,'/sounds');
      const nodeMap=new Map(soundNodes.map(item=>[Number(item.nodeId),item]));
      const target=bundle.projects.find(item=>item.number===project);
      if(!target)throw new Error('Project P'+project+' is not present in the backup.');
      const referenced=target.dependencies?.referencedSampleSlots||[];
      const authoritative=new Map();
      for(const slot of referenced){
        const node=nodeMap.get(Number(slot));
        if(!node)continue;
        const metadata=await fileOps.getFileMetadata(Number(slot));
        authoritative.set(Number(slot),{
          file:{name:node.fileName,size:Number(node.fileSize)||0},
          meta:metadata||{},
          verification:{file:'verified',metadata:'verified'}
        });
      }
      return buildBundleProjectRestorePlan(bundle,project,{
        getSampleSlot:slot=>authoritative.get(Number(slot))||null
      });
    });
  };

  const renderRestorePlan=plan=>{
    if(!restoreSummary)return;
    if(!plan){
      restoreSummary.innerHTML='<div class="ep-backup-empty">SELECT A .TAR OR SPEEDUPPERCUT BACKUP .ZIP</div>';
      setBaseDisabled(restoreButton,true);
      return;
    }
    if(plan.kind==='tar'){
      const missing=plan.preflight.missingSampleSlots||[];
      restoreSummary.innerHTML=[
        '<div class="ep-backup-plan-head"><strong>P',escapeHtml(plan.project),'</strong><span>PROJECT TAR</span></div>',
        '<div class="ep-backup-plan-row"><span>DEPENDENCIES</span><b>',
        missing.length?missing.length+' MISSING':'ALL AVAILABLE','</b></div>',
        missing.length?'<div class="ep-backup-warning">MISSING: '+missing.map(pad).join(', ')+'</div>':'',
        '<div class="ep-backup-note">RESTORE WRITES PROJECT ONLY. TARGET PROJECT MUST BE INACTIVE.</div>'
      ].join('');
      setBaseDisabled(restoreButton,missing.length>0);
      return;
    }
    const p=plan.plan;
    const rows=p.dependencies.map(item=>
      '<div class="ep-backup-dependency '+item.status+'"><span>'+pad(item.slot)+'</span><b>'+
      item.status.toUpperCase().replace('-',' ')+'</b></div>'
    ).join('');
    restoreSummary.innerHTML=[
      '<div class="ep-backup-plan-head"><strong>P',escapeHtml(plan.project),'</strong><span>',
      escapeHtml(plan.bundle.manifest.scope.toUpperCase()),'</span></div>',
      '<div class="ep-backup-plan-row"><span>RESTORE SAMPLES</span><b>',p.restore.length,'</b></div>',
      '<div class="ep-backup-plan-row"><span>ALREADY MATCH</span><b>',
      p.dependencies.filter(item=>item.status==='already-matches').length,'</b></div>',
      '<div class="ep-backup-plan-row"><span>CONFLICTS</span><b>',p.conflicts.length,'</b></div>',
      '<div class="ep-backup-plan-row"><span>MISSING FROM BACKUP</span><b>',p.missing.length,'</b></div>',
      '<div class="ep-backup-dependencies">',rows,'</div>',
      p.canRestore
        ?'<div class="ep-backup-note">SAFE RESTORE: ONLY EMPTY SAMPLE SLOTS ARE FILLED. OCCUPIED MISMATCHES ARE NEVER OVERWRITTEN.</div>'
        :'<div class="ep-backup-warning">RESTORE BLOCKED UNTIL CONFLICTS / MISSING DEPENDENCIES ARE RESOLVED.</div>'
    ].join('');
    setBaseDisabled(restoreButton,!p.canRestore);
  };

  const prepareTarRestore=async file=>{
    const match=String(file?.name||'').match(/P(\d{2})\.tar$/i);
    if(!match)throw new Error('Project TAR name must end with P00.tar .. P99.tar.');
    const project=match[1];
    const data=new Uint8Array(await file.arrayBuffer());
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('Connect an EP-series device first.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    const profile=getEpProjectProfile(info.sku,firmware);
    if(!profile.projectAuthoring)
      throw new Error('Project restore is not hardware-verified for the connected firmware.');
    const preflight=await withFileTransaction('project restore preflight',async fileOps=>{
      const root=await fileOps.listDirectory(0,'/');
      const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      const occupied=sounds
        ?(await fileOps.listDirectory(sounds.nodeId,'/sounds')).map(item=>Number(item.nodeId)).filter(id=>id>=1&&id<=999)
        :[];
      return preflightProjectSampleDependencies(data,occupied,{profile,strict:false});
    });
    return{kind:'tar',file,project,data,preflight};
  };

  const onRestoreFile=async file=>{
    restoreSource=null;restorePlan=null;
    restoreProjectSelect.innerHTML='';
    restoreProjectSelect.hidden=true;
    renderRestorePlan(null);
    if(!file)return;
    setBusy(true);setGlobalProgress('READING BACKUP',15);
    try{
      if(/\.tar$/i.test(file.name)){
        restorePlan=await prepareTarRestore(file);
        restoreSource=restorePlan;
        renderRestorePlan(restorePlan);
      }else if(/\.zip$/i.test(file.name)){
        const bundle=await readEpBackupBundleFile(file);
        restoreSource={kind:'bundle',bundle,file};
        for(const project of bundle.projects){
          const option=document.createElement('option');
          option.value=project.number;option.textContent='P'+project.number+(project.active?' · ACTIVE IN BACKUP':'');
          restoreProjectSelect.append(option);
        }
        if(!bundle.projects.length)throw new Error('Backup contains no projects.');
        restoreProjectSelect.hidden=bundle.projects.length<=1;
        const selected=bundle.manifest.activeProject&&bundle.projects.some(p=>p.number===bundle.manifest.activeProject)
          ?bundle.manifest.activeProject
          :bundle.projects[0].number;
        restoreProjectSelect.value=selected;
        const plan=await authoritativeBundlePlan(bundle,selected);
        restorePlan={kind:'bundle',bundle,project:selected,plan};
        renderRestorePlan(restorePlan);
      }else throw new Error('Choose a project .tar or SpeedUpperCut .zip backup.');
    }finally{hideGlobalProgress();setBusy(false);}
  };

  const restoreSamples=async plan=>{
    if(!plan.restore.length)return[];
    const profile=getActiveDeviceProfile();
    if(!profile?.sampleTransfers)throw new Error('Sample restore is not hardware-verified for this device firmware.');
    const created=[];
    try{
      await withFileTransaction('backup sample restore',async fileOps=>{
        const root=await fileOps.listDirectory(0,'/');
        const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
        if(!sounds)throw new Error('EP-series /sounds node is unavailable.');
        const current=await fileOps.listDirectory(sounds.nodeId,'/sounds');
        const occupied=new Set(current.map(item=>Number(item.nodeId)));
        for(const item of plan.restore)if(occupied.has(item.slot))
          throw new Error('Restore target sample slot changed: '+pad(item.slot)+'. Re-run preflight.');
        for(let index=0;index<plan.restore.length;index++){
          const item=plan.restore[index],sample=item.backupSample;
          setGlobalProgress('RESTORE SAMPLE '+pad(item.slot),((index+.1)/plan.restore.length)*70);
          const metadata=prepareSampleTransferMetadata(sample.metadata||{},{
            allowedPlayModes:profile.playModes,
            allowedBarValues:profile.sampleBars?.writeValues
          });
          let createdId=null;
          const fileId=await fileOps.uploadSampleToSlot({
            data:sample.data,
            filename:sample.name||('sample-'+pad(item.slot)),
            parentId:sounds.nodeId,
            destinationId:item.slot,
            metadata,
            allowedPlayModes:profile.playModes,
            allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
            allowedBarValues:profile.sampleBars?.writeValues,
            barWriteMode:profile.sampleBars?.authoring?'verified':'omit',
            onCreated:id=>{
              createdId=Number(id)||item.slot;
              if(!created.includes(createdId))created.push(createdId);
            }
          });
          if(Number(fileId)!==item.slot)throw new Error('Sample restore wrote an unexpected slot.');
          if(!created.includes(createdId||item.slot))created.push(createdId||item.slot);
          const readback=await fileOps.getFile(item.slot);
          if(crc32Hex(readback.data)!==String(sample.crc32))
            throw new Error('Sample restore readback checksum mismatch for '+pad(item.slot)+'.');
          const metadataReadback=await fileOps.getFileMetadata(item.slot);
          for(const key of ['channels','samplerate','format']){
            if(sample.metadata?.[key]!=null&&String(metadataReadback?.[key])!==String(sample.metadata[key]))
              throw new Error('Sample restore metadata mismatch for '+pad(item.slot)+' '+key+'.');
          }
        }
      },{strict:true});
      return created;
    }catch(error){
      if(created.length){
        try{
          await withFileTransaction('backup sample restore rollback',async fileOps=>{
            for(const slot of [...created].reverse())await fileOps.deleteFile(slot);
            const root=await fileOps.listDirectory(0,'/');
            const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
            const remaining=sounds?await fileOps.listDirectory(sounds.nodeId,'/sounds'):[];
            const occupied=new Set(remaining.map(item=>Number(item.nodeId)));
            const failed=created.filter(slot=>occupied.has(slot));
            if(failed.length)throw new Error('Rollback left sample slot(s): '+failed.map(pad).join(', '));
          },{strict:true});
        }catch(rollbackError){
          markDeviceUnsafe('Sample restore rollback failed: '+String(rollbackError?.message||rollbackError));
          error.rollbackError=rollbackError;
        }
      }
      throw error;
    }
  };

  const cleanupRestoredSamples=async slots=>{
    if(!slots.length)return;
    try{
      await withFileTransaction('backup restore cleanup',async fileOps=>{
        for(const slot of [...slots].reverse())await fileOps.deleteFile(slot);
        const root=await fileOps.listDirectory(0,'/');
        const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
        const remaining=sounds?await fileOps.listDirectory(sounds.nodeId,'/sounds'):[];
        const occupied=new Set(remaining.map(item=>Number(item.nodeId)));
        const failed=slots.filter(slot=>occupied.has(Number(slot)));
        if(failed.length)throw new Error('Restore cleanup left sample slot(s): '+failed.map(pad).join(', '));
      },{strict:true});
    }catch(error){
      markDeviceUnsafe('Backup restore cleanup failed: '+String(error?.message||error));
      throw error;
    }
  };

  const executeRestore=async()=>{
    if(!restorePlan||restoreButton.disabled)return;
    const project=restorePlan.project;
    const ok=await confirmAction(
      'Restore P'+project+'? Project writes are checkpointed. Sample restore only fills empty slots and never overwrites conflicts.'
    );
    if(!ok)return;
    setBusy(true);setGlobalProgress('RESTORE PRECHECK',5);
    let addedSamples=[];
    try{
      if(restorePlan.kind==='bundle'){
        const latest=await authoritativeBundlePlan(restorePlan.bundle,project);
        if(!latest.canRestore)throw new Error('Restore preflight changed. Resolve conflicts and retry.');
        addedSamples=await restoreSamples(latest);
        const target=restorePlan.bundle.projects.find(item=>item.number===project);
        setGlobalProgress('RESTORE PROJECT P'+project,78);
        try{
          await uploadProjectArchive(makeProjectFile(project,target.data),{
            requireInactive:true,
            performReload:false
          });
        }catch(error){
          await cleanupRestoredSamples(addedSamples);
          throw error;
        }
      }else{
        setGlobalProgress('RESTORE PROJECT P'+project,40);
        await uploadProjectArchive(restorePlan.file,{requireInactive:true,performReload:false});
      }
      setGlobalProgress('VERIFYING RESTORE',96);
      await readDevice();
      await refreshProjects();
      setStatus('RESTORE P'+project+' VERIFIED');
      await refreshRecovery();
    }finally{hideGlobalProgress();setBusy(false);}
  };

  const renderRecovery=records=>{
    if(!recoveryList)return;
    if(!records.length){
      recoveryList.innerHTML='<div class="ep-backup-empty">NO RECOVERY CHECKPOINTS</div>';
      selectedRecoveryId=null;
      renderRecoveryDetail(null);
      return;
    }
    if(!records.some(item=>item.id===selectedRecoveryId))selectedRecoveryId=records[0].id;
    recoveryList.innerHTML=records.map(record=>
      '<button type="button" class="ep-recovery-row'+(record.id===selectedRecoveryId?' selected':'')+
      '" data-recovery-id="'+escapeHtml(record.id)+'">'+
      '<span>P'+escapeHtml(record.project?.number||'??')+'</span>'+
      '<b>'+escapeHtml(String(record.status||'unknown').toUpperCase())+'</b>'+
      '<small>'+escapeHtml(String(record.updatedAt||record.createdAt||'').replace('T',' ').slice(0,19))+'</small></button>'
    ).join('');
    recoveryList.querySelectorAll('[data-recovery-id]').forEach(button=>{
      button.onclick=async()=>{
        selectedRecoveryId=button.dataset.recoveryId;
        await refreshRecovery();
      };
    });
  };

  const renderRecoveryDetail=record=>{
    if(!recoveryDetail)return;
    if(!record){
      recoveryDetail.innerHTML='<div class="ep-backup-empty">SELECT A CHECKPOINT</div>';
      setBaseDisabled(recoveryRestoreButton,true);setBaseDisabled(recoveryDownloadButton,true);setBaseDisabled(recoveryDeleteButton,true);
      return;
    }
    const journal=Array.isArray(record.journal)?record.journal:[];
    recoveryDetail.innerHTML=[
      '<div class="ep-recovery-head"><strong>P',escapeHtml(record.project?.number||'??'),'</strong><b>',
      escapeHtml(String(record.status||'unknown').toUpperCase()),'</b></div>',
      '<div class="ep-backup-plan-row"><span>TRANSACTION</span><b>',escapeHtml(String(record.transactionStatus||'pending').toUpperCase()),'</b></div>',
      '<div class="ep-backup-plan-row"><span>CURRENT PHASE</span><b>',escapeHtml(record.currentPhase||'—'),'</b></div>',
      '<div class="ep-backup-plan-row"><span>FAILURE PHASE</span><b>',escapeHtml(record.failurePhase||'—'),'</b></div>',
      '<div class="ep-backup-plan-row"><span>ORIGINAL CRC32</span><b>',escapeHtml(record.original?.crc32||'—'),'</b></div>',
      '<div class="ep-recovery-journal">',
      journal.map(event=>'<div><span>'+event.sequence+'</span><b>'+escapeHtml(event.phase)+'</b><em>'+escapeHtml(event.status)+'</em></div>').join('')||
        '<div class="ep-backup-empty">NO JOURNAL EVENTS</div>',
      '</div>'
    ].join('');
    const restorable=['requires-recovery','rollback-failed','verified','rolled-back','candidate-written'].includes(String(record.status||''));
    const deletable=['verified','rolled-back','aborted'].includes(String(record.status||''));
    setBaseDisabled(recoveryRestoreButton,!restorable);
    setBaseDisabled(recoveryDownloadButton,!record.original?.data);
    setBaseDisabled(recoveryDeleteButton,!deletable);
  };

  const refreshRecovery=async()=>{
    const records=await listProjectRecoveryCheckpoints();
    renderRecovery(records);
    const selected=records.find(item=>item.id===selectedRecoveryId)||null;
    renderRecoveryDetail(selected);
  };

  const restoreRecovery=async()=>{
    if(!selectedRecoveryId)return;
    const record=await getProjectRecoveryCheckpoint(selectedRecoveryId);
    if(!record)return;
    const ok=await confirmAction(
      'Restore original P'+record.project?.number+' from this recovery checkpoint? A new recovery checkpoint will be created before writing.'
    );
    if(!ok)return;
    setBusy(true);setGlobalProgress('RECOVERY RESTORE',15);
    try{
      await restoreProjectRecoveryCheckpoint(selectedRecoveryId,{
        requireInactive:true,performReload:false
      });
      await readDevice();await refreshProjects();await refreshRecovery();
      setStatus('RECOVERY P'+record.project?.number+' VERIFIED');
    }finally{hideGlobalProgress();setBusy(false);}
  };
  const downloadRecovery=async()=>{
    if(!selectedRecoveryId)return;
    const record=await getProjectRecoveryCheckpoint(selectedRecoveryId);
    if(!record?.original?.data)return;
    const data=bytes(record.original.data);
    if(crc32Hex(data)!==String(record.original.crc32||''))throw new Error('Recovery original checksum mismatch.');
    const storedName=String(record.original.name||'');
    const projectName='P'+String(record.project?.number||'').padStart(2,'0')+'.tar';
    await saveBlob(
      new Blob([data],{type:'application/x-tar'}),
      /P\d{2}\.tar$/i.test(storedName)?storedName:projectName
    );
  };
  const deleteRecovery=async()=>{
    if(!selectedRecoveryId)return;
    const record=await getProjectRecoveryCheckpoint(selectedRecoveryId);
    if(!record)return;
    if(!['verified','rolled-back','aborted'].includes(String(record.status||'')))
      throw new Error('Unresolved recovery checkpoints cannot be deleted.');
    if(!await confirmAction('Delete this completed recovery checkpoint?'))return;
    await deleteProjectRecoveryCheckpoint(selectedRecoveryId);
    selectedRecoveryId=null;
    await refreshRecovery();
  };

  openButton?.addEventListener('click',()=>{void open('backup');});
  recoveryButton?.addEventListener('click',()=>{void open('recovery').catch(error=>reportError('COULD NOT READ RECOVERY CHECKPOINTS.',error));});
  closeButton?.addEventListener('click',close);
  backupProjectButton?.addEventListener('click',()=>backupProject().catch(error=>reportError('PROJECT BACKUP FAILED.',error)));
  backupProjectSamplesButton?.addEventListener('click',()=>backupBundle('project+samples').catch(error=>reportError('PROJECT + SAMPLES BACKUP FAILED.',error)));
  backupDeviceButton?.addEventListener('click',()=>backupBundle('device').catch(error=>reportError('DEVICE BACKUP FAILED.',error)));
  restoreInput?.addEventListener('change',()=>onRestoreFile(restoreInput.files?.[0]||null).catch(error=>reportError('RESTORE PREFLIGHT FAILED.',error)));
  restoreProjectSelect?.addEventListener('change',async()=>{
    if(restoreSource?.kind!=='bundle')return;
    try{
      const project=restoreProjectSelect.value;
      const plan=await authoritativeBundlePlan(restoreSource.bundle,project);
      restorePlan={kind:'bundle',bundle:restoreSource.bundle,project,plan};
      renderRestorePlan(restorePlan);
    }catch(error){reportError('RESTORE PREFLIGHT FAILED.',error);}
  });
  restoreButton?.addEventListener('click',()=>executeRestore().catch(error=>reportError('RESTORE FAILED.',error)));
  recoveryRestoreButton?.addEventListener('click',()=>restoreRecovery().catch(error=>reportError('RECOVERY RESTORE FAILED.',error)));
  recoveryDownloadButton?.addEventListener('click',()=>downloadRecovery().catch(error=>reportError('RECOVERY DOWNLOAD FAILED.',error)));
  recoveryDeleteButton?.addEventListener('click',()=>deleteRecovery().catch(error=>reportError('RECOVERY DELETE FAILED.',error)));

  renderRestorePlan(null);
  renderRecoveryDetail(null);
  return Object.freeze({
    open,close,refreshRecovery,onRestoreFile,executeRestore,
    getState:()=>Object.freeze({
      busy,
      restoreKind:restorePlan?.kind||null,
      restoreProject:restorePlan?.project||null,
      selectedRecoveryId
    })
  });
}
