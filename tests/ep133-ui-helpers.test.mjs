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
  const slots=new Map();
  const memory={
    getSlot:id=>slots.get(Number(id))||{id:Number(id),file:null,meta:null,nodeId:Number(id)},
    setSlot:item=>slots.set(Number(item.nodeId),{id:Number(item.nodeId),file:{name:item.fileName,size:item.fileSize},node:item,nodeId:Number(item.nodeId),meta:null}),
    setMetadata(id,metadata){const slot=this.getSlot(id);slot.meta=metadata;slots.set(Number(id),slot);},
    mergeMetadata(){},
    clearSlot:id=>slots.delete(Number(id)),
    countOccupied:()=>slots.size
  };
  const cache={invalidate(){},set(){},merge(){}};
  const deviceFiles=[{nodeId:42,fileName:'/sounds',fileType:'folder'}];
  let files=[...deviceFiles],infoReads=0,metadataReads=0;
  const controller=createFileEventController({
    isConnected:()=>true,
    getMemory:()=>memory,
    sampleMetadataCache:cache,
    getSoundsParentId:()=>42,
    getSoundsMetadata:()=>({}),
    getDeviceFiles:()=>files,
    setDeviceFiles:value=>{files=value;},
    getCurrentPropertySlotId:()=>null,
    getFileInfo:async id=>{infoReads++;return{nodeId:id,parentId:42,fileSize:100,fileName:'kick',flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ};},
    getFileMetadata:async()=>{metadataReads++;return{name:'kick',channels:1,samplerate:46875,format:'s16'};},
    fileItemFromInfo:info=>buildFileItemFromInfo(info,files),
    updateDeviceFile:item=>{const index=files.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));if(index>=0)files[index]=item;else files.push(item);},
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
  assert.equal(memory.getSlot(7).meta.name,'kick');
});

test('FILE event controller ignores suppressed native moves and reconciles external moves without full resync',async()=>{
  const oldItem={
    nodeId:7,fileName:'/sounds/old',fileSize:100,fileType:'file',
    flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ,isReadable:true
  };
  let files=[{nodeId:42,fileName:'/sounds',fileType:'folder'},oldItem],infoReads=0;
  const slots=new Map([[7,{id:7,nodeId:7,file:{name:'old',size:100},node:oldItem,meta:{name:'old'}}]]);
  const memory={
    getSlot:id=>slots.get(Number(id))||{id:Number(id),nodeId:Number(id),file:null,meta:null},
    clearSlot:id=>slots.delete(Number(id)),
    setSlot:item=>slots.set(Number(item.nodeId),{id:Number(item.nodeId),nodeId:Number(item.nodeId),file:{name:item.fileName,size:item.fileSize},node:item,meta:null}),
    setMetadata(id,metadata){const slot=this.getSlot(id);slot.meta=metadata;slots.set(Number(id),slot);},
    mergeMetadata(){},countOccupied:()=>slots.size
  };
  const controller=createFileEventController({
    isConnected:()=>true,getMemory:()=>memory,
    sampleMetadataCache:{invalidate(){},set(){},merge(){}},
    getSoundsParentId:()=>42,getSoundsMetadata:()=>({}),getDeviceFiles:()=>files,setDeviceFiles:value=>{files=value;},
    getCurrentPropertySlotId:()=>null,
    getFileInfo:async id=>{infoReads++;return{nodeId:id,parentId:42,fileSize:100,fileName:'moved',flags:TE_SYSEX_FILE_FILE_TYPE_FILE|TE_SYSEX_FILE_CAPABILITY_READ};},
    getFileMetadata:async()=>({name:'moved'}),
    fileItemFromInfo:info=>buildFileItemFromInfo(info,files),
    updateDeviceFile:item=>{const index=files.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));if(index>=0)files[index]=item;else files.push(item);},
    applySoundsMetadata(){},renderProperties(){},renderDeviceStats(){},closeProperties(){},logTechnical(){}
  });

  controller.suppressNativeMoveEvent(7,8);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_MOVED,data:{oldNodeId:7,parentId:42,nodeId:8}});
  assert.equal(infoReads,0);

  controller.clearNativeMoveSuppression(7,8);
  await controller.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_MOVED,data:{oldNodeId:7,parentId:42,nodeId:8}});
  assert.equal(infoReads,1);
  assert.equal(slots.has(7),false);
  assert.equal(memory.getSlot(8).meta.name,'moved');
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
  let synchronized=false,metadataHydrating=false,soundsParentId=0,soundFormats=[],soundsMetadata={},deviceFiles=[];
  let resolveUncached;
  const uncachedMetadata=new Promise(resolve=>{resolveUncached=resolve;});
  const slots=new Map();
  const tabs=[];
  const memory={
    getSelected:()=>({id:2}),
    getActiveTab:()=>0,
    setTabs:value=>{tabs.splice(0,tabs.length,...value);},
    setSlots(){slots.clear();},
    setEntries(entries){
      for(const entry of entries){
        const id=Number(entry.nodeId);
        slots.set(id,{id,nodeId:id,file:{name:entry.fileName,size:entry.fileSize},meta:null});
      }
    },
    countOccupied:()=>slots.size,
    setMetadata(id,metadata){const slot=slots.get(Number(id));if(slot)slot.meta=metadata;},
    getSlot:id=>slots.get(Number(id))
  };
  const cache={
    get:slot=>slot.id===2?{name:'cached',channels:1,samplerate:46875,format:'s16'}:null,
    set(slot,metadata){slot.meta=metadata;}
  };
  const listCalls=[];
  const controller=createSampleLibrarySyncController({
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({fallbackTabs:[{name:'ALL',range:[1,999]}]}),
    sampleMetadataCache:cache,
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
    setSoundsParentId:value=>{soundsParentId=value;},
    setSoundFormats:value=>{soundFormats=value;},
    setSoundsMetadata:value=>{soundsMetadata=value;},
    setDeviceFiles:value=>{deviceFiles=value;},
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
  assert.equal(soundsParentId,1000);
  assert.deepEqual(listCalls,[[0,'/'],[1000,'/sounds']]);
  assert.equal(slots.get(2).meta.name,'cached');
  assert.equal(slots.get(5).meta,null);
  assert.equal(deviceFiles.length,3);
  assert.equal(soundFormats.length,1);
  assert.equal(soundsMetadata.tabs[0].name,'BANK');
  assert.equal(tabs[0].name,'BANK');

  resolveUncached({name:'live',channels:2,samplerate:32000,format:'s16'});
  await pending;

  assert.equal(metadataHydrating,false);
  assert.equal(synchronized,true);
  assert.equal(slots.get(5).meta.name,'live');
});

