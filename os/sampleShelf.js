/**
 * Offline Sample Shelf. A local IndexedDB-backed source-audio collection.
 * Never obtains WebMIDI, communicates with the device, or alters project data.
 * Each entry owns the original Blob; names and import paths are untrusted text.
 */
export const SHELF_DB_NAME='speeduppercut-sample-shelf-v1';
export const SHELF_MAX_FILE_BYTES=96*1024*1024;
export const SHELF_AUDIO_EXTENSIONS=Object.freeze(['wav','wave','mp3','aif','aiff','flac','ogg','oga','m4a','aac']);
const STORE='samples';

export function isSupportedShelfFile(file){
 const name=String(file?.name||'');
 const extension=name.split('.').pop().toLowerCase();
 return SHELF_AUDIO_EXTENSIONS.includes(extension)&&
  Number.isFinite(file?.size)&&file.size>0&&file.size<=SHELF_MAX_FILE_BYTES;
}
export function shelfRelativePath(file){
 const path=String(file?.webkitRelativePath||file?.relativePath||file?.name||'');
 return path.replaceAll('\\','/').split('/').filter(p=>p&&p!=='.'&&p!=='..').join('/');
}
export function filterShelfEntries(entries,query=''){
 const term=String(query).trim().toLocaleLowerCase();
 return entries.filter(item=>!term||[item.name,item.relativePath].some(s=>String(s||'').toLocaleLowerCase().includes(term)));
}
const metadata=record=>({
 id:record.id,name:record.name,relativePath:record.relativePath,type:record.type,
 size:record.size,importedAt:record.importedAt,origin:'original-local-file'
});
function errorMessage(error){return String(error?.message||error?.name||error);}
function requestValue(request){
 return new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('IndexedDB request failed'));
 });
}
function transactionDone(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
  tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
 });
}
export function createSampleShelf({indexedDBImpl=globalThis.indexedDB,cryptoImpl=globalThis.crypto}={}){
 if(!indexedDBImpl||!cryptoImpl?.subtle)throw new Error('Offline library requires IndexedDB and secure-context SHA-256 support.');
 let dbPromise=null;
 function database(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const request=indexedDBImpl.open(SHELF_DB_NAME,1);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
   };
   request.onsuccess=()=>{
    const db=request.result;
    db.onversionchange=()=>{db.close();dbPromise=null;};
    resolve(db);
   };
   request.onerror=()=>reject(request.error||new Error('IndexedDB unavailable'));
   request.onblocked=()=>reject(new Error('Close other Speeduppercut tabs to upgrade the local library.'));
  }).catch(error=>{dbPromise=null;throw error;});
  return dbPromise;
 }
 async function list(){
  const db=await database(),tx=db.transaction(STORE,'readonly');
  const result=await requestValue(tx.objectStore(STORE).getAll());
  return result.map(metadata).sort((a,b)=>b.importedAt-a.importedAt||a.name.localeCompare(b.name));
 }
 async function get(id){
  const db=await database(),tx=db.transaction(STORE,'readonly');
  return await requestValue(tx.objectStore(STORE).get(String(id)));
 }
 async function remove(id){
  const db=await database(),tx=db.transaction(STORE,'readwrite');
  const done=transactionDone(tx);tx.objectStore(STORE).delete(String(id));await done;
 }
 async function clear(){
  const db=await database(),tx=db.transaction(STORE,'readwrite');
  const done=transactionDone(tx);tx.objectStore(STORE).clear();await done;
 }
 async function importFiles(input,{signal,onProgress}={}){
  const files=Array.from(input||[]);
  const result={added:0,duplicates:0,rejected:0,failed:0,cancelled:false,errors:[]};
  const db=await database();
  for(let i=0;i<files.length;i++){
   if(signal?.aborted){result.cancelled=true;break;}
   const file=files[i];
   try{
    if(!isSupportedShelfFile(file)){
     result.rejected++;
     result.errors.push(String(file?.name||'Unnamed file')+': unsupported, empty or larger than 96 MiB');
     continue;
    }
    const array=await file.arrayBuffer();
    if(signal?.aborted){result.cancelled=true;break;}
    const hash=await cryptoImpl.subtle.digest('SHA-256',array);
    const id=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(await requestValue(db.transaction(STORE,'readonly').objectStore(STORE).getKey(id))){
     result.duplicates++;
     continue;
    }
    if(signal?.aborted){result.cancelled=true;break;}
    const tx=db.transaction(STORE,'readwrite');
    const done=transactionDone(tx);
    const record={
     id,name:file.name,relativePath:shelfRelativePath(file),
     size:file.size,type:file.type||'application/octet-stream',
     importedAt:Date.now(),origin:'original-local-file',
     blob:new Blob([array],{type:file.type||'application/octet-stream'})
    };
    tx.objectStore(STORE).add(record);
    try{await done;result.added++;}
    catch(error){
     if(error?.name==='ConstraintError')result.duplicates++;
     else throw error;
    }
   }catch(error){
    result.failed++;
    result.errors.push(String(file?.name||'Unnamed file')+': '+errorMessage(error));
    if(error?.name==='QuotaExceededError')break;
   }finally{onProgress?.({index:i+1,total:files.length,...result});}
  }
  return result;
 }
 return Object.freeze({list,get,remove,clear,importFiles});
}
