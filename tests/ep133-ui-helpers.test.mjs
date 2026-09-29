import test from 'node:test';
import assert from 'node:assert/strict';
import{createFeedbackController}from '../js/ep133/ui/feedback.js';
import{createFileEventController}from '../js/ep133/ui/fileEvents.js';
import{getSoundsParentId,buildFileItemFromInfo,buildProvisionalUploadedFileItem,soundSlotIds}from '../js/ep133/ui/fileModel.js';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE
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