test('sample library sync fails closed when the /sounds node is missing',async()=>{
  let synchronized=true,metadataHydrating=true,reported='';
  const memory={
    getSelected:()=>null,getActiveTab:()=>0,setTabs(){},setSlots(){},setEntries(){},
    countOccupied:()=>0,setMetadata(){},getSlot:()=>null
  };
  const controller=createSampleLibrarySyncController({
    captureBatchSession:()=> 'session-a',
    assertBatchSession(){},
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({fallbackTabs:[{name:'ALL',range:[1,999]}]}),
    sampleMetadataCache:{get:()=>null,set(){}},
    listDirectory:async()=>[],
    getFileMetadata:async()=>({}),
    setSynchronized:value=>{synchronized=value;},
    setMetadataHydrating:value=>{metadataHydrating=value;},
    setSoundsParentId(){},setSoundFormats(){},setSoundsMetadata(){},setDeviceFiles(){},
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
  const timers=[];
  const writes=[];
  const cacheWrites=[];
  const slot={
    id:7,nodeId:7,file:{name:'kick'},node:{isWritable:true},
    meta:{'sound.playmode':'oneshot','envelope.release':44}
  };
  const memory={
    getSlot:id=>Number(id)===7?slot:null,
    mergeMetadata(id,metadata){Object.assign(slot.meta,metadata);},
    setMetadata(id,metadata){slot.meta={...metadata};}
  };
  const controller=createSamplePropertiesController({
    properties:null,propertiesGrid:null,
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],
      sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async(id,payload)=>{writes.push({id,payload:{...payload}});},
    getFileMetadata:async()=>({
      'sound.playmode':'key','envelope.release':44,channels:1,samplerate:46875,format:'s16'
    }),
    sampleMetadataCache:{set(slotValue,metadata){cacheWrites.push({slot:slotValue,metadata:{...metadata}});}},
    showError(){},logTechnical(){},
    setTimeoutFn:callback=>{timers.push(callback);return timers.length;},
    clearTimeoutFn(){},
    debounceMs:120
  });

  controller.scheduleWrite(slot,'sound.playmode','key');
  assert.equal(slot.meta['sound.playmode'],'key');
  assert.equal(controller.hasPendingWrites(),true);
  assert.equal(timers.length,1);

  await timers.shift()();

  assert.deepEqual(writes,[{id:7,payload:{'sound.playmode':'key','envelope.release':44}}]);
  assert.equal(controller.hasPendingWrites(),false);
  assert.equal(cacheWrites.length,1);
  assert.equal(slot.meta['sound.playmode'],'key');
  assert.equal(slot.meta['envelope.release'],44);
});

test('sample properties controller restores authoritative metadata after failed verification',async()=>{
  const timers=[];
  const errors=[];
  const technical=[];
  let reads=0;
  const slot={
    id:9,nodeId:9,file:{name:'snare'},node:{isWritable:true},
    meta:{'sound.pitch':0}
  };
  const memory={
    getSlot:id=>Number(id)===9?slot:null,
    mergeMetadata(id,metadata){Object.assign(slot.meta,metadata);},
    setMetadata(id,metadata){slot.meta={...metadata};}
  };
  const controller=createSamplePropertiesController({
    properties:null,propertiesGrid:null,
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],
      sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async()=>{},
    getFileMetadata:async()=>{
      reads+=1;
      return{'sound.pitch':0,channels:1,samplerate:46875,format:'s16'};
    },
    sampleMetadataCache:{set(){}},
    showError:message=>errors.push(message),
    logTechnical:(label,error)=>technical.push([label,String(error?.message||error)]),
    setTimeoutFn:callback=>{timers.push(callback);return timers.length;},
    clearTimeoutFn(){},
    debounceMs:120
  });

  controller.scheduleWrite(slot,'sound.pitch',1);
  assert.equal(slot.meta['sound.pitch'],1);
  assert.equal(controller.getPendingCount(),1);

  await timers.shift()();

  assert.equal(reads,2);
  assert.equal(slot.meta['sound.pitch'],0);
  assert.equal(controller.getPendingCount(),0);
  assert.deepEqual(errors,['COULD NOT UPDATE SAMPLE PROPERTY.']);
  assert.match(technical[0][0],/PROPERTY sound\.pitch/);
});

