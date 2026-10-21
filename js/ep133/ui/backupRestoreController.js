import{
  createEpBackupBundle,readEpBackupBundleFile,buildBundleProjectRestorePlan
}from '../backupBundle.js?v=20261001-1';
import{getEpProjectProfile}from '../projectProfile.js?v=20261001-1';
import{createOfficialEpPak}from '../officialPak.js?v=20261022-1';
import{inspectOfficialPak}from '../officialPakReader.js?v=20261022-1';
import{preflightProjectSampleDependencies}from '../projectArchive.js?v=20261001-1';
import{crc32Hex}from '../projectRecovery.js?v=20261001-1';

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const safeProject=value=>{
  const project=String(value||'').padStart(2,'0');
  if(!/^\d{2}$/.test(project))throw new Error('Select a valid project first.');
  return project;
};
const pad=value=>String(value).padStart(3,'0');
class BackupCancelledError extends Error{
  constructor(){super('Backup cancelled by user');this.name='BackupCancelledError';}
}
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
      return 'saved';
    }catch(error){
      if(error?.name==='AbortError')return false;
      // A rejected picker is not proof of permission to save via another path.
      // Surface the error in the dialog; never silently claim the file was saved.
      throw error;
    }
  }
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return 'handoff'; // The browser accepted a download gesture, not a disk-write receipt.
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
  const pakPreviewInput=dialog.querySelector('#ep133-pak-preview-file');
  const pakPreviewSummary=dialog.querySelector('#ep133-pak-preview-summary');
  const officialProjectButton=dialog.querySelector('#ep133-backup-official-project');
  const officialDeviceButton=dialog.querySelector('#ep133-backup-official-device');
  let backupInProgress=false;
  let cancelRequested=false;
  const cancelBackupButton=dialog.querySelector?.('#ep133-backup-cancel')||null;
  const assertBackupContinuing=()=>{if(cancelRequested)throw new BackupCancelledError();};
  const requestBackupCancellation=()=>{
    if(!backupInProgress||cancelRequested)return;
    cancelRequested=true;
    if(cancelBackupButton){
      cancelBackupButton.disabled=true;
      cancelBackupButton.textContent='CANCELLING…';
    }
    updateBackupProgress('CANCELLING',{
      detail:'FINISHING CURRENT DEVICE REQUEST · NO PARTIAL ARCHIVE WILL BE SAVED'
    },'cancelling');
  };
  const progressPanel=dialog.querySelector?.('#ep133-backup-operation')||null;
  const phaseElement=dialog.querySelector?.('#ep133-backup-phase')||null;
  const countsElement=dialog.querySelector?.('#ep133-backup-counts')||null;
  const currentElement=dialog.querySelector?.('#ep133-backup-current')||null;
  const detailElement=dialog.querySelector?.('#ep133-backup-detail')||null;
  const progressFill=dialog.querySelector?.('#ep133-backup-progress-fill')||null;
  let backupProgress={phase:'PREPARING',projectDone:0,projectTotal:0,
    sampleDone:0,sampleTotal:0,current:'—',detail:'',percent:0};
  const updateBackupProgress=(phase,updates={},state='running')=>{
    if(backupInProgress&&cancelRequested&&state==='running'){
      phase='CANCELLING';
      state='cancelling';
      updates={...updates,detail:'FINISHING CURRENT DEVICE REQUEST · NO PARTIAL ARCHIVE WILL BE SAVED'};
    }
    backupProgress={...backupProgress,phase,...updates};
    if(!progressPanel)return;
    progressPanel.hidden=false;
    progressPanel.dataset.state=state;
    if(phaseElement)phaseElement.textContent=state==='failed'?'FAILED':phase;
    if(countsElement)countsElement.textContent=
      'PROJECTS '+backupProgress.projectDone+'/'+backupProgress.projectTotal+
      ' · SAMPLES '+backupProgress.sampleDone+'/'+backupProgress.sampleTotal;
    if(currentElement)currentElement.textContent=backupProgress.current||'—';
    if(detailElement)detailElement.textContent=backupProgress.detail||'';
    if(progressFill)progressFill.style.width=
      Math.max(0,Math.min(100,Number(backupProgress.percent)||0))+'%';
  };
  const failBackup=(error)=>{
    const reason=String(error?.message||error||'Unknown backup error');
    updateBackupProgress('RESULT',{detail:reason},'failed');
  };
  const finishBackup=(outcome)=>{
    const saved=outcome==='saved'||outcome===true;
    const cancelled=outcome===false;
    updateBackupProgress('RESULT',{
      percent:100,
      current:cancelled?'NO FILE SAVED':backupProgress.current,
      detail:saved?'FILE WRITTEN · FILE HANDLE CLOSED':
        cancelled?'CANCELLED BY USER · NO FILE SAVED':
          'DOWNLOAD HANDED TO BROWSER · VERIFY FILE IN DOWNLOADS'
    },cancelled?'cancelled':'done');
    return saved;
  };
  const setDialogProgress=(label,percent)=>{
    setGlobalProgress(label,percent);
    updateBackupProgress(String(label),{
      current:String(label),
      detail:'DEVICE OPERATION · DO NOT DISCONNECT',
      percent:Number(percent)||0
    });
  };
  const reportDialogError=(message,error)=>{
    failBackup(error);
    // The dialog is above the global error layer. Opening a second, lower
    // modal here traps pointer/focus while hiding the actionable FAILED state.
    // Keep the error inside the active dialog and in technical logs instead.
    if(dialog.hidden)reportError(message,error);
    else{
      setStatus(String(message)+' '+String(error?.message||error));
      console.error(message,error);
    }
  };
  const setBaseDisabled=(button,value)=>{
    if(!button)return;
    button.dataset.baseDisabled=String(!!value);
    button.disabled=busy||!!value;
  };
  const setBusy=value=>{
    busy=!!value;
    for(const button of [
      backupProjectButton,backupProjectSamplesButton,backupDeviceButton,
      officialProjectButton,officialDeviceButton,
      restoreButton,recoveryRestoreButton,recoveryDownloadButton,recoveryDeleteButton
    ])if(button)button.disabled=busy||(button.dataset.baseDisabled==='true');
    if(closeButton)closeButton.disabled=busy;
    if(restoreInput)restoreInput.disabled=busy;
    if(pakPreviewInput)pakPreviewInput.disabled=busy;
    if(restoreProjectSelect)restoreProjectSelect.disabled=busy;
  };
  const open=async(mode='backup')=>{
    dialog.hidden=false;
    dialog.dataset.mode=mode;
    if(mode==='recovery')await refreshRecovery();
  };
  const close=()=>{
    if(busy)return; // Non-cancellable FILE_GET/restore cannot be interrupted by closing.
    dialog.hidden=true;
  };

  const readBackupSnapshot=async(scope,projectNumber=null)=>{
    assertBackupContinuing();
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('Connect an EP-series device first.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    const profile=getEpProjectProfile(info.sku,firmware);
    return withFileTransaction('backup snapshot',async fileOps=>{
      updateBackupProgress('PREPARING',{detail:'LISTING PROJECTS AND SOUNDS · READ ONLY',percent:0,current:'—'});
      const root=await fileOps.listDirectory(0,'/');
      assertBackupContinuing();
      const projectsRoot=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
      const soundsRoot=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      if(!projectsRoot)throw new Error('EP-series /projects node is unavailable.');
      const projectNodes=(await fileOps.listDirectory(projectsRoot.nodeId,'/projects'))
        .filter(item=>item.fileType==='folder'&&/^\/projects\/\d{2}$/.test(item.fileName))
        .sort((a,b)=>a.fileName.localeCompare(b.fileName));
      const activeMeta=await fileOps.getFileMetadata(projectsRoot.nodeId,'active');
      assertBackupContinuing();
      const activeFid=Number(activeMeta?.active)||null;
      const selected=projectNumber==null?null:safeProject(projectNumber);
      const nodes=scope==='device'
        ?projectNodes
        :projectNodes.filter(item=>item.fileName===`/projects/${selected}`);
      if(!nodes.length)throw new Error('Selected project is not available on the connected EP.');

      const soundNodes=soundsRoot
        ?await fileOps.listDirectory(soundsRoot.nodeId,'/sounds')
        :[];
      assertBackupContinuing();
      const occupied=soundNodes.map(item=>Number(item.nodeId)).filter(id=>id>=1&&id<=999);
      const projects=[];
      const referenced=new Set();
      updateBackupProgress('READING PROJECTS',{
        projectDone:0,projectTotal:nodes.length,sampleDone:0,sampleTotal:0,
        current:'—',detail:'PROJECT COUNT IS BASED ON COMPLETED FILES',percent:0
      });
      for(let index=0;index<nodes.length;index++){
        assertBackupContinuing();
        const node=nodes[index];
        updateBackupProgress('READING PROJECTS',{
          current:'P'+node.fileName.slice(-2)+'.tar',
          detail:'READING FILE '+(index+1)+'/'+nodes.length+' · DEVICE FILE_GET'
        });
        const file=await fileOps.getFile(node.nodeId);
        assertBackupContinuing(); // Drain current FILE_GET, then stop before the next file.
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
        updateBackupProgress('READING PROJECTS',{
          projectDone:projects.length,percent:35*projects.length/nodes.length,
          detail:'PROJECT '+projects.length+'/'+nodes.length+' COMPLETE'
        });
      }

      assertBackupContinuing();
      const sampleNodes=scope==='device'
        ?soundNodes.filter(item=>Number(item.nodeId)>=1&&Number(item.nodeId)<=999)
        :scope==='project+samples'
          ?soundNodes.filter(item=>referenced.has(Number(item.nodeId)))
          :[];
      if(scope==='project+samples'){
        const present=new Set(sampleNodes.map(item=>Number(item.nodeId)));
        const missing=[...referenced].filter(slot=>!present.has(slot));
        if(missing.length)throw new Error('Referenced sample(s) are missing: '+missing.map(pad).join(', '));
      }
      const samples=[];
      updateBackupProgress('READING SAMPLES',{
        sampleDone:0,sampleTotal:sampleNodes.length,
        current:'—',percent:35,detail:sampleNodes.length
          ?'READING '+sampleNodes.length+' SAMPLE FILES'
          :'NO SAMPLE FILES REQUIRED'
      });
      for(let index=0;index<sampleNodes.length;index++){
        assertBackupContinuing();
        const node=sampleNodes[index];
        const slot=pad(node.nodeId);
        updateBackupProgress('READING SAMPLES',{
          current:slot+' · '+String(node.fileName||'').split('/').pop(),
          detail:'SAMPLE '+(index+1)+'/'+sampleNodes.length+' · READING FILE'
        });
        let lastDecile=-1;
        const file=await fileOps.getFile(node.nodeId,(done,total)=>{
          const decile=total>0?Math.floor(done*10/total):-1;
          if(decile===lastDecile)return;
          lastDecile=decile;
          updateBackupProgress('READING SAMPLES',{
            detail:'SAMPLE '+(index+1)+'/'+sampleNodes.length+
              ' · CURRENT FILE '+(total?Math.floor(done*100/total)+'%':'READING')
          });
        });
        assertBackupContinuing();
        updateBackupProgress('READING SAMPLES',{
          detail:'SAMPLE '+(index+1)+'/'+sampleNodes.length+' · READING METADATA'
        });
        const metadata=await fileOps.getFileMetadata(node.nodeId);
        assertBackupContinuing();
        samples.push({
          slot:Number(node.nodeId),
          name:String(metadata?.name||file.name||node.fileName||('sample-'+pad(node.nodeId))),
          data:file.data.slice(),
          metadata:metadata||{}
        });
        updateBackupProgress('READING SAMPLES',{
          sampleDone:samples.length,
          percent:35+60*samples.length/Math.max(1,sampleNodes.length),
          detail:'SAMPLE '+samples.length+'/'+sampleNodes.length+' COMPLETE'
        });
      }
      assertBackupContinuing();
      return{
        info,profile,
        activeProject:projectNodes.find(node=>Number(node.nodeId)===activeFid)?.fileName?.slice(-2)||null,
        projects,samples
      };
    });
  };

  const runBackup=async(scope,format='speeduppercut')=>{
    // No project number is read before busy is established, including errors.
    if(busy)return;
    backupInProgress=true;
    cancelRequested=false;
    if(cancelBackupButton){
      cancelBackupButton.hidden=false;
      cancelBackupButton.disabled=false;
      cancelBackupButton.textContent='CANCEL BACKUP';
    }
    setBusy(true);
    backupProgress={phase:'PREPARING',projectDone:0,projectTotal:0,
      sampleDone:0,sampleTotal:0,current:'—',detail:'',percent:0};
    updateBackupProgress('PREPARING',{detail:'CHECKING CONNECTED DEVICE · READ ONLY'});
    try{
      const project=scope==='device'?null:safeProject(getSelectedProject());
      const snapshot=await readBackupSnapshot(scope,project);
      assertBackupContinuing();
      if(scope==='project'){
        const record=snapshot.projects[0];
        updateBackupProgress('BUILDING ARCHIVE',{
          current:'P'+project+'.tar',detail:'PREPARING PROJECT TAR FOR SAVE',percent:97
        });
        const blob=new Blob([record.data],{type:'application/x-tar'});
        assertBackupContinuing();
        backupInProgress=false;
        if(cancelBackupButton)cancelBackupButton.hidden=true;
        updateBackupProgress('DOWNLOAD HANDOFF',{detail:'REQUESTING FILE SAVE',percent:99});
        const outcome=await saveBlob(blob,'P'+project+'.tar');
        if(finishBackup(outcome))setStatus('BACKUP P'+project+' FILE WRITTEN');
      }else{
        updateBackupProgress('BUILDING ARCHIVE',{
          current:scope==='device'?'WHOLE DEVICE':'P'+project+' + SAMPLES',
          detail:'ASSEMBLING ZIP · ALL FILES READ',percent:97
        });
        const bundle=format==='official'
          ?await createOfficialEpPak({
            scope,device:snapshot.info,projects:snapshot.projects,samples:snapshot.samples
          })
          :await createEpBackupBundle({
            scope,device:snapshot.info,activeProject:snapshot.activeProject,
            projects:snapshot.projects,samples:snapshot.samples
          });
        assertBackupContinuing();
        const name=format==='official'
          ?(scope==='device'
            ?'KoTool_EP-133_device_'+dateStamp()+'.pak'
            :'KoTool_EP-133_P'+project+'_'+dateStamp()+'.ppak')
          :(scope==='device'
            ?'SpeedUpperCut_device_'+dateStamp()+'.zip'
            :'SpeedUpperCut_P'+project+'_samples_'+dateStamp()+'.zip');
        backupInProgress=false;
        if(cancelBackupButton)cancelBackupButton.hidden=true;
        updateBackupProgress('DOWNLOAD HANDOFF',{current:name,detail:'REQUESTING FILE SAVE',percent:99});
        const outcome=await saveBlob(bundle.blob,name);
        if(finishBackup(outcome))setStatus(
          scope==='device'
            ?'DEVICE BACKUP FILE WRITTEN · '+snapshot.projects.length+' PROJECTS · '+snapshot.samples.length+' SAMPLES'
            :'BACKUP P'+project+' FILE WRITTEN · '+snapshot.samples.length+' SAMPLES'
        );
      }
    }catch(error){
      if(error instanceof BackupCancelledError){
        updateBackupProgress('CANCELLED',{
          current:'NO FILE SAVED',
          detail:'CANCELLED BY USER · NO PARTIAL ARCHIVE OR DOWNLOAD',
        },'cancelled');
        setStatus('BACKUP CANCELLED · NO FILE SAVED');
        return;
      }
      failBackup(error);
      throw error;
    }finally{
      backupInProgress=false;
      cancelRequested=false;
      if(cancelBackupButton)cancelBackupButton.hidden=true;
      hideGlobalProgress();
      setBusy(false);
    }
  };
  const backupProject=()=>runBackup('project');
  const backupBundle=scope=>runBackup(scope);
  const backupOfficialProject=()=>runBackup('project+samples','official');
  const backupOfficialDevice=()=>runBackup('device','official');

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
    setBusy(true);setDialogProgress('READING BACKUP',15);
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
      updateBackupProgress('RESULT',{detail:'RESTORE PLAN READY · NO DEVICE WRITES'},'done');
    }finally{hideGlobalProgress();setBusy(false);}
  };

  const onOfficialPakPreview=async file=>{
    if(busy||!file)return;
    // Archive previews are never accepted as restoreSource/restorePlan.
    restoreSource=null;restorePlan=null;
    if(restoreInput)restoreInput.value='';
    if(restoreProjectSelect){restoreProjectSelect.innerHTML='';restoreProjectSelect.hidden=true;}
    renderRestorePlan(null);
    if(pakPreviewSummary){
      pakPreviewSummary.textContent='VALIDATING ZIP / WAV / TAR · READ ONLY';
      pakPreviewSummary.setAttribute('aria-busy','true');
    }
    setBusy(true);
    try{
      if(!/\.pp?ak$/i.test(String(file.name||'')))
        throw new Error('Select a .pak or .ppak archive.');
      if(file.size>128*1024*1024)
        throw new Error('PAK exceeds the 128 MiB read-only preview limit.');
      const raw=new Uint8Array(await file.arrayBuffer());
      const archive=await inspectOfficialPak(raw);
      const info=getConnectedDeviceInfo();
      if(!info)throw new Error('Connect and sync a supported EP to compare archive contents.');
      const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
      const archiveIdentity=String(archive.metadata.device_sku||'').toUpperCase();
      const archiveBase=String(archive.metadata.base_sku||'').toUpperCase();
      const deviceIdentity=String(info.identitySku||'').toUpperCase();
      const deviceBase=String(info.baseSku||info.metadata?.base_sku||'').toUpperCase();
      const identityMatch=archiveIdentity===deviceIdentity&&
        archiveBase===deviceBase&&archive.metadata.device_version===firmware;
      const occupancy=archive.sounds.map(sound=>{
        const slot=sampleStore?.getSlot?.(sound.slot);
        const occupied=!!slot?.file;
        return{sound,occupied};
      });
      const conflicts=occupancy.filter(x=>x.occupied).length;
      const free=occupancy.length-conflicts;
      const missing=archive.dependencies.flatMap(x=>x.missing.map(slot=>'P'+x.project+' → '+pad(slot)));
      const warnings=[...archive.warnings];
      if(!identityMatch)warnings.push('ARCHIVE SKU / BASE SKU / FIRMWARE DOES NOT MATCH CONNECTED EP');
      warnings.push('SLOT OCCUPANCY IS FROM CURRENT SYNCHRONIZED UI, NOT AUTHORITATIVE FILE READBACK.');
      warnings.push('DEVICE FREE SPACE AND PROTECTED/UNWRITABLE SLOTS ARE NOT VERIFIED.');
      const rows=[
        '<div class="ep-pak-report">',
        '<div class="ep-pak-row"><strong>FORMAT</strong><span>',archive.format.toUpperCase(),'</span></div>',
        '<div class="ep-pak-row"><strong>ARCHIVE SKU</strong><span>',escapeHtml(archiveIdentity),' / ',escapeHtml(archiveBase),'</span></div>',
        '<div class="ep-pak-row"><strong>FIRMWARE</strong><span>',escapeHtml(archive.metadata.device_version||'?'),'</span></div>',
        '<div class="ep-pak-row"><strong>CONNECTED DEVICE</strong><span>',identityMatch?'IDENTITY MATCH':'MISMATCH / UNVERIFIED','</span></div>',
        '<div class="ep-pak-row"><strong>PROJECTS</strong><span>',archive.projects.length,'</span></div>',
        '<div class="ep-pak-row"><strong>SAMPLES</strong><span>',archive.sounds.length,'</span></div>',
        '<div class="ep-pak-row"><strong>CANDIDATE EMPTY SLOTS</strong><span>',free,'</span></div>',
        '<div class="ep-pak-row"><strong>OCCUPIED / POTENTIAL CONFLICTS</strong><span>',conflicts,'</span></div>',
        '<div class="ep-pak-row"><strong>MISSING REFERENCED SAMPLES</strong><span>',missing.length,'</span></div>',
        '<strong>PROJECTS / PAD DEPENDENCIES</strong>',
        '<div class="ep-pak-inventory">',
        archive.projects.map(p=>{
          const m=archive.dependencies.find(d=>d.project===p.number);
          return '<div>P'+escapeHtml(p.number)+' · '+p.size+' B · '+p.padReferences.length+
            ' PAD ASSIGNMENTS · '+(m?.missing?.length||0)+' MISSING IN ARCHIVE</div>';
        }).join(''),
        '</div><strong>ARCHIVED SAMPLES · SLOT / NAME / DEVICE VIEW</strong>',
        '<div class="ep-pak-inventory">',
        occupancy.map(({sound,occupied})=>
          '<div>'+pad(sound.slot)+' · '+escapeHtml(sound.name)+' · '+
          sound.sampleFrames+' FRAMES · '+(occupied?'OCCUPIED · REVIEW':'EMPTY IN UI')+'</div>'
        ).join(''),
        '</div>',
        missing.length?'<div class="ep-pak-warning">MISSING PAD REFERENCES: '+
          escapeHtml(missing.join(', '))+'</div>':'',
        ...warnings.map(w=>'<div class="ep-pak-warning">'+escapeHtml(w)+'</div>'),
        '<div class="ep-pak-disabled">READ-ONLY PREVIEW · RESTORE FROM .PAK/.PPAK IS DISABLED. '+
        'NO MIDI WRITES. ANY FUTURE RESTORE NEEDS A SEPARATE VERIFIED PREFLIGHT AND OWNER APPROVAL.</div>',
        '</div>'
      ];
      if(pakPreviewSummary)pakPreviewSummary.innerHTML=rows.join('');
      updateBackupProgress('RESULT',{
        detail:'OFFICIAL ARCHIVE INSPECTED · READ ONLY · NO DEVICE WRITES',percent:100
      },'done');
    }catch(error){
      if(pakPreviewSummary)pakPreviewSummary.innerHTML=
        '<div class="ep-pak-error">PREVIEW REJECTED: '+escapeHtml(error.message||error)+
        '</div><div>NO DEVICE WRITE PERFORMED.</div>';
      updateBackupProgress('RESULT',{detail:String(error?.message||error)},'failed');
    }finally{
      if(pakPreviewSummary)pakPreviewSummary.setAttribute('aria-busy','false');
      setBusy(false);
    }
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
          setDialogProgress('RESTORE SAMPLE '+pad(item.slot),((index+.1)/plan.restore.length)*70);
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
    setBusy(true);setDialogProgress('RESTORE PRECHECK',5);
    let addedSamples=[];
    try{
      if(restorePlan.kind==='bundle'){
        const latest=await authoritativeBundlePlan(restorePlan.bundle,project);
        if(!latest.canRestore)throw new Error('Restore preflight changed. Resolve conflicts and retry.');
        addedSamples=await restoreSamples(latest);
        const target=restorePlan.bundle.projects.find(item=>item.number===project);
        setDialogProgress('RESTORE PROJECT P'+project,78);
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
        setDialogProgress('RESTORE PROJECT P'+project,40);
        await uploadProjectArchive(restorePlan.file,{requireInactive:true,performReload:false});
      }
      setDialogProgress('VERIFYING RESTORE',96);
      await readDevice();
      await refreshProjects();
      setStatus('RESTORE P'+project+' VERIFIED');
      updateBackupProgress('RESULT',{detail:'RESTORE P'+project+' VERIFIED',percent:100},'done');
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
    setBusy(true);setDialogProgress('RECOVERY RESTORE',15);
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
  cancelBackupButton?.addEventListener('click',requestBackupCancellation);
  backupProjectButton?.addEventListener('click',()=>backupProject().catch(error=>reportDialogError('PROJECT BACKUP FAILED.',error)));
  backupProjectSamplesButton?.addEventListener('click',()=>backupBundle('project+samples').catch(error=>reportDialogError('PROJECT + SAMPLES BACKUP FAILED.',error)));
  backupDeviceButton?.addEventListener('click',()=>backupBundle('device').catch(error=>reportDialogError('DEVICE BACKUP FAILED.',error)));
  officialProjectButton?.addEventListener('click',()=>backupOfficialProject().catch(error=>reportDialogError('OFFICIAL PROJECT PPAK EXPORT FAILED.',error)));
  officialDeviceButton?.addEventListener('click',()=>backupOfficialDevice().catch(error=>reportDialogError('OFFICIAL DEVICE PAK EXPORT FAILED.',error)));
  restoreInput?.addEventListener('change',()=>onRestoreFile(restoreInput.files?.[0]||null).catch(error=>reportDialogError('RESTORE PREFLIGHT FAILED.',error)));
  pakPreviewInput?.addEventListener('change',()=>onOfficialPakPreview(pakPreviewInput.files?.[0]||null));
  restoreProjectSelect?.addEventListener('change',async()=>{
    if(restoreSource?.kind!=='bundle')return;
    try{
      const project=restoreProjectSelect.value;
      const plan=await authoritativeBundlePlan(restoreSource.bundle,project);
      restorePlan={kind:'bundle',bundle:restoreSource.bundle,project,plan};
      renderRestorePlan(restorePlan);
    }catch(error){reportDialogError('RESTORE PREFLIGHT FAILED.',error);}
  });
  restoreButton?.addEventListener('click',()=>executeRestore().catch(error=>reportDialogError('RESTORE FAILED.',error)));
  recoveryRestoreButton?.addEventListener('click',()=>restoreRecovery().catch(error=>reportDialogError('RECOVERY RESTORE FAILED.',error)));
  recoveryDownloadButton?.addEventListener('click',()=>downloadRecovery().catch(error=>reportDialogError('RECOVERY DOWNLOAD FAILED.',error)));
  recoveryDeleteButton?.addEventListener('click',()=>deleteRecovery().catch(error=>reportDialogError('RECOVERY DELETE FAILED.',error)));

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
