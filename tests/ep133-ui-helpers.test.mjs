import test from 'node:test';
import assert from 'node:assert/strict';
import{createFeedbackController}from '../js/ep133/ui/feedback.js';
import{createFileEventController}from '../js/ep133/ui/fileEvents.js';
import{createConnectionLifecycle}from '../js/ep133/ui/connectionLifecycle.js';
import{createSampleLibrarySyncController}from '../js/ep133/ui/sampleLibrarySync.js';
import{createSamplePropertiesController}from '../js/ep133/ui/samplePropertiesController.js';
import{createSampleReadController,sampleDownloadName}from '../js/ep133/ui/sampleReadController.js';
import{createSampleDeleteController}from '../js/ep133/ui/sampleDeleteController.js';
import{createSampleUploadController}from '../js/ep133/ui/sampleUploadController.js';
import{createSampleMoveController}from '../js/ep133/ui/sampleMoveController.js';
import{createSampleCopyController}from '../js/ep133/ui/sampleCopyController.js';
import{createSampleStore}from '../js/ep133/sampleStore.js';
import{getSoundsParentId,buildFileItemFromInfo,buildProvisionalUploadedFileItem,soundSlotIds}from '../js/ep133/ui/fileModel.js';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE,
  TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_MOVED
}from '../js/ep133/constants.js';

const fakeElement=()=>({
  hidden:true,textContent:'',style:{width:''},focused:false,listeners:new Map(),
  focus(){this.focused=true;},
  addEventListener(type,listener){this.listeners.set(type,listener);}
});

test('extracted My EP feedback controller preserves progress and confirm behavior',async()=>{
  const globalProgress=fakeElement(),globalProgressLabel=fakeElement(),globalProgressFill=fakeElement(),globalProgressText=fakeElement();
  const confirmDialog=fakeElement(),confirmMessage=fakeElement(),confirmOk=fakeElement(),confirmCancel=fakeElement();
  const controller=createFeedbackController({
    globalProgress,globalProgressLabel,globalProgressFill,globalProgressText,
    confirmDialog,confirmMessage,confirmOk,confirmCancel
  });
  controller.setGlobalProgress('upload',42.4);
  assert.equal(globalProgress.hidden,false);
  assert.equal(globalProgressLabel.textContent,'UPLOAD');
  assert.equal(globalProgressFill.style.width,'42.4%');
  assert.equal(globalProgressText.textContent,'42%');
  controller.hideGlobalProgress();
  assert.equal(globalProgress.hidden,true);
  assert.equal(globalProgressFill.style.width,'0%');
  assert.equal(globalProgressText.textContent,'0%');

  const pending=controller.confirmAction('DELETE?');
  assert.equal(confirmMessage.textContent,'DELETE?');
  assert.equal(confirmDialog.hidden,false);
  assert.equal(confirmOk.focused,true);
  confirmOk.listeners.get('click')();
  assert.equal(await pending,true);
  assert.equal(confirmDialog.hidden,true);
});

test('extracted My EP file model preserves FILE_INFO capability mapping',()=>{
  const flags=TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ|TE_SYSEX_FILE_CAPABILITY_WRITE|
    TE_SYSEX_FILE_CAPABILITY_DELETE|TE_SYSEX_FILE_CAPABILITY_MOVE|TE_SYSEX_FILE_CAPABILITY_PLAYBACK;
  const deviceFiles=[{nodeId:42,fileName:'/sounds',fileType:'folder'}];
  const item=buildFileItemFromInfo({nodeId:7,parentId:42,fileSize:1234,fileName:'kick',flags},deviceFiles);
  assert.deepEqual(item,{
    nodeId:7,flags,fileSize:1234,fileName:'/sounds/kick',fileType:'file',
    isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true
  });
  assert.equal(buildFileItemFromInfo({nodeId:8,parentId:999,fileSize:1,fileName:'orphan',flags},deviceFiles),null);
  assert.equal(getSoundsParentId(deviceFiles),42);
  assert.deepEqual([...soundSlotIds([item])],[7]);
});

test('provisional upload file model stays conservative until FILE_INFO hydration',()=>{
  const deviceFiles=[{nodeId:42,fileName:'/sounds',fileType:'folder'}];
  const normalizeFileName=name=>String(name).replace(/\.wav$/i,'').toLowerCase();
  const item=buildProvisionalUploadedFileItem(
    {nodeId:9,parentId:42,fileSize:2048,fileName:'SNARE.wav'},
    {deviceFiles,normalizeFileName}
  );
  assert.equal(item.fileName,'/sounds/snare');
  assert.equal(item.isReadable,true);
  assert.equal(item.isWritable,false);
  assert.equal(item.isDeletable,false);
  assert.equal(item.isMovable,false);
  assert.equal(item.isPlayable,false);
});

test('FILE event controller suppresses active uploads and incrementally reconciles external additions',async()=>{
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:42,fileName:'/sounds',fileType:'folder'}]);
  let infoReads=0,metadataReads=0;
  const controller=createFileEventController({
    isConnected:()=>true,
    sampleStore,
    getSoundsParentId:()=>42,
    getSoundsMetadata:()=>({}),
    getCurrentPropertySlotId:()=>null,
    getFileInfo:async id=>{infoReads++;return{nodeId:id,parentId:42,fileSize:100,fileName:'kick',flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ};},
    getFileMetadata:async()=>{metadataReads++;return{name:'kick',channels:1,samplerate:46875,format:'s16'};},
    fileItemFromInfo:info=>buildFileItemFromInfo(info,sampleStore.getFiles()),
    applySoundsMetadata(){},renderProperties(){},renderDeviceStats(){},closeProperties(){},logTechnical(){}
  });

  controller.markUploadPending(7);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_ADDED,data:{nodeId:7}});
  assert.equal(infoReads,0);
  assert.equal(metadataReads,0);

  controller.clearUploadPending(7);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_ADDED,data:{nodeId:7}});
  assert.equal(infoReads,1);
  assert.equal(metadataReads,1);
  assert.equal(sampleStore.getSlot(7).meta.name,'kick');
});

