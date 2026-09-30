import test from 'node:test';
import assert from 'node:assert/strict';
import{createFeedbackController}from '../js/ep133/ui/feedback.js';
import{createFileEventController}from '../js/ep133/ui/fileEvents.js';
import{createConnectionLifecycle}from '../js/ep133/ui/connectionLifecycle.js';
import{createSampleLibrarySyncController}from '../js/ep133/ui/sampleLibrarySync.js';
import{createSamplePropertiesController}from '../js/ep133/ui/samplePropertiesController.js';
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
