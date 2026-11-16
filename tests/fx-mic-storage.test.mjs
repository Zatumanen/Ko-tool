import test from 'node:test';
import assert from 'node:assert/strict';
import{createLocalPacks}from '../js/fxMic/storage.js';

function memoryIndexedDb(){
 const records=new Map();
 const db={transaction(){
  const start=operation=>{
   const request={};
   queueMicrotask(()=>{
    try{request.result=operation();request.onsuccess?.();transaction.oncomplete?.();}
    catch(error){request.error=transaction.error=error;transaction.onerror?.();transaction.onabort?.();}
   });
   return request;
  };
  const objectStore={
   get:name=>start(()=>records.get(name)),
   add:(pack,name)=>start(()=>{
    if(records.has(name))throw new DOMException('Duplicate pack','ConstraintError');
    records.set(name,pack);
   }),
   put:(pack,name)=>start(()=>records.set(name,pack))
  };
  const transaction={objectStore:()=>objectStore};
  return transaction;
 }};
 return{open(){
  const request={result:db};
  queueMicrotask(()=>request.onsuccess());
  return request;
 }};
}

test('saving over a pack requires explicit overwrite, preserving it on conflict',async()=>{
 const storage=createLocalPacks(memoryIndexedDb());
 const pack=name=>({config:{name},files:new Map()});
 await storage.save('same',pack('original'));
 await assert.rejects(()=>storage.save('same',pack('replacement')),{name:'ConstraintError'});
 assert.equal((await storage.load('same')).config.name,'original');
 await storage.save('same',pack('replacement'),{overwrite:true});
 assert.equal((await storage.load('same')).config.name,'replacement');
});