test('FILE event controller ignores suppressed native moves and reconciles external moves without full resync',async()=>{
  const oldItem={
    nodeId:7,fileName:'/sounds/old',fileSize:100,fileType:'file',
    flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ,isReadable:true
  };
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:42,fileName:'/sounds',fileType:'folder'},oldItem]);
  sampleStore.setMetadata(7,{name:'old'});
  let infoReads=0;
  const controller=createFileEventController({
    isConnected:()=>true,
    sampleStore,
    getSoundsParentId:()=>42,
    getSoundsMetadata:()=>({}),
    getCurrentPropertySlotId:()=>null,
    getFileInfo:async id=>{infoReads++;return{nodeId:id,parentId:42,fileSize:100,fileName:'moved',flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ};},
    getFileMetadata:async()=>({name:'moved'}),
    fileItemFromInfo:info=>buildFileItemFromInfo(info,sampleStore.getFiles()),
    applySoundsMetadata(){},renderProperties(){},renderDeviceStats(){},closeProperties(){},logTechnical(){}
  });

  controller.suppressNativeMoveEvent(7,8);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_MOVED,data:{oldNodeId:7,parentId:42,nodeId:8}});
  assert.equal(infoReads,0);

  controller.clearNativeMoveSuppression(7,8);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_MOVED,data:{oldNodeId:7,parentId:42,nodeId:8}});
  assert.equal(infoReads,1);
  assert.equal(sampleStore.getSlot(7).file,null);
  assert.equal(sampleStore.getSlot(8).meta.name,'moved');
});

test('connection lifecycle does not request MIDI until armed and keeps reconnect cadence gated',async()=>{
  let connectCalls=0,intervalCallback=null,intervalMs=null,cleared=null;
  const beforeUnload=[];
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{connectCalls++;},
    isConnected:()=>false,
    isUnsafe:()=>false,
    navigatorRef:{},
    windowRef:{addEventListener:(type,listener)=>{if(type==='beforeunload')beforeUnload.push(listener);}},
    setIntervalFn:(callback,ms)=>{intervalCallback=callback;intervalMs=ms;return 77;},
    clearIntervalFn:id=>{cleared=id;}
  });
  lifecycle.start();
  assert.equal(intervalMs,4000);
  await lifecycle.autoConnect();
  assert.equal(connectCalls,0);
  intervalCallback();
  await Promise.resolve();
  assert.equal(connectCalls,0);

  lifecycle.arm();
  await lifecycle.autoConnect();
  assert.equal(connectCalls,1);
  assert.equal(lifecycle.getState().connectionArmed,true);
  lifecycle.dispose();
  assert.equal(cleared,77);
  assert.equal(beforeUnload.length,1);
});

test('connection lifecycle blocks repeated MIDI permission failures',async()=>{
  let connectCalls=0;
  const errors=[];
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{
      connectCalls++;
      const error=new Error('permission denied');
      error.name='NotAllowedError';
      throw error;
    },
    isConnected:()=>false,
    isUnsafe:()=>false,
    navigatorRef:{},
    windowRef:{addEventListener(){}},
    setIntervalFn:()=>1,
    clearIntervalFn(){},
    showError:message=>errors.push(message)
  });
  lifecycle.start();
  lifecycle.arm();
  await lifecycle.autoConnect();
  await lifecycle.autoConnect();
  assert.equal(connectCalls,1);
  assert.deepEqual(errors,['MIDI ACCESS DENIED. ALLOW SYSEX AND RELOAD.']);
  assert.equal(lifecycle.getState().midiPermissionBlocked,true);
});


test('sample library sync exposes LIST results before uncached metadata hydration completes',async()=>{
  let synchronized=false,metadataHydrating=false;
  let resolveUncached;
  const uncachedMetadata=new Promise(resolve=>{resolveUncached=resolve;});
  const tabs=[];
  const memory={
    getSelected:()=>({id:2}),
    getActiveTab:()=>0,
    setTabs:value=>{tabs.splice(0,tabs.length,...value);}
  };
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([
    {nodeId:1000,fileName:'/sounds',fileType:'folder',fileSize:0},
    {nodeId:2,fileName:'/sounds/cached',fileType:'file',fileSize:20}
  ]);
  sampleStore.setMetadata(2,{name:'cached',channels:1,samplerate:46875,format:'s16'});
  const listCalls=[];
  const controller=createSampleLibrarySyncController({
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({fallbackTabs:[{name:'ALL',range:[1,999]}]}),
    sampleStore,
    listDirectory:async(nodeId,path)=>{
      listCalls.push([nodeId,path]);
      if(nodeId===0)return[{nodeId:1000,fileName:'/sounds',fileType:'folder',fileSize:0}];
      return[
        {nodeId:2,fileName:'/sounds/cached',fileType:'file',fileSize:20},
        {nodeId:5,fileName:'/sounds/live',fileType:'file',fileSize:50}
      ];
    },
    getFileMetadata:async nodeId=>{
      if(nodeId===1000)return{
        formats:[{type:'pcm',formats:[{format:'s16',channels:[1,2]}]}],
        tabs:[{name:'BANK',range:[1,99]}]
      };
      if(nodeId===5)return uncachedMetadata;
      throw new Error('unexpected metadata node '+nodeId);
    },
    setSynchronized:value=>{synchronized=value;},
    setMetadataHydrating:value=>{metadataHydrating=value;},
    updateMutationAvailability(){},
    closeProperties(){},
    setGlobalProgress(){},
    hideGlobalProgress(){},
    renderDeviceStats(){},
    setStatus(){},
    reportError(message,error){throw new Error(message+' '+error.message);},
    logTechnical(){},
    scheduleHide:callback=>callback()
  });

  const pending=controller.readDevice();
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(synchronized,true);
  assert.equal(metadataHydrating,true);
  assert.equal(sampleStore.getSoundsParentId(),1000);
  assert.deepEqual(listCalls,[[0,'/'],[1000,'/sounds']]);
  assert.equal(sampleStore.getSlot(2).meta.name,'cached');
  assert.equal(sampleStore.getSlot(2).verification.metadata,'cached');
  assert.equal(sampleStore.getSlot(5).meta,null);
  assert.equal(sampleStore.getFiles().length,3);
  assert.equal(sampleStore.getSoundFormats().length,1);
  assert.equal(sampleStore.getSoundsMetadata().tabs[0].name,'BANK');
  assert.equal(tabs[0].name,'BANK');

  resolveUncached({name:'live',channels:2,samplerate:32000,format:'s16'});
  await pending;

  assert.equal(metadataHydrating,false);
  assert.equal(synchronized,true);
  assert.equal(sampleStore.getSlot(5).meta.name,'live');
  assert.equal(sampleStore.getSlot(5).verification.metadata,'verified');
});