test('sample properties controller owns open-slot state and remaps it after native MOVE',()=>{
  const grid={innerHTML:'',addEventListener(){}};
  const panel={
    hidden:true,style:{left:'',top:''},
    getBoundingClientRect:()=>({width:120,height:100})
  };
  const slot={id:7,nodeId:7,file:{name:'kick'},node:{isWritable:true},meta:{'sound.pitch':0}};
  const memory={getSlot:id=>Number(id)===7?slot:null};
  const controller=createSamplePropertiesController({
    properties:panel,propertiesGrid:grid,
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>({
      name:'K.O. II',advancedSampleMetadataWrites:true,
      playModes:['oneshot','key','legato'],
      sampleBars:{authoring:false,writeValues:[]}
    }),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setFileMetadata:async()=>{},getFileMetadata:async()=>({}),
    sampleMetadataCache:{set(){}},showError(){},logTechnical(){},
    documentRef:{addEventListener(){},removeEventListener(){}},
    windowRef:{innerWidth:800,innerHeight:600}
  });

  controller.open(slot,{clientX:20,clientY:30});
  assert.equal(panel.hidden,false);
  assert.equal(controller.getCurrentSlotId(),7);
  controller.remapCurrentSlot(7,18);
  assert.equal(controller.getCurrentSlotId(),18);
  controller.close();
  assert.equal(controller.getCurrentSlotId(),null);
  assert.equal(panel.hidden,true);
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
  const actions=[];
  const cleared=[];
  const removed=[];
  const targets=[
    {id:7,nodeId:7,file:{name:'kick',size:100},meta:{name:'kick',crc:111}},
    {id:8,nodeId:8,file:{name:'snare',size:200},meta:{name:'snare',crc:222}}
  ];
  const memory={
    clearSlot:id=>{cleared.push(id);actions.push(['clear',id]);},
    countOccupied:()=>0
  };
  const controller=createSampleDeleteController({
    getMemory:()=>memory,
    getSoundsParentId:()=>1000,
    getSoundsMetadata:()=>({free_space_in_bytes:123}),
    isConnected:()=>true,
    isSynchronized:()=>true,
    hasPendingPropertyWrites:()=>false,
    confirmAction:async message=>{actions.push(['confirm',message]);return true;},
    captureBatchSession:()=>{actions.push(['capture']);return'session-a';},
    assertBatchSession:token=>actions.push(['assert',token]),
    getDeviceSessionToken:()=> 'session-a',
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress:(label,value)=>actions.push(['progress',label,value]),
    hideGlobalProgress:()=>actions.push(['hide']),
    getFileInfo:async id=>{
      actions.push(['info',id]);
      return{nodeId:id,parentId:1000,fileSize:id===7?100:200};
    },
    getFileMetadata:async id=>{
      actions.push(['metadata',id]);
      return{name:id===7?'kick':'snare',crc:id===7?111:222};
    },
    deleteFile:async id=>actions.push(['delete',id]),
    waitForMetadataUpdate:nodeId=>{
      actions.push(['wait-metadata',nodeId]);
      return Promise.resolve({data:{metadata:{free_space_in_bytes:456}}});
    },
    syncMetadataAfterMutation:async(nodeId,eventPromise)=>{
      await eventPromise;
      actions.push(['sync-metadata',nodeId]);
    },
    assertSlotsDeleted:async ids=>actions.push(['verify-list',...ids]),
    removeDeviceFile:id=>{removed.push(id);actions.push(['remove-file',id]);},
    renderDeviceStats:(metadata,count)=>actions.push(['stats',metadata.free_space_in_bytes,count]),
    readDevice:async()=>actions.push(['resync']),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)])
  });

  assert.equal(await controller.deleteSamples(targets),true);

  assert.deepEqual(cleared,[7,8]);
  assert.deepEqual(removed,[7,8]);
  assert.deepEqual(actions.filter(item=>item[0]==='delete'),[['delete',7],['delete',8]]);
  assert.deepEqual(actions.filter(item=>item[0]==='verify-list'),[['verify-list',7,8]]);
  assert.equal(actions.some(item=>item[0]==='resync'),false);
  assert.equal(actions.at(-2)[0],'hide');
  assert.deepEqual(actions.at(-1),['mutating',false]);

  const info7=actions.findIndex(item=>item[0]==='info'&&item[1]===7);
  const metadata7=actions.findIndex(item=>item[0]==='metadata'&&item[1]===7);
  const delete7=actions.findIndex(item=>item[0]==='delete'&&item[1]===7);
  const sync7=actions.findIndex(item=>item[0]==='sync-metadata');
  assert.ok(info7>=0&&metadata7>info7&&delete7>metadata7&&sync7>delete7);
});

test('sample delete controller refuses a changed target before FILE_DELETE and resyncs the same session',async()=>{
  const actions=[];
  let deleteCalls=0,resyncCalls=0;
  const slot={id:7,nodeId:7,file:{name:'kick',size:100},meta:{name:'kick',crc:111}};
  const controller=createSampleDeleteController({
    getMemory:()=>({clearSlot(){},countOccupied:()=>1}),
    getSoundsParentId:()=>1000,
    getSoundsMetadata:()=>({}),
    isConnected:()=>true,
    isSynchronized:()=>true,
    hasPendingPropertyWrites:()=>false,
    confirmAction:async()=>true,
    captureBatchSession:()=> 'session-a',
    assertBatchSession(){},
    getDeviceSessionToken:()=> 'session-a',
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress(){},
    hideGlobalProgress:()=>actions.push(['hide']),
    getFileInfo:async()=>({nodeId:7,parentId:1000,fileSize:101}),
    getFileMetadata:async()=>({name:'kick',crc:111}),
    deleteFile:async()=>{deleteCalls++;},
    waitForMetadataUpdate:()=>Promise.resolve(null),
    syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},
    removeDeviceFile(){},
    renderDeviceStats(){},
    readDevice:async()=>{resyncCalls++;},
    logTechnical(){}
  });

  await assert.rejects(
    ()=>controller.deleteSamples([slot]),
    /Sample slot changed before delete; reload the library and confirm again/
  );
  assert.equal(deleteCalls,0);
  assert.equal(resyncCalls,1);
  assert.deepEqual(actions,[['mutating',true],['hide'],['mutating',false]]);
});

test('sample delete controller blocks deletion while a property write is pending and respects cancel',async()=>{
  let confirms=0,deletes=0,mutations=0;
  const slot={id:7,nodeId:7,file:{name:'kick',size:100},meta:{name:'kick'}};
  const base={
    getMemory:()=>({clearSlot(){},countOccupied:()=>1}),
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    isConnected:()=>true,isSynchronized:()=>true,
    captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating:()=>{mutations++;},setGlobalProgress(){},hideGlobalProgress(){},
    getFileInfo:async()=>({nodeId:7,parentId:1000,fileSize:100}),
    getFileMetadata:async()=>({name:'kick'}),
    deleteFile:async()=>{deletes++;},
    waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},removeDeviceFile(){},renderDeviceStats(){},readDevice:async()=>{},logTechnical(){}
  };
  const pending=createSampleDeleteController({
    ...base,
    hasPendingPropertyWrites:()=>true,
    confirmAction:async()=>{confirms++;return true;}
  });
  await assert.rejects(
    ()=>pending.deleteSamples([slot]),
    /pending sample property write/
  );
  assert.equal(confirms,0);
  assert.equal(deletes,0);

  const cancelled=createSampleDeleteController({
    ...base,
    hasPendingPropertyWrites:()=>false,
    confirmAction:async()=>{confirms++;return false;}
  });
  assert.equal(await cancelled.deleteSamples([slot]),false);
  assert.equal(confirms,1);
  assert.equal(deletes,0);
  assert.equal(mutations,0);
});


