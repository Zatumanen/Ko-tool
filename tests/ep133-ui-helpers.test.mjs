import test from 'node:test';
import assert from 'node:assert/strict';
import{createFeedbackController}from '../js/ep133/ui/feedback.js';
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