test('sample library sync fails closed when the /sounds node is missing',async()=>{
  let synchronized=true,metadataHydrating=true,reported='';
  const memory={getSelected:()=>null,getActiveTab:()=>0,setTabs(){}};
  const sampleStore=createSampleStore();
  const controller=createSampleLibrarySyncController({
    captureBatchSession:()=> 'session-a',
    assertBatchSession(){},
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({fallbackTabs:[{name:'ALL',range:[1,999]}]}),
    sampleStore,
    listDirectory:async()=>[],
    getFileMetadata:async()=>({}),
    setSynchronized:value=>{synchronized=value;},
    setMetadataHydrating:value=>{metadataHydrating=value;},
    updateMutationAvailability(){},closeProperties(){},setGlobalProgress(){},hideGlobalProgress(){},
    renderDeviceStats(){},setStatus(){},
    reportError:message=>{reported=message;},
    logTechnical(){},
    scheduleHide:callback=>callback()
  });
  await controller.readDevice();
  assert.equal(synchronized,false);
  assert.equal(metadataHydrating,false);
  assert.equal(reported,'COULD NOT READ EP SAMPLE LIBRARY.');
});

test('sample properties controller debounces optimistic writes and confirms playmode with release',async()=>{
  const timers=[],writes=[];
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{'sound.playmode':'oneshot','envelope.release':44});
  const controller=createSamplePropertiesController({
    properties:null,propertiesGrid:null,sampleStore,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async(id,payload)=>writes.push({id,payload:{...payload}}),
    getFileMetadata:async()=>({'sound.playmode':'key','envelope.release':44,channels:1,samplerate:46875,format:'s16'}),
    showError(){},logTechnical(){},
    setTimeoutFn:callback=>{timers.push(callback);return timers.length;},clearTimeoutFn(){},debounceMs:120
  });
  controller.scheduleWrite(sampleStore.getSlot(7),'sound.playmode','key');
  assert.equal(sampleStore.getSlot(7).meta['sound.playmode'],'key');
  assert.equal(sampleStore.getSlot(7).verification.metadata,'provisional');
  assert.equal(controller.hasPendingWrites(),true);
  await timers.shift()();
  assert.deepEqual(writes,[{id:7,payload:{'sound.playmode':'key','envelope.release':44}}]);
  assert.equal(controller.hasPendingWrites(),false);
  assert.equal(sampleStore.getSlot(7).meta['sound.playmode'],'key');
  assert.equal(sampleStore.getSlot(7).verification.metadata,'verified');
});

test('sample properties controller restores authoritative metadata after failed verification',async()=>{
  const timers=[],errors=[],technical=[];let reads=0;
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:9,fileName:'/sounds/snare',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(9,{'sound.pitch':0});
  const controller=createSamplePropertiesController({
    properties:null,propertiesGrid:null,sampleStore,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async()=>{},
    getFileMetadata:async()=>{reads+=1;return{'sound.pitch':0,channels:1,samplerate:46875,format:'s16'};},
    showError:message=>errors.push(message),
    logTechnical:(label,error)=>technical.push([label,String(error?.message||error)]),
    setTimeoutFn:callback=>{timers.push(callback);return timers.length;},clearTimeoutFn(){},debounceMs:120
  });
  controller.scheduleWrite(sampleStore.getSlot(9),'sound.pitch',1);
  assert.equal(sampleStore.getSlot(9).meta['sound.pitch'],1);
  await timers.shift()();
  assert.equal(reads,2);
  assert.equal(sampleStore.getSlot(9).meta['sound.pitch'],0);
  assert.equal(sampleStore.getSlot(9).verification.metadata,'verified');
  assert.equal(controller.getPendingCount(),0);
  assert.deepEqual(errors,['COULD NOT UPDATE SAMPLE PROPERTY.']);
  assert.match(technical[0][0],/PROPERTY sound\.pitch/);
});

test('sample properties controller owns open-slot state and remaps it after native MOVE',()=>{
  const grid={innerHTML:'',addEventListener(){}};
  const panel={hidden:true,style:{left:'',top:''},getBoundingClientRect:()=>({width:120,height:100})};
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{'sound.pitch':0});
  const controller=createSamplePropertiesController({
    properties:panel,propertiesGrid:grid,sampleStore,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async()=>{},getFileMetadata:async()=>({}),showError(){},logTechnical(){},
    documentRef:{addEventListener(){},removeEventListener(){}},windowRef:{innerWidth:800,innerHeight:600}
  });
  controller.open(sampleStore.getSlot(7),{clientX:20,clientY:30});
  assert.equal(panel.hidden,false);assert.equal(controller.getCurrentSlotId(),7);
  controller.remapCurrentSlot(7,18);assert.equal(controller.getCurrentSlotId(),18);
  controller.close();assert.equal(controller.getCurrentSlotId(),null);assert.equal(panel.hidden,true);
});