test('sample upload controller batches one preflight and commits provisional metadata without blocking readback',async()=>{
  const actions=[];
  const timers=[];
  const deviceFiles=[{nodeId:1000,fileName:'/sounds',fileType:'folder'}];
  let soundsMetadata={free_space_in_bytes:100};
  const slots=new Map([
    [1,{id:1,nodeId:1,file:{name:'occupied',size:1},node:{isWritable:true},meta:{}}],
    [2,{id:2,nodeId:2,file:null,node:null,meta:null}],
    [3,{id:3,nodeId:3,file:{name:'occupied3',size:1},node:{isWritable:true},meta:{}}],
    [4,{id:4,nodeId:4,file:null,node:null,meta:null}]
  ]);
  const memory={
    findNextFree(from){
      for(let id=Number(from);id<=4;id++)if(!slots.get(id)?.file)return id;
      return-1;
    },
    getSlot:id=>slots.get(Number(id)),
    setSlot(item){
      const id=Number(item.nodeId);
      const current=slots.get(id)||{id,nodeId:id,file:null,node:null,meta:null};
      current.file={name:String(item.fileName).split('/').pop(),size:item.fileSize};
      current.node=item;
      slots.set(id,current);
      actions.push(['set-slot',id]);
    },
    setMetadata(id,metadata){
      const slot=slots.get(Number(id));
      slot.meta={...metadata};
      actions.push(['set-meta',Number(id),metadata.name]);
    },
    setOperation(id,state){actions.push(['op',Number(id),state.label,state.progress]);},
    clearOperation:id=>actions.push(['clear-op',Number(id)]),
    clearSlot:id=>actions.push(['clear-slot',Number(id)]),
    selectSlots(ids,options){actions.push(['select',[...ids],options.activeId]);},
    countOccupied:()=>[...slots.values()].filter(slot=>slot.file).length
  };
  let batchCalls=0,preflights=0,refreshCalls=0;
  const uploaded=[];
  const pending=[];
  const cacheWrites=[];
  const controller=createSampleUploadController({
    getMemory:()=>memory,
    getDeviceFiles:()=>deviceFiles,
    getSoundsParentId:()=>1000,
    getSoundFormats:()=>[{type:'pcm'}],
    getSoundsMetadata:()=>soundsMetadata,
    setSoundsMetadata:value=>{soundsMetadata=value;actions.push(['free',value.free_space_in_bytes]);},
    getActiveDeviceProfile:()=>({playModes:['oneshot','key','legato'],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress:(label,value)=>actions.push(['progress',label,Math.round(value)]),
    hideGlobalProgress:()=>actions.push(['hide']),
    withSampleUploadBatch:async operation=>{batchCalls++;return operation();},
    assertSlotsEmpty:async ids=>{preflights++;assert.deepEqual(ids,[2,4]);},
    refreshSoundsRuntimeMetadata:async()=>{refreshCalls++;return soundsMetadata;},
    uploadSampleToSlot:async options=>{
      uploaded.push(options.destinationId);
      options.onCreated?.(options.destinationId);
      options.onProgress?.(options.data.byteLength,options.data.byteLength);
      return options.destinationId;
    },
    prepareSampleLocalMetadata:metadata=>({...metadata,local:true}),
    normalizeFileName:name=>String(name).replace(/\.wav$/i,'').toLowerCase(),
    updateDeviceFile:item=>{
      const index=deviceFiles.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));
      if(index>=0)deviceFiles[index]=item;else deviceFiles.push(item);
    },
    fileItemFromInfo:()=>{throw new Error('hydrate should be deferred');},
    getFileInfo:async()=>{throw new Error('success path must not read FILE_INFO');},
    getFileMetadata:async()=>{throw new Error('success path must not read metadata');},
    sampleMetadataCache:{set(slot,metadata){cacheWrites.push([slot.id,metadata.name]);}},
    renderDeviceStats:()=>{},
    markUploadPending:id=>pending.push(['mark',id]),
    clearUploadPending:id=>pending.push(['clear',id]),
    waitForMetadataUpdate:()=>Promise.resolve(null),
    deleteFile:async()=>{},
    syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},
    logTechnical(){},
    showError:message=>actions.push(['error',message]),
    prepareSample:async file=>({
      data:new Uint8Array(file.name.toLowerCase().startsWith('a')?10:20),
      channels:1,samplerate:46875,format:'s16',
      metadata:{'sound.pitch':-12}
    }),
    setTimeoutFn:(callback,delay)=>{timers.push({callback,delay});return timers.length;}
  });

  const files=[
    {name:'A.wav',type:'audio/wav'},
    {name:'B.wav',type:'audio/wav'}
  ];
  const result=await controller.uploadFilesToSlot(slots.get(1),files);

  assert.deepEqual(result.successes,[2,4]);
  assert.equal(result.failures.length,0);
  assert.deepEqual(uploaded,[2,4]);
  assert.equal(batchCalls,1);
  assert.equal(preflights,1);
  assert.equal(soundsMetadata.free_space_in_bytes,70);
  assert.deepEqual(cacheWrites,[[2,'a'],[4,'b']]);
  assert.deepEqual(pending.filter(item=>item[0]==='mark'),[['mark',2],['mark',4]]);
  assert.deepEqual(pending.filter(item=>item[0]==='clear'),[['clear',2],['clear',4]]);
  assert.deepEqual(timers.map(item=>item.delay),[250,900]);
  assert.deepEqual(actions.find(item=>item[0]==='select'),['select',[2,4],2]);
  assert.equal(refreshCalls,1);
  assert.equal(actions.at(-2)[0],'hide');
  assert.deepEqual(actions.at(-1),['mutating',false]);
});

