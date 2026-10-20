import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '../js/ep133/padRecovery.js';

// Minimal asynchronous IndexedDB adapter: commits become visible only at complete.
function indexedDb(){
  const databases=new Map();
  return{open(name){
    const request=new EventTarget();
    queueMicrotask(()=>{
      const fresh=!databases.has(name);if(fresh)databases.set(name,new Map());
      const rows=databases.get(name);
      request.result={objectStoreNames:{contains:()=>!fresh},createObjectStore:()=>({}),
        transaction(){
          const tx=new EventTarget(),pending=[];
          tx.objectStore=()=>({
            put(value){pending.push(()=>rows.set(value.id,structuredClone(value)));},
            delete(id){pending.push(()=>rows.delete(id));},
            get(id){return read(()=>rows.get(id));},getAll(){return read(()=>[...rows.values()]);}
          });
          function read(fn){const r=new EventTarget();queueMicrotask(()=>{r.result=structuredClone(fn());r.dispatchEvent(new Event('success'));});return r;}
          queueMicrotask(()=>{pending.forEach(fn=>fn());tx.dispatchEvent(new Event('complete'));});return tx;
        }};
      if(fresh)request.dispatchEvent(new Event('upgradeneeded'));
      request.dispatchEvent(new Event('success'));
    });return request;
  }};
}
const record=id=>({id,device:{identityHash:'abc',sku:'TE032AS001',firmware:'2.5.1'},
  target:{project:'01',group:'A',pad:'01',projectFid:2101,groupFid:4001,padFid:6107,sampleSlot:7},
  before:{sym:7,'sound.pitch':0},desired:{sym:7,'sound.pitch':3},status:'requires-recovery',phase:'MUTATE',verification:null});

test('pad recovery durable store survives restart and detaches snapshots',async()=>{
  const db=indexedDb(),store=module.createPadRecoveryStore({indexedDBRef:db});
  assert.equal(store.persistent,true);const input=record('pad-1');await store.save(input);input.before.sym=999;
  const restarted=module.createPadRecoveryStore({indexedDBRef:db});
  const saved=await restarted.get('pad-1');assert.equal(saved.target.padFid,6107);assert.equal(saved.before.sym,7);
  saved.before.sym=88;assert.equal((await restarted.get('pad-1')).before.sym,7);
  assert.equal((await restarted.list()).length,1);
});

test('pad recovery refuses missing persistence and storage open failure',async()=>{
  const unavailable=module.createPadRecoveryStore({indexedDBRef:null});assert.equal(unavailable.persistent,false);
  await assert.rejects(()=>unavailable.save(record('x')),/persist|unavailable/i);
  const failed=module.createPadRecoveryStore({indexedDBRef:{open(){const r=new EventTarget();queueMicrotask(()=>r.dispatchEvent(new Event('error')));return r;}}});
  await assert.rejects(()=>failed.save(record('x')),/storage|database|persist/i);
});

test('pad recovery immutability, privacy, and unresolved retention survive resolved-history pruning',async()=>{
  const store=module.createPadRecoveryStore({indexedDBRef:indexedDb()});
  await store.save(record('unresolved'));
  for(let i=0;i<12;i++){await store.save(record('done-'+i));await store.update('done-'+i,{status:'verified',phase:'VERIFY'});}
  await store.update('unresolved',{device:{serial:'SECRET'},target:{padFid:2},before:{sym:2},sessionToken:'SECRET'});
  const unresolved=await store.get('unresolved');
  assert.equal(unresolved.target.padFid,6107);assert.equal(unresolved.before.sym,7);
  assert.equal(JSON.stringify(unresolved).includes('SECRET'),false);
  assert.ok((await store.list()).some(r=>r.id==='unresolved'));
  await assert.rejects(()=>store.delete('unresolved'),/unresolved/i);
  await store.delete('done-11');assert.equal(await store.get('done-11'),null);
});