test('sample read controller stops the active preview before starting the next sample',async()=>{
  const actions=[];
  const preview=[];
  let timerId=0;
  const activeTimers=new Set();
  const memory={setPreviewing:id=>preview.push(id)};
  const controller=createSampleReadController({
    getMemory:()=>memory,
    isConnected:()=>true,
    startPlayback:async(id,enabled)=>actions.push(['start',id,enabled]),
    stopPlayback:async id=>actions.push(['stop',id]),
    reportError:(message,error)=>{throw new Error(message+' '+error?.message);},
    setTimeoutFn:()=>{const id=++timerId;activeTimers.add(id);return id;},
    clearTimeoutFn:id=>{actions.push(['clear',id]);activeTimers.delete(id);}
  });

  const first={id:7,nodeId:7,file:{name:'kick'}};
  const second={id:8,nodeId:8,file:{name:'snare'}};
  await controller.audition(first);
  assert.equal(controller.getPlayingNodeId(),7);
  await controller.audition(second);

  assert.deepEqual(actions,[
    ['start',7,true],
    ['clear',1],
    ['stop',7],
    ['start',8,true]
  ]);
  assert.deepEqual(preview,[7,null,8]);
  assert.equal(controller.getPlayingNodeId(),8);
});

test('sample read controller downloads selections sequentially as individual WAV files under one session guard',async()=>{
  const actions=[];
  const downloads=[];
  const progress=[];
  let hidden=0;
  const slots=[
    {id:1,nodeId:1,file:{name:'kick.raw'},meta:{name:'Kick One.wav',channels:1,samplerate:46875,format:'s16'}},
    {id:2,nodeId:2,file:{name:'snare.raw'},meta:null}
  ];
  const anchor={
    href:'',download:'',
    click(){downloads.push(this.download);},
    remove(){}
  };
  const controller=createSampleReadController({
    getMemory:()=>({}),
    isConnected:()=>true,
    getFile:async(id,onProgress)=>{
      actions.push(['get',id]);
      onProgress?.(2,4);
      return{name:id===1?'wire-kick':'wire-snare',data:Uint8Array.from([id,id+1])};
    },
    getFileMetadata:async id=>{
      actions.push(['meta',id]);
      return{name:'Snare Two.wav',channels:1,samplerate:46875,format:'s16'};
    },
    captureBatchSession:()=>{actions.push(['capture']);return'session-a';},
    assertBatchSession:token=>actions.push(['assert',token]),
    setGlobalProgress:(label,value)=>progress.push([label,value]),
    hideGlobalProgress:()=>{hidden++;},
    createWav:async(bytes,options)=>{
      actions.push(['wav',bytes[0],options.name]);
      return{bytes:[...bytes],options};
    },
    documentRef:{
      createElement:tag=>{assert.equal(tag,'a');return anchor;},
      body:{appendChild(){}}
    },
    urlApi:{
      createObjectURL:blob=>'blob:'+blob.bytes[0],
      revokeObjectURL:url=>actions.push(['revoke',url])
    },
    windowRef:{},
    setTimeoutFn:callback=>{callback();return 1;}
  });

  await controller.downloadMany(slots);

  assert.deepEqual(actions.slice(0,8),[
    ['capture'],
    ['assert','session-a'],
    ['get',1],
    ['wav',1,'wire-kick'],
    ['revoke','blob:1'],
    ['assert','session-a'],
    ['get',2],
    ['meta',2]
  ]);
  assert.deepEqual(downloads,['Kick One.wav','snare.wav']);
  assert.equal(hidden,1);
  assert.equal(progress.at(-1)[1],100);
});

test('sample read controller uses the save picker for a single download and sanitizes the filename',async()=>{
  const writes=[];
  let fallbackUrls=0,hidden=0;
  const slot={id:3,nodeId:3,file:{name:'bad/name.raw'},meta:{name:'Bad/Name?.wav',channels:1,samplerate:46875,format:'s16'}};
  assert.equal(sampleDownloadName(slot,{name:'ignored'}),'Bad_Name_.wav');

  const controller=createSampleReadController({
    getMemory:()=>({}),
    isConnected:()=>true,
    getFile:async()=>({name:'wire',data:Uint8Array.from([3,4])}),
    getFileMetadata:async()=>slot.meta,
    setGlobalProgress(){},
    hideGlobalProgress:()=>{hidden++;},
    createWav:async()=>({wav:true}),
    windowRef:{
      showSaveFilePicker:async options=>{
        writes.push(['picker',options.suggestedName]);
        return{createWritable:async()=>({
          write:async blob=>writes.push(['write',blob.wav]),
          close:async()=>writes.push(['close'])
        })};
      }
    },
    documentRef:{createElement(){throw new Error('fallback download should not run');},body:{appendChild(){}}},
    urlApi:{createObjectURL(){fallbackUrls++;return'blob:x';},revokeObjectURL(){}}
  });

  const result=await controller.downloadOne(slot);
  assert.equal(result.filename,'Bad_Name_.wav');
  assert.deepEqual(writes,[['picker','Bad_Name_.wav'],['write',true],['close']]);
  assert.equal(fallbackUrls,0);
  assert.equal(hidden,1);
});