test('sample upload controller rolls back a created slot through DELETE metadata sync and LIST verification',async()=>{
  const actions=[];
  const deviceFiles=[{nodeId:1000,fileName:'/sounds',fileType:'folder'}];
  const target={id:2,nodeId:2,file:null,node:null,meta:null};
  const memory={
    findNextFree:()=>2,
    getSlot:()=>target,
    setOperation(id,state){actions.push(['op',id,state.label]);},
    clearOperation:id=>actions.push(['clear-op',id]),
    clearSlot:id=>actions.push(['clear-slot',id]),
    countOccupied:()=>0,
    selectSlots(){throw new Error('failed upload must not select');}
  };
  let shown='';
  const controller=createSampleUploadController({
    getMemory:()=>memory,getDeviceFiles:()=>deviceFiles,
    getSoundsParentId:()=>1000,getSoundFormats:()=>[],
    getSoundsMetadata:()=>({free_space_in_bytes:100}),setSoundsMetadata(){},
    getActiveDeviceProfile:()=>({playModes:['oneshot','key','legato'],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,
    captureBatchSession:()=> 'session-a',assertBatchSession(){},
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress(){},hideGlobalProgress:()=>actions.push(['hide']),
    withSampleUploadBatch:async operation=>operation(),
    assertSlotsEmpty:async ids=>actions.push(['preflight',...ids]),
    refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:100}),
    uploadSampleToSlot:async options=>{
      actions.push(['upload',options.destinationId]);
      options.onCreated?.(2);
      throw new Error('simulated stream failure');
    },
    prepareSampleLocalMetadata:metadata=>metadata,
    normalizeFileName:name=>name.toLowerCase(),
    updateDeviceFile(){},fileItemFromInfo(){},
    getFileInfo:async()=>({}),getFileMetadata:async()=>({}),
    sampleMetadataCache:{set(){}},renderDeviceStats(){},
    markUploadPending:id=>actions.push(['mark',id]),
    clearUploadPending:id=>actions.push(['clear-pending',id]),
    waitForMetadataUpdate:nodeId=>{
      actions.push(['wait-metadata',nodeId]);
      return Promise.resolve({data:{metadata:{}}});
    },
    deleteFile:async id=>actions.push(['delete',id]),
    syncMetadataAfterMutation:async(nodeId,promise)=>{
      await promise;actions.push(['sync-metadata',nodeId]);
    },
    assertSlotsDeleted:async ids=>actions.push(['verify-list',...ids]),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)]),
    showError:message=>{shown=message;},
    prepareSample:async()=>({
      data:new Uint8Array(10),channels:1,samplerate:46875,format:'s16',metadata:{}
    }),
    setTimeoutFn:(callback,delay)=>{actions.push(['timer',delay]);return 1;}
  });

  const result=await controller.uploadFilesToSlot(
    {id:1},
    [{name:'Broken.wav',type:'audio/wav'}]
  );

  assert.deepEqual(result.successes,[]);
  assert.equal(result.failures.length,1);
  assert.match(shown,/COULD NOT UPLOAD:[\s\S]*Broken\.wav/);
  const uploadIndex=actions.findIndex(item=>item[0]==='upload');
  const deleteIndex=actions.findIndex(item=>item[0]==='delete');
  const syncIndex=actions.findIndex(item=>item[0]==='sync-metadata');
  const verifyIndex=actions.findIndex(item=>item[0]==='verify-list');
  const clearIndex=actions.findIndex(item=>item[0]==='clear-slot');
  assert.ok(uploadIndex>=0&&deleteIndex>uploadIndex&&syncIndex>deleteIndex&&verifyIndex>syncIndex&&clearIndex>verifyIndex);
  assert.deepEqual(actions.find(item=>item[0]==='verify-list'),['verify-list',2]);
  assert.equal(actions.at(-2)[0],'hide');
  assert.deepEqual(actions.at(-1),['mutating',false]);
});

test('sample upload controller rejects unsupported files and insufficient forward slots before mutating',async()=>{
  let mutations=0,batches=0;
  const slots=new Map([
    [5,{id:5,nodeId:5,file:null}],
    [6,{id:6,nodeId:6,file:{name:'occupied'}}]
  ]);
  const base={
    getMemory:()=>({
      findNextFree(from){
        for(let id=Number(from);id<=6;id++)if(!slots.get(id)?.file)return id;
        return-1;
      },
      getSlot:id=>slots.get(Number(id))
    }),
    getDeviceFiles:()=>[],getSoundsParentId:()=>1000,getSoundFormats:()=>[],getSoundsMetadata:()=>({}),
    setSoundsMetadata(){},getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:false}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,
    captureBatchSession:()=> 'session-a',assertBatchSession(){},
    setMutating(){mutations++;},setGlobalProgress(){},hideGlobalProgress(){},
    withSampleUploadBatch:async operation=>{batches++;return operation();},
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({}),
    uploadSampleToSlot:async()=>{},prepareSampleLocalMetadata:x=>x,normalizeFileName:x=>x,
    updateDeviceFile(){},fileItemFromInfo(){},getFileInfo:async()=>({}),getFileMetadata:async()=>({}),
    sampleMetadataCache:{set(){}},renderDeviceStats(){},markUploadPending(){},clearUploadPending(){},
    waitForMetadataUpdate:()=>Promise.resolve(null),deleteFile:async()=>{},syncMetadataAfterMutation:async()=>{},
    assertSlotsDeleted:async()=>{},logTechnical(){},showError(){},prepareSample:async()=>({})
  };

  const controller=createSampleUploadController(base);
  await assert.rejects(
    ()=>controller.uploadFilesToSlot(slots.get(5),[{name:'note.txt',type:'text/plain'}]),
    /No supported audio files/
  );
  await assert.rejects(
    ()=>controller.uploadFilesToSlot(slots.get(5),[
      {name:'one.wav',type:'audio/wav'},
      {name:'two.wav',type:'audio/wav'}
    ]),
    /Not enough free sample slots above the drop position/
  );
  assert.equal(mutations,0);
  assert.equal(batches,0);
});


test('sample move controller performs CRC-verified FILE_MOVE and remaps local state without PCM fallback',async()=>{
  const actions=[];
  let files=[
    {nodeId:1000,fileName:'/sounds',fileType:'folder'},
    {nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:100}
  ];
  const slots=new Map([
    [7,{id:7,nodeId:7,file:{name:'kick',size:100},node:{nodeId:7},meta:{name:'kick',crc:123}}],
    [8,{id:8,nodeId:8,file:null,node:null,meta:null}]
  ]);
  const memory={
    getSlot:id=>slots.get(Number(id)),
    clearSlot:id=>{actions.push(['clear-slot',Number(id)]);slots.delete(Number(id));},
    setSlot:item=>{
      const id=Number(item.nodeId);
      slots.set(id,{id,nodeId:id,file:{name:'kick',size:item.fileSize},node:item,meta:null});
      actions.push(['set-slot',id]);
    },
    setMetadata(id,metadata){
      const slot=slots.get(Number(id));
      slot.meta={...metadata};
      actions.push(['set-meta',Number(id),metadata.name]);
    },
    setOperation(id,state){actions.push(['op',Number(id),state.label,state.progress]);},
    clearOperation:id=>actions.push(['clear-op',Number(id)]),
    clearOperations:()=>actions.push(['clear-ops']),
    countOccupied:()=>[...slots.values()].filter(slot=>slot.file).length
  };
  const cacheActions=[];
  const controller=createSampleMoveController({
    getMemory:()=>memory,
    getDeviceFiles:()=>files,
    setDeviceFiles:value=>{files=value;actions.push(['files',value.map(item=>item.nodeId)]);},
    getSoundsParentId:()=>1000,
    getSoundsMetadata:()=>({free_space_in_bytes:50}),
    sampleMetadataCache:{
      invalidate:id=>cacheActions.push(['invalidate',Number(id)]),
      set:(slot,metadata)=>cacheActions.push(['set',slot.id,metadata.name])
    },
    fileItemFromInfo:info=>({
      nodeId:Number(info.nodeId),
      fileName:'/sounds/'+info.fileName,
      fileType:'file',
      fileSize:Number(info.fileSize),
      isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true
    }),
    remapCurrentPropertySlot:(oldId,newId)=>actions.push(['remap',oldId,newId]),
    renderDeviceStats:(metadata,count)=>actions.push(['stats',metadata.free_space_in_bytes,count]),
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress:(label,value)=>actions.push(['progress',label,value]),
    hideGlobalProgress:()=>actions.push(['hide']),
    suppressNativeMoveEvent:(oldId,newId)=>{
      actions.push(['suppress',oldId,newId]);
      return()=>actions.push(['release',oldId,newId]);
    },
    clearNativeMoveSuppression:(oldId,newId)=>actions.push(['clear-suppress',oldId,newId]),
    moveFile:async(sourceId,parentId,targetId,options)=>{
      actions.push(['move',sourceId,parentId,targetId,options.verifyCrc]);
      return{
        oldFileId:sourceId,newFileId:targetId,
        sourceCrc:123,destinationCrc:123,crcVerified:true,
        info:{nodeId:targetId,fileName:'kick',fileSize:100},
        metadata:{name:'kick',crc:123}
      };
    },
    readDevice:async()=>actions.push(['resync']),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)])
  });

  const source=slots.get(7);
  const result=await controller.nativeMoveTransfer(
    [{sourceId:7,targetId:8}],
    new Map([[7,source]])
  );

  assert.deepEqual(result,{targetIds:[8]});
  assert.deepEqual(actions.find(item=>item[0]==='move'),['move',7,1000,8,true]);
  assert.deepEqual(actions.filter(item=>item[0]==='suppress'),[['suppress',7,8]]);
  assert.deepEqual(actions.filter(item=>item[0]==='release'),[['release',7,8]]);
  assert.equal(actions.some(item=>item[0]==='resync'),false);
  assert.equal(slots.has(7),false);
  assert.equal(slots.get(8).meta.name,'kick');
  assert.deepEqual(files.map(item=>item.nodeId),[1000,8]);
  assert.deepEqual(cacheActions,[
    ['invalidate',7],['invalidate',8],['set',8,'kick']
  ]);
  assert.deepEqual(actions.find(item=>item[0]==='remap'),['remap',7,8]);
  assert.equal(actions.at(-2)[0],'hide');
  assert.deepEqual(actions.at(-1),['mutating',false]);
});

