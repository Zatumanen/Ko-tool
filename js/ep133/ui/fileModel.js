import{TE_SYSEX_FILE_FILE_TYPE_FILE}from '../constants.js?v=20261001-1';
import{decodeFileRights,encodeFileRights}from '../deviceCapabilities.js?v=20261001-1';

export const getSoundsParentId=files=>
  (files||[]).find(item=>item.fileName==='/sounds'&&item.fileType==='folder')?.nodeId||0;

export function buildFileItemFromInfo(info,deviceFiles=[]){
  const parentId=Number(info?.parentId);
  const parent=parentId===0?null:(deviceFiles||[]).find(item=>Number(item.nodeId)===parentId);
  const parentPath=parentId===0?'':parent?.fileName;
  if(parentId!==0&&!parentPath)return null;
  const fileName=(parentPath||'')+'/'+String(info?.fileName||'').replace(/^\/+/, '');
  const flags=Number(info?.flags)||0;
  const rights=decodeFileRights(flags);
  return{
    nodeId:Number(info?.nodeId),
    flags,
    fileSize:Number(info?.fileSize)||0,
    fileName,
    fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',
    isReadable:rights.read,
    isWritable:rights.write,
    isDeletable:rights.delete,
    isMovable:rights.move,
    isPlayable:rights.playback
  };
}

export function buildProvisionalUploadedFileItem({nodeId,parentId,fileSize,fileName},{deviceFiles=[],normalizeFileName}={}){
  if(typeof normalizeFileName!=='function')throw new TypeError('Provisional file model requires normalizeFileName.');
  const parent=(deviceFiles||[]).find(item=>Number(item.nodeId)===Number(parentId));
  const parentPath=parent?.fileName||'/sounds';
  const normalizedName=normalizeFileName(fileName||'sample.wav');
  const flags=TE_SYSEX_FILE_FILE_TYPE_FILE|encodeFileRights({read:true});
  return{
    nodeId:Number(nodeId),
    flags,
    fileSize:Number(fileSize)||0,
    fileName:(parentPath||'/sounds')+'/'+normalizedName,
    fileType:'file',
    isReadable:true,
    isWritable:false,
    isDeletable:false,
    isMovable:false,
    isPlayable:false
  };
}

export const soundSlotIds=files=>new Set(
  (files||[])
    .filter(item=>/^\/sounds\/[^/]+$/.test(item?.fileName||'')&&Number(item?.nodeId)>=1&&Number(item?.nodeId)<=999)
    .map(item=>Number(item.nodeId))
);