test('sample delete controller preserves confirm preflight event-sync and authoritative LIST verification order',async()=>{
  const actions=[];const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true},{nodeId:8,fileName:'/sounds/snare',fileType:'file',fileSize:200,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{name:'kick',crc:111});sampleStore.setMetadata(8,{name:'snare',crc:222});
  const targets=[sampleStore.getSlot(7),sampleStore.getSlot(8)];
  const controller=createSampleDeleteController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({free_space_in_bytes:123}),
    isConnected:()=>true,isSynchronized:()=>true,hasPendingPropertyWrites:()=>false,
    confirmAction:async message=>{actions.push(['confirm',message]);return true;},
    captureBatchSession:()=>{actions.push(['capture']);return'session-a';},
    assertBatchSession:token=>actions.push(['assert',token]),getDeviceSessionToken:()=> 'session-a',
    setMutating:value=>actions.push(['mutating',value]),setGlobalProgress:(label,value)=>actions.push(['progress',label,value]),hideGlobalProgress:()=>actions.push(['hide']),
    getFileInfo:async id=>{actions.push(['info',id]);return{nodeId:id,parentId:1000,fileSize:id===7?100:200};},
    getFileMetadata:async id=>{actions.push(['metadata',id]);return{name:id===7?'kick':'snare',crc:id===7?111:222};},
    deleteFile:async id=>actions.push(['delete',id]),
    waitForMetadataUpdate:nodeId=>{actions.push(['wait-metadata',nodeId]);return Promise.resolve({data:{metadata:{free_space_in_bytes:456}}});},
    syncMetadataAfterMutation:async(nodeId,eventPromise)=>{await eventPromise;actions.push(['sync-metadata',nodeId]);},
    assertSlotsDeleted:async ids=>actions.push(['verify-list',...ids]),
    renderDeviceStats:(metadata,count)=>actions.push(['stats',metadata.free_space_in_bytes,count]),
    readDevice:async()=>actions.push(['resync']),logTechnical(){}
  });
  assert.equal(await controller.deleteSamples(targets),true);
  assert.equal(sampleStore.getSlot(7).file,null);assert.equal(sampleStore.getSlot(8).file,null);
  assert.deepEqual(actions.filter(item=>item[0]==='delete'),[['delete',7],['delete',8]]);
  assert.deepEqual(actions.filter(item=>item[0]==='verify-list'),[['verify-list',7,8]]);
  const info7=actions.findIndex(item=>item[0]==='info'&&item[1]===7);
  const metadata7=actions.findIndex(item=>item[0]==='metadata'&&item[1]===7);
  const delete7=actions.findIndex(item=>item[0]==='delete'&&item[1]===7);
  const sync7=actions.findIndex(item=>item[0]==='sync-metadata');
  assert.ok(info7>=0&&metadata7>info7&&delete7>metadata7&&sync7>delete7);
});

test('sample delete controller refuses a changed target before FILE_DELETE and resyncs the same session',async()=>{
  let deleteCalls=0,resyncCalls=0;const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);sampleStore.setMetadata(7,{name:'kick',crc:111});
  const controller=createSampleDeleteController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),isConnected:()=>true,isSynchronized:()=>true,
    hasPendingPropertyWrites:()=>false,confirmAction:async()=>true,captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    getFileInfo:async()=>({nodeId:7,parentId:1000,fileSize:101}),getFileMetadata:async()=>({name:'kick',crc:111}),
    deleteFile:async()=>{deleteCalls++;},waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>{},assertSlotsDeleted:async()=>{},
    renderDeviceStats(){},readDevice:async()=>{resyncCalls++;},logTechnical(){}
  });
  await assert.rejects(()=>controller.deleteSamples([sampleStore.getSlot(7)]),/Sample slot changed before delete/);
  assert.equal(deleteCalls,0);assert.equal(resyncCalls,1);assert.ok(sampleStore.getSlot(7).file);
});

test('sample delete controller blocks deletion while a property write is pending and respects cancel',async()=>{
  let confirms=0,deletes=0,mutations=0;const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);sampleStore.setMetadata(7,{name:'kick'});
  const base={
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),isConnected:()=>true,isSynchronized:()=>true,
    captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating:()=>{mutations++;},setGlobalProgress(){},hideGlobalProgress(){},
    getFileInfo:async()=>({nodeId:7,parentId:1000,fileSize:100}),getFileMetadata:async()=>({name:'kick'}),
    deleteFile:async()=>{deletes++;},waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},renderDeviceStats(){},readDevice:async()=>{},logTechnical(){}
  };
  const pending=createSampleDeleteController({...base,hasPendingPropertyWrites:()=>true,confirmAction:async()=>{confirms++;return true;}});
  await assert.rejects(()=>pending.deleteSamples([sampleStore.getSlot(7)]),/pending sample property write/);
  assert.equal(confirms,0);assert.equal(deletes,0);
  const cancelled=createSampleDeleteController({...base,hasPendingPropertyWrites:()=>false,confirmAction:async()=>{confirms++;return false;}});
  assert.equal(await cancelled.deleteSamples([sampleStore.getSlot(7)]),false);
  assert.equal(confirms,1);assert.equal(deletes,0);assert.equal(mutations,0);
});