test('sample move controller rolls completed moves back in reverse order and resyncs after a later MOVE failure',async()=>{
  const actions=[];
  const slots=new Map([
    [7,{id:7,nodeId:7,file:{name:'one'},node:{},meta:{name:'one',crc:111}}],
    [8,{id:8,nodeId:8,file:null,node:null,meta:null}],
    [9,{id:9,nodeId:9,file:{name:'two'},node:{},meta:{name:'two',crc:222}}],
    [10,{id:10,nodeId:10,file:null,node:null,meta:null}]
  ]);
  const memory={
    getSlot:id=>slots.get(Number(id)),
    clearSlot:id=>slots.delete(Number(id)),
    setSlot:item=>{
      const id=Number(item.nodeId);
      slots.set(id,{id,nodeId:id,file:{name:item.fileName},node:item,meta:null});
    },
    setMetadata(id,metadata){slots.get(Number(id)).meta={...metadata};},
    setOperation(){},clearOperation(){},
    clearOperations:()=>actions.push(['clear-ops']),
    countOccupied:()=>2
  };
  let files=[{nodeId:1000,fileName:'/sounds',fileType:'folder'}];
  const controller=createSampleMoveController({
    getMemory:()=>memory,getDeviceFiles:()=>files,setDeviceFiles:value=>{files=value;},
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    sampleMetadataCache:{invalidate(){},set(){}},
    fileItemFromInfo:info=>({nodeId:info.nodeId,fileName:'/sounds/'+info.fileName,fileType:'file',fileSize:1}),
    remapCurrentPropertySlot(){},renderDeviceStats(){},
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:(oldId,newId)=>{
      actions.push(['suppress',oldId,newId]);
      return()=>actions.push(['release',oldId,newId]);
    },
    clearNativeMoveSuppression:(oldId,newId)=>actions.push(['clear-suppress',oldId,newId]),
    moveFile:async(sourceId,parentId,targetId,options)=>{
      actions.push(['move',sourceId,targetId,options.verifyCrc]);
      if(sourceId===7&&targetId===8)return{
        oldFileId:7,newFileId:8,sourceCrc:111,destinationCrc:111,crcVerified:true,
        info:{nodeId:8,fileName:'one',fileSize:1},metadata:{name:'one',crc:111}
      };
      if(sourceId===9&&targetId===10)throw new Error('second move failed');
      if(sourceId===8&&targetId===7)return{
        oldFileId:8,newFileId:7,sourceCrc:111,destinationCrc:111,crcVerified:true,
        info:{nodeId:7,fileName:'one',fileSize:1},metadata:{name:'one',crc:111}
      };
      throw new Error('unexpected move');
    },
    readDevice:async()=>actions.push(['resync']),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)])
  });

  await assert.rejects(
    ()=>controller.nativeMoveTransfer(
      [{sourceId:7,targetId:8},{sourceId:9,targetId:10}],
      new Map([[7,slots.get(7)],[9,slots.get(9)]])
    ),
    /second move failed/
  );

  assert.deepEqual(actions.filter(item=>item[0]==='move'),[
    ['move',7,8,true],
    ['move',9,10,true],
    ['move',8,7,true]
  ]);
  assert.ok(actions.findIndex(item=>item[0]==='move'&&item[1]===8)>actions.findIndex(item=>item[0]==='move'&&item[1]===9));
  assert.equal(actions.some(item=>item[0]==='clear-suppress'&&item[1]===9&&item[2]===10),true);
  assert.equal(actions.filter(item=>item[0]==='resync').length,1);
  assert.equal(actions.at(-2)[0],'resync');
  assert.equal(actions.at(-1)[0],'clear-ops');
});

test('sample move controller refuses an occupied destination before sending FILE_MOVE',async()=>{
  let moveCalls=0;
  const memory={
    getSlot:id=>({id:Number(id),file:{name:'occupied'}}),
    setOperation(){},clearOperation(){},clearOperations(){},countOccupied:()=>1
  };
  const controller=createSampleMoveController({
    getMemory:()=>memory,getDeviceFiles:()=>[],setDeviceFiles(){},
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    sampleMetadataCache:{invalidate(){},set(){}},fileItemFromInfo:()=>null,
    remapCurrentPropertySlot(){},renderDeviceStats(){},
    captureBatchSession:()=> 'session-a',assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:()=>()=>{},clearNativeMoveSuppression(){},
    moveFile:async()=>{moveCalls++;},readDevice:async()=>{},logTechnical(){}
  });
  const source={id:7,nodeId:7,file:{name:'source'},meta:{}};
  await assert.rejects(
    ()=>controller.nativeMoveTransfer(
      [{sourceId:7,targetId:8}],
      new Map([[7,source]])
    ),
    /Target sample slot is no longer empty/
  );
  assert.equal(moveCalls,0);
});


