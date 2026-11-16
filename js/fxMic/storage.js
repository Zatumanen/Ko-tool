import{validatePack}from './pack.js';
export function createLocalPacks(indexedDBRef=globalThis.indexedDB){
 let opening;
 const open=()=>opening??=new Promise((resolve,reject)=>{
  if(!indexedDBRef){reject(Error('Local storage unavailable; export ZIP to keep your work'));return;}
  const request=indexedDBRef.open('ko-tool-fx-mic-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('packs');
  request.onerror=()=>{opening=null;reject(request.error);};
  request.onsuccess=()=>resolve(request.result);
 });
 async function transaction(mode,operation){
  const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('packs',mode);let result;
   try{const req=operation(tx.objectStore('packs'));req.onsuccess=()=>{result=req.result;};}catch(e){tx.abort();reject(e);return;}
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('Local save failed; export ZIP'));
  });
 }
 return{
  list:()=>transaction('readonly',s=>s.getAllKeys()),
  async save(name,pack,{overwrite=false}={}){
   validatePack(pack);if(!name?.trim()||name.length>128)throw Error('Choose a local pack name');
   const snapshot=structuredClone(pack);
   await transaction('readwrite',s=>overwrite?s.put(snapshot,name):s.add(snapshot,name));
  },
  load:async name=>{const pack=await transaction('readonly',s=>s.get(name));if(!pack)throw Error('Local pack not found');validatePack(pack);return pack;}
 };
}