test('sample upload controller batches one preflight and commits provisional metadata without blocking readback',async()=>{
  const actions=[],timers=[],sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:1,fileName:'/sounds/occupied',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true},{nodeId:3,fileName:'/sounds/occupied3',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  let soundsMetadata={free_space_in_bytes:100};let transactionCalls=0,preflights=0,refreshCalls=0;
  const uploaded=[],pending=[];const memory={selectSlots:(ids,options)=>actions.push(['select',[...ids],options.activeId])};
  const uploadSampleToSlot=async options=>{uploaded.push(options.destinationId);options.onCreated?.(options.destinationId);options.onProgress?.(options.data.byteLength,options.data.byteLength);return options.destinationId;};
  const deleteFile=async()=>{};
  const controller=createSampleUploadController({
    sampleStore,getMemory:()=>memory,getSoundsParentId:()=>1000,getSoundFormats:()=>[{type:'pcm'}],getSoundsMetadata:()=>soundsMetadata,
    setSoundsMetadata:value=>{soundsMetadata=value;actions.push(['free',value.free_space_in_bytes]);},
    getActiveDeviceProfile:()=>({playModes:['oneshot','key','legato'],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,captureBatchSession:()=> 'session-a',assertBatchSession:token=>assert.equal(token,'session-a'),
    setMutating:value=>actions.push(['mutating',value]),setGlobalProgress(){},hideGlobalProgress:()=>actions.push(['hide']),
    withFileTransaction:async(label,op,options)=>{
      transactionCalls++;assert.equal(label,'sample upload batch');assert.equal(options.strict,true);
      return op({uploadSampleToSlot,deleteFile});
    },assertSlotsEmpty:async ids=>{preflights++;assert.deepEqual(ids,[2,4]);},
    refreshSoundsRuntimeMetadata:async()=>{refreshCalls++;return soundsMetadata;},
    uploadSampleToSlot,deleteFile,
    prepareSampleLocalMetadata:metadata=>({...metadata,local:true}),normalizeFileName:name=>String(name).replace(/\.wav$/i,'').toLowerCase(),
    fileItemFromInfo:()=>{throw new Error('hydrate should be deferred');},getFileInfo:async()=>{throw new Error('success path must not read FILE_INFO');},getFileMetadata:async()=>{throw new Error('success path must not read metadata');},
    renderDeviceStats(){},markUploadPending:id=>pending.push(['mark',id]),clearUploadPending:id=>pending.push(['clear',id]),
    waitForMetadataUpdate:()=>Promise.resolve(null),deleteFile:async()=>{},syncMetadataAfterMutation:async()=>{},assertSlotsDeleted:async()=>{},logTechnical(){},showError(){},
    prepareSample:async file=>({data:new Uint8Array(file.name.toLowerCase().startsWith('a')?10:20),channels:1,samplerate:46875,format:'s16',metadata:{'sound.pitch':-12}}),
    setTimeoutFn:(callback,delay)=>{timers.push({callback,delay});return timers.length;}
  });
  const result=await controller.uploadFilesToSlot(sampleStore.getSlot(1),[{name:'A.wav',type:'audio/wav'},{name:'B.wav',type:'audio/wav'}]);
  assert.deepEqual(result.successes,[2,4]);assert.deepEqual(uploaded,[2,4]);assert.equal(transactionCalls,1);assert.equal(preflights,1);
  assert.equal(soundsMetadata.free_space_in_bytes,70);
  assert.equal(sampleStore.getSlot(2).meta.name,'a');assert.equal(sampleStore.getSlot(4).meta.name,'b');
  assert.equal(sampleStore.getSlot(2).state,'provisional');assert.equal(sampleStore.getSlot(2).verification.metadata,'provisional');
  assert.deepEqual(timers.map(item=>item.delay),[250,900]);assert.equal(refreshCalls,1);
  assert.deepEqual(actions.find(item=>item[0]==='select'),['select',[2,4],2]);
});

test('sample upload controller rolls back a created slot through DELETE metadata sync and LIST verification',async()=>{
  const actions=[],sampleStore=createSampleStore();sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'}]);
  let shown='';
  const controller=createSampleUploadController({
    sampleStore,getMemory:()=>({selectSlots(){throw new Error('failed upload must not select');}}),
    getSoundsParentId:()=>1000,getSoundFormats:()=>[],getSoundsMetadata:()=>({free_space_in_bytes:100}),setSoundsMetadata(){},
    getActiveDeviceProfile:()=>({playModes:['oneshot','key','legato'],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,captureBatchSession:()=> 'session-a',assertBatchSession(){},
    setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    withFileTransaction:async(label,op,options)=>op({
      uploadSampleToSlot:async uploadOptions=>{uploadOptions.onCreated?.(2);throw new Error('simulated stream failure');},
      deleteFile:async id=>actions.push(['delete',id])
    }),
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:100}),
    uploadSampleToSlot:async()=>{throw new Error('public upload should not run');},
    prepareSampleLocalMetadata:x=>x,normalizeFileName:x=>x.toLowerCase(),fileItemFromInfo(){},getFileInfo:async()=>({}),getFileMetadata:async()=>({}),
    renderDeviceStats(){},markUploadPending(){},clearUploadPending(){},
    waitForMetadataUpdate:()=>Promise.resolve(null),deleteFile:async()=>{throw new Error('public delete should not run');},syncMetadataAfterMutation:async()=>actions.push(['sync']),
    assertSlotsDeleted:async ids=>actions.push(['verify',...ids]),logTechnical(){},showError:message=>{shown=message;},
    prepareSample:async()=>({data:new Uint8Array(10),channels:1,samplerate:46875,format:'s16',metadata:{}}),setTimeoutFn:()=>1
  });
  const result=await controller.uploadFilesToSlot({id:2},[{name:'Broken.wav',type:'audio/wav'}]);
  assert.equal(result.failures.length,1);assert.match(shown,/Broken\.wav/);
  assert.deepEqual(actions,[['delete',2],['sync'],['verify',2]]);
  assert.equal(sampleStore.getSlot(2).file,null);
});

test('sample upload controller rejects unsupported files and insufficient forward slots before mutating',async()=>{
  let mutations=0,batches=0;const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'}]);
  const base={
    sampleStore,getMemory:()=>({}),getSoundsParentId:()=>1000,getSoundFormats:()=>[],getSoundsMetadata:()=>({}),setSoundsMetadata(){},
    getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:false}),isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,
    captureBatchSession:()=> 'session-a',assertBatchSession(){},setMutating(){mutations++;},setGlobalProgress(){},hideGlobalProgress(){},
    withFileTransaction:async(label,op)=>{batches++;return op({uploadSampleToSlot:async()=>{},deleteFile:async()=>{}});},assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({}),
    uploadSampleToSlot:async()=>{},prepareSampleLocalMetadata:x=>x,normalizeFileName:x=>x,fileItemFromInfo(){},getFileInfo:async()=>({}),getFileMetadata:async()=>({}),
    renderDeviceStats(){},markUploadPending(){},clearUploadPending(){},waitForMetadataUpdate:()=>Promise.resolve(null),deleteFile:async()=>{},syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},logTechnical(){},showError(){},prepareSample:async()=>({})
  };
  const controller=createSampleUploadController(base);
  await assert.rejects(()=>controller.uploadFilesToSlot({id:999},[{name:'note.txt',type:'text/plain'}]),/No supported audio files/);
  await assert.rejects(()=>controller.uploadFilesToSlot({id:999},[{name:'one.wav',type:'audio/wav'},{name:'two.wav',type:'audio/wav'}]),/Not enough free sample slots/);
  assert.equal(mutations,0);assert.equal(batches,0);
});