test('sample copy controller preserves GET metadata PUT sync FILE_INFO commit order',async()=>{
  const actions=[];
  let files=[{nodeId:1000,fileName:'/sounds',fileType:'folder'}];
  const source={
    id:7,nodeId:7,
    file:{name:'kick',size:4},
    node:{isReadable:true},
    meta:{name:'kick',crc:111}
  };
  const target={id:8,nodeId:8,file:null,node:null,meta:null};
  const slots=new Map([[7,source],[8,target]]);
  const memory={
    getSlot:id=>slots.get(Number(id)),
    setOperation:(id,state)=>actions.push(['op',Number(id),state.label,state.progress]),
    clearOperation:id=>actions.push(['clear-op',Number(id)]),
    clearOperations:()=>actions.push(['clear-ops']),
    setSlot:item=>{
      const id=Number(item.nodeId);
      slots.set(id,{id,nodeId:id,file:{name:'copy',size:item.fileSize},node:item,meta:null});
      actions.push(['set-slot',id]);
    },
    setMetadata:(id,metadata)=>{
      slots.get(Number(id)).meta={...metadata};
      actions.push(['set-meta',Number(id),metadata.name]);
    },
    clearSlot:id=>{
      slots.delete(Number(id));
      actions.push(['clear-slot',Number(id)]);
    },
    countOccupied:()=>[...slots.values()].filter(slot=>slot.file).length
  };

  const controller=createSampleCopyController({
    getMemory:()=>memory,
    getDeviceFiles:()=>files,
    setDeviceFiles:value=>{files=value;actions.push(['files',value.map(item=>item.nodeId)]);},
    getSoundsParentId:()=>1000,
    getSoundsMetadata:()=>({free_space_in_bytes:100}),
    getActiveDeviceProfile:()=>({
      playModes:['oneshot','key','legato'],
      advancedSampleMetadataWrites:true
    }),
    isConnected:()=>true,
    captureBatchSession:()=>{actions.push(['capture']);return'session-a';},
    assertBatchSession:token=>actions.push(['assert',token]),
    getDeviceSessionToken:()=> 'session-a',
    setMutating:value=>actions.push(['mutating',value]),
    setGlobalProgress:(label,value)=>actions.push(['progress',label,Math.round(value)]),
    hideGlobalProgress:()=>actions.push(['hide']),
    assertSlotsEmpty:async ids=>actions.push(['empty',...ids]),
    refreshSoundsRuntimeMetadata:async()=>{
      actions.push(['refresh-memory']);
      return{free_space_in_bytes:100};
    },
    getFile:async(id,onProgress)=>{
      actions.push(['get',id]);
      onProgress?.(2,4);
      return{name:'wire-kick',data:Uint8Array.from([1,2,3,4])};
    },
    getFileMetadata:async id=>{
      actions.push(['metadata',id]);
      return{name:'kick','sound.pitch':-12,'sound.playmode':'oneshot','envelope.release':255};
    },
    prepareSampleTransferMetadata:(metadata,options)=>{
      actions.push(['prepare-transfer',options.allowedPlayModes.join(',')]);
      return{...metadata};
    },
    createTransferFileName:(sourceId,targetId)=>{
      actions.push(['transfer-name',sourceId,targetId]);
      return'mv007_008';
    },
    uploadSampleToSlot:async options=>{
      actions.push(['upload',options.destinationId,options.filename,options.barWriteMode]);
      options.onCreated?.(8);
      options.onProgress?.(4,4);
      return 8;
    },
    waitForMetadataUpdate:nodeId=>{
      actions.push(['wait-metadata',nodeId]);
      return Promise.resolve({data:{metadata:{free_space_in_bytes:96}}});
    },
    syncMetadataAfterMutation:async(nodeId,promise)=>{
      await promise;
      actions.push(['sync-metadata',nodeId]);
    },
    getFileInfo:async id=>{
      actions.push(['info',id]);
      return{nodeId:8,parentId:1000,fileName:'mv007_008',fileSize:4,flags:1};
    },
    fileItemFromInfo:info=>({
      nodeId:Number(info.nodeId),fileName:'/sounds/'+info.fileName,
      fileType:'file',fileSize:Number(info.fileSize),
      isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true
    }),
    updateDeviceFile:item=>{
      files=files.filter(file=>Number(file.nodeId)!==Number(item.nodeId));
      files.push(item);
      actions.push(['update-file',item.nodeId]);
    },
    prepareSampleLocalMetadata:(metadata,options)=>{
      actions.push(['prepare-local',options.barWriteMode]);
      return{...metadata,local:true};
    },
    sampleMetadataCache:{set:(slot,metadata)=>actions.push(['cache',slot.id,metadata.name])},
    renderDeviceStats:(metadata,count)=>actions.push(['stats',metadata.free_space_in_bytes,count]),
    deleteFile:async id=>actions.push(['delete',id]),
    readDevice:async()=>actions.push(['resync']),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)])
  });

  const result=await controller.copyTransfer(
    [{sourceId:7,targetId:8}],
    new Map([[7,source]]),
    [source]
  );

  assert.deepEqual(result,{targetIds:[8]});
  assert.deepEqual(actions.find(item=>item[0]==='upload'),['upload',8,'mv007_008','preserve']);
  assert.equal(slots.get(8).meta.name,'kick');
  assert.equal(slots.get(8).meta.local,true);

  const getIndex=actions.findIndex(item=>item[0]==='get');
  const metadataIndex=actions.findIndex(item=>item[0]==='metadata');
  const uploadIndex=actions.findIndex(item=>item[0]==='upload');
  const syncIndex=actions.findIndex(item=>item[0]==='sync-metadata');
  const infoIndex=actions.findIndex(item=>item[0]==='info');
  const setSlotIndex=actions.findIndex(item=>item[0]==='set-slot');
  assert.ok(
    getIndex>=0&&
    metadataIndex>getIndex&&
    uploadIndex>metadataIndex&&
    syncIndex>uploadIndex&&
    infoIndex>syncIndex&&
    setSlotIndex>infoIndex
  );
  assert.equal(actions.some(item=>item[0]==='delete'),false);
  assert.equal(actions.some(item=>item[0]==='resync'),false);
  assert.equal(actions.at(-2)[0],'hide');
  assert.deepEqual(actions.at(-1),['mutating',false]);
});