test('sample move controller performs CRC-verified FILE_MOVE and remaps local state without PCM fallback',async()=>{
  const actions=[],sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{name:'kick',crc:123});
  const controller=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({free_space_in_bytes:50}),
    fileItemFromInfo:info=>({nodeId:Number(info.nodeId),fileName:'/sounds/'+info.fileName,fileType:'file',fileSize:Number(info.fileSize),isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}),
    remapCurrentPropertySlot:(oldId,newId)=>actions.push(['remap',oldId,newId]),renderDeviceStats(){},
    captureBatchSession:()=> 'session-a',assertBatchSession:token=>assert.equal(token,'session-a'),getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:(oldId,newId)=>{actions.push(['suppress',oldId,newId]);return()=>actions.push(['release',oldId,newId]);},
    clearNativeMoveSuppression:(oldId,newId)=>actions.push(['clear-suppress',oldId,newId]),
    moveFile:async(sourceId,parentId,targetId,options)=>{
      actions.push(['move',sourceId,parentId,targetId,options.verifyCrc]);
      return{oldFileId:sourceId,newFileId:targetId,sourceCrc:123,destinationCrc:123,crcVerified:true,info:{nodeId:targetId,fileName:'kick',fileSize:100},metadata:{name:'kick',crc:123}};
    },
    readDevice:async()=>actions.push(['resync']),logTechnical(){}
  });
  const source=sampleStore.getSlot(7);
  const result=await controller.nativeMoveTransfer([{sourceId:7,targetId:8}],new Map([[7,source]]));
  assert.deepEqual(result,{targetIds:[8]});
  assert.deepEqual(actions.find(item=>item[0]==='move'),['move',7,1000,8,true]);
  assert.equal(sampleStore.getSlot(7).file,null);
  assert.equal(sampleStore.getSlot(8).meta.name,'kick');
  assert.equal(sampleStore.getSlot(8).verification.file,'verified');
  assert.deepEqual(actions.find(item=>item[0]==='remap'),['remap',7,8]);
  assert.equal(actions.some(item=>item[0]==='resync'),false);
});

test('sample move controller rolls completed moves back in reverse order and resyncs after a later MOVE failure',async()=>{
  const actions=[],sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:7,fileName:'/sounds/one',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true},{nodeId:9,fileName:'/sounds/two',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{name:'one',crc:111});sampleStore.setMetadata(9,{name:'two',crc:222});
  const source7=sampleStore.getSlot(7),source9=sampleStore.getSlot(9);
  const controller=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    fileItemFromInfo:info=>({nodeId:info.nodeId,fileName:'/sounds/'+info.fileName,fileType:'file',fileSize:1}),
    remapCurrentPropertySlot(){},renderDeviceStats(){},captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:(oldId,newId)=>{actions.push(['suppress',oldId,newId]);return()=>actions.push(['release',oldId,newId]);},
    clearNativeMoveSuppression:(oldId,newId)=>actions.push(['clear-suppress',oldId,newId]),
    moveFile:async(sourceId,parentId,targetId,options)=>{
      actions.push(['move',sourceId,targetId,options.verifyCrc]);
      if(sourceId===7&&targetId===8)return{oldFileId:7,newFileId:8,sourceCrc:111,destinationCrc:111,crcVerified:true,info:{nodeId:8,fileName:'one',fileSize:1},metadata:{name:'one',crc:111}};
      if(sourceId===9&&targetId===10)throw new Error('second move failed');
      if(sourceId===8&&targetId===7)return{oldFileId:8,newFileId:7,sourceCrc:111,destinationCrc:111,crcVerified:true,info:{nodeId:7,fileName:'one',fileSize:1},metadata:{name:'one',crc:111}};
      throw new Error('unexpected move');
    },
    readDevice:async()=>actions.push(['resync']),logTechnical(){}
  });
  await assert.rejects(()=>controller.nativeMoveTransfer(
    [{sourceId:7,targetId:8},{sourceId:9,targetId:10}],
    new Map([[7,source7],[9,source9]])
  ),/second move failed/);
  assert.deepEqual(actions.filter(item=>item[0]==='move'),[['move',7,8,true],['move',9,10,true],['move',8,7,true]]);
  assert.equal(actions.filter(item=>item[0]==='resync').length,1);
  assert.equal(actions.some(item=>item[0]==='clear-suppress'&&item[1]===9&&item[2]===10),true);
});

test('sample move controller refuses an occupied destination before sending FILE_MOVE',async()=>{
  let moveCalls=0;const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/source',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true},{nodeId:8,fileName:'/sounds/occupied',fileType:'file',fileSize:1,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  const controller=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),fileItemFromInfo:()=>null,
    remapCurrentPropertySlot(){},renderDeviceStats(){},captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},suppressNativeMoveEvent:()=>()=>{},clearNativeMoveSuppression(){},
    moveFile:async()=>{moveCalls++;},readDevice:async()=>{},logTechnical(){}
  });
  const source=sampleStore.getSlot(7);
  await assert.rejects(()=>controller.nativeMoveTransfer([{sourceId:7,targetId:8}],new Map([[7,source]])),/Target sample slot is no longer empty/);
  assert.equal(moveCalls,0);
});

test('sample copy controller preserves GET metadata PUT sync FILE_INFO commit order',async()=>{
  const actions=[],sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:4,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  sampleStore.setMetadata(7,{name:'kick',crc:111});
  const source=sampleStore.getSlot(7);
  const controller=createSampleCopyController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({free_space_in_bytes:100}),
    getActiveDeviceProfile:()=>({playModes:['oneshot','key','legato'],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},assertSlotsEmpty:async ids=>actions.push(['empty',...ids]),
    refreshSoundsRuntimeMetadata:async()=>{actions.push(['refresh']);return{free_space_in_bytes:100};},
    getFile:async id=>{actions.push(['get',id]);return{name:'wire-kick',data:Uint8Array.from([1,2,3,4])};},
    getFileMetadata:async id=>{actions.push(['metadata',id]);return{name:'kick','sound.pitch':-12};},
    prepareSampleTransferMetadata:metadata=>({...metadata}),createTransferFileName:()=> 'mv007_008',
    uploadSampleToSlot:async options=>{actions.push(['upload',options.destinationId,options.barWriteMode]);options.onCreated?.(8);return 8;},
    waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>actions.push(['sync']),
    getFileInfo:async id=>{actions.push(['info',id]);return{nodeId:8,parentId:1000,fileName:'mv007_008',fileSize:4,flags:1};},
    fileItemFromInfo:info=>({nodeId:info.nodeId,fileName:'/sounds/'+info.fileName,fileType:'file',fileSize:info.fileSize,isReadable:true}),
    prepareSampleLocalMetadata:metadata=>({...metadata,local:true}),renderDeviceStats(){},deleteFile:async()=>{},readDevice:async()=>{},logTechnical(){}
  });
  const result=await controller.copyTransfer([{sourceId:7,targetId:8}],new Map([[7,source]]),[source]);
  assert.deepEqual(result,{targetIds:[8]});
  assert.equal(sampleStore.getSlot(8).meta.name,'kick');assert.equal(sampleStore.getSlot(8).meta.local,true);
  assert.equal(sampleStore.getSlot(8).verification.metadata,'expected');
  const getIndex=actions.findIndex(x=>x[0]==='get'),metaIndex=actions.findIndex(x=>x[0]==='metadata'),uploadIndex=actions.findIndex(x=>x[0]==='upload'),syncIndex=actions.findIndex(x=>x[0]==='sync'),infoIndex=actions.findIndex(x=>x[0]==='info');
  assert.ok(getIndex>=0&&metaIndex>getIndex&&uploadIndex>metaIndex&&syncIndex>uploadIndex&&infoIndex>syncIndex);
});

test('sample copy controller rolls created destinations back in reverse order and resyncs after failure',async()=>{
  const actions=[],sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:7,fileName:'/sounds/one',fileType:'file',fileSize:2,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true},{nodeId:9,fileName:'/sounds/two',fileType:'file',fileSize:2,isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true}]);
  const source7=sampleStore.getSlot(7),source9=sampleStore.getSlot(9);let uploadCount=0;
  const controller=createSampleCopyController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({free_space_in_bytes:100}),getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:100}),
    getFile:async id=>({name:'source-'+id,data:Uint8Array.from([1,2])}),getFileMetadata:async id=>({name:'source-'+id}),prepareSampleTransferMetadata:x=>({...x}),createTransferFileName:(s,t)=>'mv'+s+'_'+t,
    uploadSampleToSlot:async options=>{uploadCount++;options.onCreated?.(options.destinationId);actions.push(['upload',options.destinationId]);if(uploadCount===2)throw new Error('second copy failed');return options.destinationId;},
    waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>{},
    getFileInfo:async id=>({nodeId:id,parentId:1000,fileName:'copy'+id,fileSize:2,flags:1}),fileItemFromInfo:info=>({nodeId:info.nodeId,fileName:'/sounds/'+info.fileName,fileType:'file',fileSize:2}),
    prepareSampleLocalMetadata:x=>({...x}),renderDeviceStats(){},deleteFile:async id=>actions.push(['delete',id]),readDevice:async()=>actions.push(['resync']),logTechnical(){}
  });
  await assert.rejects(()=>controller.copyTransfer(
    [{sourceId:7,targetId:8},{sourceId:9,targetId:10}],
    new Map([[7,source7],[9,source9]]),[source7,source9]
  ),/second copy failed/);
  assert.deepEqual(actions.filter(x=>x[0]==='delete'),[['delete',10],['delete',8]]);
  assert.equal(sampleStore.getSlot(8).file,null);assert.equal(sampleStore.getSlot(10).file,null);
  assert.equal(actions.filter(x=>x[0]==='resync').length,1);
});

test('sample copy controller rejects unreadable sources before entering the mutating phase',async()=>{
  let mutatingCalls=0,getCalls=0;const sampleStore=createSampleStore();
  const source={id:7,nodeId:7,file:{name:'locked'},node:{isReadable:false}};
  const controller=createSampleCopyController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:false}),
    isConnected:()=>true,captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating(){mutatingCalls++;},setGlobalProgress(){},hideGlobalProgress(){},assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({}),
    getFile:async()=>{getCalls++;return{data:new Uint8Array(1)};},getFileMetadata:async()=>({}),prepareSampleTransferMetadata:x=>x,createTransferFileName:()=> 'copy',
    uploadSampleToSlot:async()=>1,waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>{},getFileInfo:async()=>({}),fileItemFromInfo:()=>null,
    prepareSampleLocalMetadata:x=>x,renderDeviceStats(){},deleteFile:async()=>{},readDevice:async()=>{},logTechnical(){}
  });
  await assert.rejects(()=>controller.copyTransfer([{sourceId:7,targetId:8}],new Map([[7,source]]),[source]),/One or more source samples cannot be read/);
  assert.equal(mutatingCalls,0);assert.equal(getCalls,0);
});

test('sample read controller resolves stale UI snapshots through SampleStore before I/O',async()=>{
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{
    nodeId:7,fileName:'/sounds/canonical',fileType:'file',fileSize:2,
    isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true
  }]);
  sampleStore.setMetadata(7,{
    name:'Canonical.wav',channels:1,samplerate:46875,format:'s16'
  });

  const writes=[];
  let starts=0;
  const controller=createSampleReadController({
    sampleStore,
    getMemory:()=>({setPreviewing(){}}),
    isConnected:()=>true,
    startPlayback:async()=>{starts++;},
    stopPlayback:async()=>{},
    getFile:async id=>{
      assert.equal(id,7);
      return{name:'wire',data:Uint8Array.from([1,2])};
    },
    getFileMetadata:async()=>{throw new Error('canonical metadata should avoid readback');},
    setGlobalProgress(){},
    hideGlobalProgress(){},
    createWav:async(bytes,options)=>{
      writes.push(options);
      return{wav:true};
    },
    windowRef:{
      showSaveFilePicker:async options=>({
        createWritable:async()=>({write:async()=>{},close:async()=>{}})
      })
    }
  });

  const stale={
    id:7,nodeId:7,
    file:{name:'stale.raw',size:999},
    meta:{name:'Stale.wav',channels:2,samplerate:32000,format:'s16'}
  };
  const result=await controller.downloadOne(stale);
  assert.equal(result.filename,'Canonical.wav');
  assert.equal(writes[0].metadata.name,'Canonical.wav');

  sampleStore.removeFile(7);
  await controller.audition(stale);
  assert.equal(starts,0);
});