test('sample copy controller rolls created destinations back in reverse order and resyncs after failure',async()=>{
  const actions=[];
  let files=[
    {nodeId:1000,fileName:'/sounds',fileType:'folder'},
    {nodeId:8,fileName:'/sounds/copy1',fileType:'file'},
    {nodeId:10,fileName:'/sounds/copy2',fileType:'file'}
  ];
  const source7={id:7,nodeId:7,file:{name:'one'},node:{isReadable:true},meta:{}};
  const source9={id:9,nodeId:9,file:{name:'two'},node:{isReadable:true},meta:{}};
  const slots=new Map([
    [7,source7],
    [8,{id:8,nodeId:8,file:null,node:null,meta:null}],
    [9,source9],
    [10,{id:10,nodeId:10,file:null,node:null,meta:null}]
  ]);
  const memory={
    getSlot:id=>slots.get(Number(id)),
    setOperation(){},
    clearOperation(){},
    clearOperations:()=>actions.push(['clear-ops']),
    setSlot:item=>{
      const id=Number(item.nodeId);
      slots.set(id,{id,nodeId:id,file:{name:item.fileName},node:item,meta:null});
    },
    setMetadata(id,metadata){slots.get(Number(id)).meta={...metadata};},
    clearSlot:id=>{
      slots.delete(Number(id));
      actions.push(['clear-slot',Number(id)]);
    },
    countOccupied:()=>2
  };
  let uploadCount=0;

  const controller=createSampleCopyController({
    getMemory:()=>memory,
    getDeviceFiles:()=>files,
    setDeviceFiles:value=>{files=value;actions.push(['files',value.map(item=>item.nodeId)]);},
    getSoundsParentId:()=>1000,
    getSoundsMetadata:()=>({free_space_in_bytes:100}),
    getActiveDeviceProfile:()=>({
      playModes:['oneshot','key','legato'],
      advancedSampleMetadataWrites:true
    }),
    isConnected:()=>true,
    captureBatchSession:()=> 'session-a',
    assertBatchSession:token=>assert.equal(token,'session-a'),
    getDeviceSessionToken:()=> 'session-a',
    setMutating(){},
    setGlobalProgress(){},
    hideGlobalProgress:()=>actions.push(['hide']),
    assertSlotsEmpty:async()=>{},
    refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:100}),
    getFile:async id=>({name:'source-'+id,data:Uint8Array.from([1,2])}),
    getFileMetadata:async id=>({name:'source-'+id}),
    prepareSampleTransferMetadata:metadata=>({...metadata}),
    createTransferFileName:(sourceId,targetId)=>'mv'+sourceId+'_'+targetId,
    uploadSampleToSlot:async options=>{
      uploadCount+=1;
      options.onCreated?.(options.destinationId);
      actions.push(['upload',options.destinationId]);
      if(uploadCount===2)throw new Error('second copy failed');
      return options.destinationId;
    },
    waitForMetadataUpdate:nodeId=>{
      actions.push(['wait-metadata',nodeId]);
      return Promise.resolve(null);
    },
    syncMetadataAfterMutation:async(nodeId,promise)=>{
      await promise;
      actions.push(['sync-metadata',nodeId]);
    },
    getFileInfo:async id=>({nodeId:id,parentId:1000,fileName:'copy'+id,fileSize:2,flags:1}),
    fileItemFromInfo:info=>({
      nodeId:Number(info.nodeId),fileName:'/sounds/'+info.fileName,
      fileType:'file',fileSize:Number(info.fileSize)
    }),
    updateDeviceFile(){},
    prepareSampleLocalMetadata:metadata=>({...metadata}),
    sampleMetadataCache:{set(){}},
    renderDeviceStats(){},
    deleteFile:async id=>actions.push(['delete',id]),
    readDevice:async()=>actions.push(['resync']),
    logTechnical:(label,error)=>actions.push(['log',label,String(error?.message||error)])
  });

  await assert.rejects(
    ()=>controller.copyTransfer(
      [{sourceId:7,targetId:8},{sourceId:9,targetId:10}],
      new Map([[7,source7],[9,source9]]),
      [source7,source9]
    ),
    /second copy failed/
  );

  assert.deepEqual(actions.filter(item=>item[0]==='upload'),[
    ['upload',8],['upload',10]
  ]);
  assert.deepEqual(actions.filter(item=>item[0]==='delete'),[
    ['delete',10],['delete',8]
  ]);
  const delete10=actions.findIndex(item=>item[0]==='delete'&&item[1]===10);
  const delete8=actions.findIndex(item=>item[0]==='delete'&&item[1]===8);
  assert.ok(delete10>=0&&delete8>delete10);
  assert.equal(actions.filter(item=>item[0]==='resync').length,1);
  assert.equal(files.some(item=>Number(item.nodeId)===8),false);
  assert.equal(files.some(item=>Number(item.nodeId)===10),false);
  assert.equal(actions.at(-2)[0],'resync');
  assert.equal(actions.at(-1)[0],'hide');
});

test('sample copy controller rejects unreadable sources before entering the mutating phase',async()=>{
  let mutatingCalls=0,getCalls=0;
  const source={id:7,nodeId:7,file:{name:'locked'},node:{isReadable:false}};
  const controller=createSampleCopyController({
    getMemory:()=>({}),
    getDeviceFiles:()=>[],setDeviceFiles(){},
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),
    getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:false}),
    isConnected:()=>true,
    captureBatchSession:()=> 'session-a',
    assertBatchSession(){},getDeviceSessionToken:()=> 'session-a',
    setMutating(){mutatingCalls++;},
    setGlobalProgress(){},hideGlobalProgress(){},
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({}),
    getFile:async()=>{getCalls++;return{data:new Uint8Array(1)};},
    getFileMetadata:async()=>({}),prepareSampleTransferMetadata:x=>x,
    createTransferFileName:()=> 'copy',
    uploadSampleToSlot:async()=>1,waitForMetadataUpdate:()=>Promise.resolve(null),
    syncMetadataAfterMutation:async()=>{},getFileInfo:async()=>({}),fileItemFromInfo:()=>null,
    updateDeviceFile(){},prepareSampleLocalMetadata:x=>x,sampleMetadataCache:{set(){}},
    renderDeviceStats(){},deleteFile:async()=>{},readDevice:async()=>{},logTechnical(){}
  });

  await assert.rejects(
    ()=>controller.copyTransfer([{sourceId:7,targetId:8}],new Map([[7,source]]),[source]),
    /One or more source samples cannot be read/
  );
  assert.equal(mutatingCalls,0);
  assert.equal(getCalls,0);
});
